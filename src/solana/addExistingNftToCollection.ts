import {
  collectionToggle,
  findMetadataPda,
  updateV1,
  verifyCollectionV1,
} from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';

import { createNftUmi } from './umi';
import { sendMintBuilder } from './sendMintBuilder';
import { analyzeExistingNftForCollection } from '../collection/existingItem';
import {
  fetchCollectionOnChain,
  fetchExistingNftSnapshot,
} from './collectionOnChain';
import type { SolanaNetwork } from './config';
import type { SolanaWalletProvider } from './wallets';

export async function inspectExistingNftForCollection(params: {
  network: SolanaNetwork;
  walletAddress: string;
  collectionMint: string;
  nftMint: string;
}) {
  const [collection, nft] = await Promise.all([
    fetchCollectionOnChain(params.network, params.collectionMint),
    fetchExistingNftSnapshot(params.network, params.nftMint),
  ]);

  const plan = analyzeExistingNftForCollection({
    nft,
    collectionMint: params.collectionMint,
    walletAddress: params.walletAddress,
    collectionUpdateAuthority: collection.updateAuthority,
  });

  return { collection, nft, plan };
}

export async function addExistingNftToCollection(params: {
  network: SolanaNetwork;
  walletProvider: SolanaWalletProvider;
  walletAddress: string;
  collectionMint: string;
  nftMint: string;
}) {
  const inspection = await inspectExistingNftForCollection({
    network: params.network,
    walletAddress: params.walletAddress,
    collectionMint: params.collectionMint,
    nftMint: params.nftMint,
  });

  if (!inspection.plan.canAttempt) {
    throw new Error(inspection.plan.blockedReason ?? 'This NFT cannot be added to the collection.');
  }

  const umi = createNftUmi(params.network, params.walletProvider);
  const collectionMint = publicKey(params.collectionMint);
  const nftMint = publicKey(params.nftMint);
  const metadata = findMetadataPda(umi, { mint: nftMint });

  let builder = verifyCollectionV1(umi, {
    metadata,
    collectionMint,
    authority: umi.identity,
  });

  if (inspection.plan.needsSetCollection) {
    builder = updateV1(umi, {
      mint: nftMint,
      authority: umi.identity,
      collection: collectionToggle('Set', [
        {
          key: collectionMint,
          verified: false,
        },
      ]),
    }).add(builder);
  }

  const sent = await sendMintBuilder({
    umi,
    builder,
    mintAddress: params.nftMint,
  });

  return {
    ...sent,
    collectionVerified: true as const,
    collectionMint: params.collectionMint,
  };
}
