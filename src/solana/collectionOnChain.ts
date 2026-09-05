import {
  fetchDigitalAsset,
  mplTokenMetadata,
  TokenStandard,
  type DigitalAsset,
} from '@metaplex-foundation/mpl-token-metadata';

import { mplToolbox } from '@metaplex-foundation/mpl-toolbox';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';

import { getRpc, type SolanaNetwork } from './config';
import { isNonFungibleStandard } from '../collection/existingItem';
import type { ExistingNftSnapshot } from '../collection/existingItem';

type OptionLike<T> = {
  __option?: string;
  value?: T;
} | T | null | undefined;

function unwrapOption<T>(option: OptionLike<T>): T | null {
  if (option === null || option === undefined) {
    return null;
  }

  if (typeof option === 'object' && '__option' in option) {
    return option.__option === 'Some' ? (option.value as T) : null;
  }

  return option as T;
}

function tokenStandardLabel(value: TokenStandard | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value === TokenStandard.NonFungible) {
    return 'NonFungible';
  }

  if (value === TokenStandard.FungibleAsset) {
    return 'FungibleAsset';
  }

  if (value === TokenStandard.Fungible) {
    return 'Fungible';
  }

  if (value === TokenStandard.NonFungibleEdition) {
    return 'NonFungibleEdition';
  }

  if (value === TokenStandard.ProgrammableNonFungible) {
    return 'ProgrammableNonFungible';
  }

  return String(value);
}

export function createReadOnlyUmi(network: SolanaNetwork) {
  return createUmi(getRpc(network)).use(mplToolbox()).use(mplTokenMetadata());
}

export type OnChainCollectionView = {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  updateAuthority: string;
  tokenStandard: string | null;
  isCollection: boolean;
  collectionDetailsKind: 'V1' | 'V2' | null;
  onChainVerifiedSize: number | null;
};

export function digitalAssetToCollectionView(asset: DigitalAsset): OnChainCollectionView {
  const details = unwrapOption(asset.metadata.collectionDetails);
  const tokenStandard = unwrapOption(asset.metadata.tokenStandard);
  let collectionDetailsKind: 'V1' | 'V2' | null = null;
  let onChainVerifiedSize: number | null = null;

  if (details && typeof details === 'object' && '__kind' in details) {
    if (details.__kind === 'V1') {
      collectionDetailsKind = 'V1';
      onChainVerifiedSize = Number(details.size);
    }

    if (details.__kind === 'V2') {
      collectionDetailsKind = 'V2';
    }
  }

  return {
    mint: asset.publicKey.toString(),
    name: asset.metadata.name.replace(/\0/g, '').trim(),
    symbol: asset.metadata.symbol.replace(/\0/g, '').trim(),
    uri: asset.metadata.uri.replace(/\0/g, '').trim(),
    updateAuthority: asset.metadata.updateAuthority.toString(),
    tokenStandard: tokenStandardLabel(tokenStandard),
    isCollection: Boolean(details),
    collectionDetailsKind,
    onChainVerifiedSize,
  };
}

export async function fetchCollectionOnChain(
  network: SolanaNetwork,
  mintAddress: string
): Promise<OnChainCollectionView> {
  const umi = createReadOnlyUmi(network);
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  return digitalAssetToCollectionView(asset);
}

export function digitalAssetToExistingNftSnapshot(asset: DigitalAsset): ExistingNftSnapshot {
  const tokenStandard = unwrapOption(asset.metadata.tokenStandard);
  const collection = unwrapOption(asset.metadata.collection);

  return {
    mint: asset.publicKey.toString(),
    name: asset.metadata.name.replace(/\0/g, '').trim(),
    tokenStandard: tokenStandardLabel(tokenStandard),
    isMutable: asset.metadata.isMutable,
    updateAuthority: asset.metadata.updateAuthority.toString(),
    collectionKey: collection ? collection.key.toString() : null,
    collectionVerified: Boolean(collection?.verified),
  };
}

export type MintAccountPresence = 'exists' | 'missing' | 'unknown';

export function classifyMintAccountLookupError(error: unknown): Exclude<MintAccountPresence, 'exists'> {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);

  if (/account not found|not found at|does not exist|AccountNotFound|unexpected account/i.test(text)) {
    return 'missing';
  }

  return 'unknown';
}

export async function fetchExistingNftSnapshot(
  network: SolanaNetwork,
  mintAddress: string
): Promise<ExistingNftSnapshot> {
  const umi = createReadOnlyUmi(network);
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  return digitalAssetToExistingNftSnapshot(asset);
}

export function collectionItemIsVerifiedOnChain(
  snapshot: ExistingNftSnapshot,
  collectionMint: string
): boolean {
  return (
    snapshot.collectionKey === collectionMint &&
    snapshot.collectionVerified === true &&
    isNonFungibleStandard(snapshot.tokenStandard)
  );
}
