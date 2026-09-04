import {
  createNft,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, publicKey } from '@metaplex-foundation/umi';

import { createNftUmi } from './umi';
import { logMintPipelineFlags, resolveMintOutcome } from './mintResult';
import { royaltyPercentToBasisPoints } from '../validation/royalties';
import type { SolanaNetwork } from './config';
import type { SolanaWalletProvider } from './wallets';

export const UNIQUE_NFT_TOKEN_STANDARD = 'NonFungible' as const;
export const UNIQUE_NFT_AMOUNT = 1;

export function planUniqueNftMint(params: {
  royaltyPercent: number;
  creatorAddress: string;
  isMutable: boolean;
}) {
  return {
    tokenStandard: UNIQUE_NFT_TOKEN_STANDARD,
    tokenStandardValue: TokenStandard.NonFungible,
    amount: UNIQUE_NFT_AMOUNT,
    sellerFeeBasisPoints: royaltyPercentToBasisPoints(params.royaltyPercent),
    creatorAddress: params.creatorAddress,
    creatorShare: 100,
    isMutable: params.isMutable,
  };
}

export type MintUniqueNftParams = {
  network: SolanaNetwork;
  walletProvider: SolanaWalletProvider;
  name: string;
  symbol: string;
  metadataUri: string;
  royaltyPercent: number;
  creatorAddress: string;
  isMutable: boolean;
};

export type MintUniqueNftResult = {
  mintAddress: string;
  signature: string;
  tokenStandard: typeof UNIQUE_NFT_TOKEN_STANDARD;
  tokenStandardValue: TokenStandard.NonFungible;
  confirmSucceeded: boolean;
  showIndexingNotice: boolean;
};

export async function mintUniqueNft(
  params: MintUniqueNftParams
): Promise<MintUniqueNftResult> {
  const umi = createNftUmi(params.network, params.walletProvider);
  const mint = generateSigner(umi);
  const mintAddress = mint.publicKey.toString();

  const builder = createNft(umi, {
    mint,
    name: params.name,
    symbol: params.symbol,
    uri: params.metadataUri,
    sellerFeeBasisPoints: percentAmount(params.royaltyPercent),
    creators: [
      {
        address: publicKey(params.creatorAddress),
        verified: true,
        share: 100,
      },
    ],
    isMutable: params.isMutable,
  });

  let signatureRaw: unknown;
  let sendSucceeded = false;
  let confirmSucceeded = false;

  try {
    signatureRaw = await builder.send(umi);
    sendSucceeded = true;
  } catch (error) {
    logMintPipelineFlags({
      mintPublicKeyPresent: Boolean(mintAddress),
      transactionSignaturePresent: false,
      sendAndConfirmSuccess: false,
      postMintLookupSuccess: false,
    });
    throw error;
  }

  try {
    await builder.confirm(umi, signatureRaw as never, {
      commitment: 'confirmed',
    });
    confirmSucceeded = true;
  } catch {
    confirmSucceeded = false;
  }

  const outcome = resolveMintOutcome({
    mintAddress,
    signature: signatureRaw,
    sendSucceeded,
    confirmSucceeded,
  });

  logMintPipelineFlags({
    mintPublicKeyPresent: Boolean(mintAddress),
    transactionSignaturePresent: outcome.status === 'success',
    sendAndConfirmSuccess: sendSucceeded && confirmSucceeded,
    postMintLookupSuccess: confirmSucceeded,
  });

  if (outcome.status === 'failed') {
    throw new Error('Unable to format transaction signature.');
  }

  return {
    mintAddress: outcome.mintAddress,
    signature: outcome.signature,
    tokenStandard: UNIQUE_NFT_TOKEN_STANDARD,
    tokenStandardValue: TokenStandard.NonFungible,
    confirmSucceeded: outcome.confirmSucceeded,
    showIndexingNotice: outcome.showIndexingNotice,
  };
}
