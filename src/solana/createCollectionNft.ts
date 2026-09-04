import { createNft, TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, publicKey } from '@metaplex-foundation/umi';

import { createNftUmi } from './umi';
import { sendMintBuilder } from './sendMintBuilder';
import type { SolanaNetwork } from './config';
import type { SolanaWalletProvider } from './wallets';

export type CreateCollectionNftParams = {
  network: SolanaNetwork;
  walletProvider: SolanaWalletProvider;
  name: string;
  symbol: string;
  metadataUri: string;
  royaltyPercent: number;
  creatorAddress: string;
  isMutable: boolean;
};

export async function createCollectionNft(params: CreateCollectionNftParams) {
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
    isCollection: true,
  });

  const sent = await sendMintBuilder({ umi, builder, mintAddress });

  return {
    ...sent,
    tokenStandard: 'NonFungible' as const,
    tokenStandardValue: TokenStandard.NonFungible,
    isCollection: true as const,
  };
}
