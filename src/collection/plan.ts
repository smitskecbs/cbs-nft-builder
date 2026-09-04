import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';

import { DEFAULT_PLANNED_CAPACITY, SIZE_CAP_IS_ON_CHAIN } from './constants';
import { canAddCollectionItem } from './numbering';

export function planCollectionNft(params: {
  isMutable: boolean;
  royaltyPercent: number;
  creatorAddress: string;
  plannedMaxItems?: number;
}) {
  return {
    assetType: 'NFT Collection' as const,
    tokenStandard: 'NonFungible' as const,
    tokenStandardValue: TokenStandard.NonFungible,
    isCollection: true as const,
    collectionModel: 'Metaplex Token Metadata' as const,
    plannedMaxItems: params.plannedMaxItems ?? DEFAULT_PLANNED_CAPACITY,
    sizeCapIsOnChain: SIZE_CAP_IS_ON_CHAIN,
    amount: 1,
    creatorAddress: params.creatorAddress,
    creatorShare: 100,
    isMutable: params.isMutable,
    royaltyPercent: params.royaltyPercent,
  };
}

export function planCollectionItem(params: {
  collectionMint: string;
  itemNumber: number;
  isMutable: boolean;
  currentItemCount: number;
  plannedMaxItems?: number;
}) {
  const cap = canAddCollectionItem(
    params.currentItemCount,
    params.plannedMaxItems ?? DEFAULT_PLANNED_CAPACITY
  );

  return {
    ok: cap.ok,
    error: cap.ok ? undefined : cap.error,
    assetType: 'Unique NFT' as const,
    tokenStandard: 'NonFungible' as const,
    tokenStandardValue: TokenStandard.NonFungible,
    collectionMint: params.collectionMint,
    collection: {
      key: params.collectionMint,
      verified: false,
    },
    verifyInstruction: 'verifyCollectionV1' as const,
    isMutable: params.isMutable,
    itemNumber: params.itemNumber,
  };
}

export function assertCollectionNetworkMatch(
  collectionNetwork: 'devnet' | 'mainnet',
  selectedNetwork: 'devnet' | 'mainnet'
): { ok: true } | { ok: false; error: string } {
  if (collectionNetwork !== selectedNetwork) {
    const collectionLabel = collectionNetwork === 'mainnet' ? 'Mainnet' : 'Devnet';
    const selectedLabel = selectedNetwork === 'mainnet' ? 'Mainnet' : 'Devnet';
    return {
      ok: false,
      error: `This collection is on ${collectionLabel}. The builder is set to ${selectedLabel}. Switch the network selector. The collection was not converted.`,
    };
  }

  return { ok: true };
}
