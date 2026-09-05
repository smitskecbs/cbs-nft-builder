import {
  createNft,
  findMetadataPda,
  TokenStandard,
  verifyCollectionV1,
} from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, publicKey } from '@metaplex-foundation/umi';

import { createNftUmi } from './umi';
import { sendMintBuilder, type MintSendProgressStage } from './sendMintBuilder';
import type { SolanaNetwork } from './config';
import type { SolanaWalletProvider } from './wallets';

export type CreateCollectionItemNftParams = {
  network: SolanaNetwork;
  walletProvider: SolanaWalletProvider;
  collectionMint: string;
  name: string;
  symbol: string;
  metadataUri: string;
  royaltyPercent: number;
  creatorAddress: string;
  isMutable: boolean;
  onSendProgress?: (stage: MintSendProgressStage) => void;
};

export async function createCollectionItemNft(params: CreateCollectionItemNftParams) {
  const umi = createNftUmi(params.network, params.walletProvider);
  const mint = generateSigner(umi);
  const mintAddress = mint.publicKey.toString();
  const collectionMint = publicKey(params.collectionMint);

  const createBuilder = createNft(umi, {
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
    collection: {
      key: collectionMint,
      verified: false,
    },
  });

  const verifyBuilder = verifyCollectionV1(umi, {
    metadata: findMetadataPda(umi, { mint: mint.publicKey }),
    collectionMint,
    authority: umi.identity,
  });

  const builder = createBuilder.add(verifyBuilder);
  const sent = await sendMintBuilder({
    umi,
    builder,
    mintAddress,
    onSendProgress: params.onSendProgress,
  });

  return {
    ...sent,
    tokenStandard: 'NonFungible' as const,
    tokenStandardValue: TokenStandard.NonFungible,
    collectionMint: params.collectionMint,
    collectionVerified: true as const,
  };
}
