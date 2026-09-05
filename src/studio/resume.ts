import type { CachedCollection, CachedCollectionItem } from '../collection/persistence';
import { assertCollectionNetworkMatch } from '../collection/plan';
import type { SolanaNetwork } from '../solana/config';
import {
  COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
  COLLECTION_ITEM_DISCOVERY_METHOD,
  type CollectionItemDiscovery,
  type DiscoveredCollectionItem,
} from '../solana/discoverCollectionItems';
import { createStudioDraft, usedNumbersFromDraftsAndMinted } from './drafts';
import {
  buildStudioItemName,
  nextStudioItemNumber,
  type StudioNumbering,
} from './numbering';
import { collectionStudioKey } from './persistence';
import type { StudioDefaults, StudioDraft, StudioSettings } from './types';
import { isNumberLocked, isPreparedDraft, hasOnChainMintProof } from './types';

export const COLLECTION_INDEXING_WAIT_LABEL = 'Mint submitted / Waiting for on-chain indexing';

export type MintAccountPresence = 'exists' | 'missing' | 'unknown';

export type RecoverDraftOptions = {
  now?: number;
  mintAccountPresence?: (mint: string) => MintAccountPresence;
};

export function networkDisplayName(network: SolanaNetwork): 'Mainnet' | 'Devnet' {
  return network === 'mainnet' ? 'Mainnet' : 'Devnet';
}

export function mergeMintedItemRecords(
  left: readonly CachedCollectionItem[],
  right: readonly CachedCollectionItem[]
): CachedCollectionItem[] {
  const byMint = new Map<string, CachedCollectionItem>();

  for (const item of [...left, ...right]) {
    const existing = byMint.get(item.mint);
    if (!existing) {
      byMint.set(item.mint, item);
      continue;
    }

    byMint.set(item.mint, {
      mint: item.mint,
      number: existing.number || item.number,
      verified: existing.verified || item.verified,
    });
  }

  return [...byMint.values()].sort((a, b) => a.number - b.number);
}

export function mintedNumbersFromRecords(
  items: readonly CachedCollectionItem[],
  drafts: readonly StudioDraft[],
  discovered: readonly DiscoveredCollectionItem[] = []
): number[] {
  const fromChainCache = items.map((item) => item.number);
  const fromMintedDrafts = drafts
    .filter((draft) => hasOnChainMintProof(draft))
    .map((draft) => draft.number);
  const fromDiscovered = discovered
    .map((item) => item.number)
    .filter((n): n is number => n !== null);

  return [...new Set([...fromChainCache, ...fromMintedDrafts, ...fromDiscovered])];
}

export function usedNumbersForContinue(
  items: readonly CachedCollectionItem[],
  drafts: readonly StudioDraft[],
  discovered: readonly DiscoveredCollectionItem[] = []
): number[] {
  return usedNumbersFromDraftsAndMinted(
    mintedNumbersFromRecords(items, drafts, discovered),
    drafts
  );
}

export function usedItemNames(
  drafts: readonly StudioDraft[],
  discovered: readonly DiscoveredCollectionItem[]
): string[] {
  return [
    ...drafts.map((draft) => draft.name.trim()),
    ...discovered.map((item) => item.name.trim()),
  ].filter(Boolean);
}

export function nextNumberForExistingCollection(
  items: readonly CachedCollectionItem[],
  drafts: readonly StudioDraft[],
  numbering: StudioNumbering,
  discovered: readonly DiscoveredCollectionItem[] = []
): number | null {
  const usedNumbers = new Set(usedNumbersForContinue(items, drafts, discovered));
  const usedNames = new Set(usedItemNames(drafts, discovered).map((name) => name.toLowerCase()));
  const start = numbering.start;
  const last = numbering.start + numbering.plannedCapacity - 1;

  for (let n = start; n <= last; n += 1) {
    if (usedNumbers.has(n)) {
      continue;
    }

    const name = buildStudioItemName(numbering, n);
    if (usedNames.has(name.toLowerCase())) {
      continue;
    }

    return n;
  }

  return nextStudioItemNumber([...usedNumbers], numbering);
}

export function collectionProgress(params: {
  items: readonly CachedCollectionItem[];
  drafts: readonly StudioDraft[];
  discovery: CollectionItemDiscovery | null;
}): {
  prepared: number;
  minted: number | null;
  verified: number | null;
  numberingBlocked: boolean;
  discoveryError: string | null;
} {
  const prepared = params.drafts.filter(
    (draft) => isPreparedDraft(draft.status) && !draft.mintAddress
  ).length;

  if (!params.discovery) {
    return {
      prepared,
      minted: null,
      verified: null,
      numberingBlocked: true,
      discoveryError: COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
    };
  }

  if (!params.discovery.ok) {
    return {
      prepared,
      minted: null,
      verified: null,
      numberingBlocked: true,
      discoveryError: params.discovery.error,
    };
  }

  const discovered = params.discovery.items;
  const mintedMints = new Set<string>();
  const verifiedMints = new Set<string>();

  for (const item of discovered) {
    mintedMints.add(item.mint);
    if (item.collectionVerified === true) {
      verifiedMints.add(item.mint);
    }
  }

  for (const item of params.items) {
    mintedMints.add(item.mint);
    if (item.verified) {
      verifiedMints.add(item.mint);
    }
  }

  for (const draft of params.drafts) {
    if (draft.mintAddress && mintedMints.has(draft.mintAddress)) {
      if (draft.status === 'collection_verified') {
        verifiedMints.add(draft.mintAddress);
      }
    }
  }

  return {
    prepared,
    minted: mintedMints.size,
    verified: verifiedMints.size,
    numberingBlocked: false,
    discoveryError: null,
  };
}

function namesMatch(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return Boolean(a) && a === b;
}

export function discoveredItemCorroboratesDraft(
  draft: Pick<StudioDraft, 'mintAddress' | 'number' | 'name'>,
  discovered: readonly DiscoveredCollectionItem[]
): boolean {
  const mint = draft.mintAddress?.trim() || null;

  return discovered.some((item) => {
    if (mint && item.mint === mint) {
      return true;
    }

    if (item.number !== null && item.number === draft.number) {
      return true;
    }

    return namesMatch(item.name, draft.name);
  });
}

function resolveRecoverOptions(
  nowOrOptions: number | RecoverDraftOptions | undefined
): { now: number; mintAccountPresence: RecoverDraftOptions['mintAccountPresence'] } {
  if (typeof nowOrOptions === 'number' || nowOrOptions === undefined) {
    return {
      now: typeof nowOrOptions === 'number' ? nowOrOptions : Date.now(),
      mintAccountPresence: undefined,
    };
  }

  return {
    now: nowOrOptions.now ?? Date.now(),
    mintAccountPresence: nowOrOptions.mintAccountPresence,
  };
}

function draftAwaitingIndexing(draft: StudioDraft, now: number): StudioDraft {
  if (draft.status === 'mint_submitted' && hasOnChainMintProof(draft)) {
    return draft;
  }

  return {
    ...draft,
    status: 'mint_submitted',
    updatedAt: now,
  };
}

export function draftAwaitingCollectionIndexing(
  draft: Pick<StudioDraft, 'status' | 'mintAddress' | 'mintSignature' | 'number' | 'name'>,
  discovered: readonly DiscoveredCollectionItem[]
): boolean {
  return (
    isNumberLocked(draft.status) &&
    hasOnChainMintProof(draft) &&
    !discoveredItemCorroboratesDraft(draft, discovered)
  );
}

export function recoverDraftAgainstDiscoveredItems(
  draft: StudioDraft,
  discovered: readonly DiscoveredCollectionItem[],
  nowOrOptions: number | RecoverDraftOptions = Date.now()
): StudioDraft {
  const { now, mintAccountPresence } = resolveRecoverOptions(nowOrOptions);

  if (discoveredItemCorroboratesDraft(draft, discovered)) {
    return draft;
  }

  if (!hasOnChainMintProof(draft) && !isNumberLocked(draft.status)) {
    return draft;
  }

  const mint = draft.mintAddress?.trim() || '';
  const presence = mint && mintAccountPresence ? mintAccountPresence(mint) : null;
  const signatureOnlyProof = !mint && Boolean(draft.mintSignature?.trim());

  if (presence === 'exists' || presence === 'unknown' || signatureOnlyProof) {
    return draftAwaitingIndexing(draft, now);
  }

  const staleMintAddress = draft.mintAddress ?? draft.staleMintAddress ?? null;
  const staleMintSignature = draft.mintSignature ?? draft.staleMintSignature ?? null;

  if (
    draft.status === 'failed' &&
    draft.mintAddress === null &&
    (draft.mintSignature ?? null) === null &&
    (draft.staleMintAddress ?? null) === (staleMintAddress ?? null) &&
    (draft.staleMintSignature ?? null) === (staleMintSignature ?? null)
  ) {
    return draft;
  }

  return {
    ...draft,
    status: 'failed',
    mintAddress: null,
    mintSignature: null,
    staleMintAddress,
    staleMintSignature,
    updatedAt: now,
  };
}

export function recoverDraftsAgainstDiscoveredItems(
  drafts: readonly StudioDraft[],
  discovered: readonly DiscoveredCollectionItem[],
  nowOrOptions: number | RecoverDraftOptions = Date.now()
): StudioDraft[] {
  return drafts.map((draft) => recoverDraftAgainstDiscoveredItems(draft, discovered, nowOrOptions));
}

export function draftRecoveryChanged(before: StudioDraft, after: StudioDraft): boolean {
  return (
    before.status !== after.status ||
    before.mintAddress !== after.mintAddress ||
    (before.mintSignature ?? null) !== (after.mintSignature ?? null) ||
    (before.staleMintAddress ?? null) !== (after.staleMintAddress ?? null) ||
    (before.staleMintSignature ?? null) !== (after.staleMintSignature ?? null)
  );
}

function draftRepresentedByDiscovered(
  draft: StudioDraft,
  listedMints: ReadonlySet<string>,
  discovered: readonly DiscoveredCollectionItem[]
): boolean {
  if (draft.mintAddress && listedMints.has(draft.mintAddress)) {
    return true;
  }

  return discoveredItemCorroboratesDraft(draft, discovered);
}

export function duplicateMintBlocked(draft: StudioDraft): { blocked: true; reason: string } | { blocked: false } {
  if (hasOnChainMintProof(draft)) {
    return {
      blocked: true,
      reason: draft.mintAddress
        ? 'This item already has a mint address. It will not be minted again.'
        : 'This item was already submitted. Check the explorer before doing anything else.',
    };
  }

  return { blocked: false };
}

export function addItemDraftToExistingCollection(params: {
  collection: CachedCollection;
  existingDrafts: readonly StudioDraft[];
  numbering: StudioNumbering;
  defaults: StudioDefaults;
  discovery: CollectionItemDiscovery | null;
  now?: number;
}): StudioDraft | { error: string } {
  if (!params.collection.mint) {
    return { error: 'Open an existing collection before adding an item.' };
  }

  if (!params.discovery?.ok) {
    return {
      error: params.discovery?.error ?? COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
    };
  }

  const discovered = params.discovery.items;
  const number = nextNumberForExistingCollection(
    params.collection.items,
    params.existingDrafts,
    params.numbering,
    discovered
  );

  if (number === null) {
    return {
      error: `CBS planned capacity of ${params.numbering.plannedCapacity} items has been reached. This is not an on-chain maximum.`,
    };
  }

  const name = buildStudioItemName(params.numbering, number);
  const duplicateName = usedItemNames(params.existingDrafts, discovered).some(
    (existing) => existing.toLowerCase() === name.toLowerCase()
  );

  if (duplicateName) {
    return {
      error: `${name} already exists in this collection. A new NFT was not added.`,
    };
  }

  const sortIndex =
    params.existingDrafts.reduce((max, draft) => Math.max(max, draft.sortIndex), -1) + 1;

  return createStudioDraft({
    network: params.collection.network,
    collectionMint: params.collection.mint,
    collectionKey: collectionStudioKey(params.collection.network, params.collection.mint),
    number,
    numbering: params.numbering,
    defaults: params.defaults,
    artwork: null,
    sortIndex,
    now: params.now,
  });
}

export function emptyCollectionDiscovery(network: SolanaNetwork): CollectionItemDiscovery {
  return {
    ok: true,
    items: [],
    method: COLLECTION_ITEM_DISCOVERY_METHOD,
    readOnly: true,
    network,
  };
}

export function cachedItemsFromDiscovered(
  discovered: readonly DiscoveredCollectionItem[]
): CachedCollectionItem[] {
  return discovered.map((item) => ({
    mint: item.mint,
    number: item.number ?? 0,
    verified: item.collectionVerified === true,
  }));
}

export type ManagerListItem = {
  id: string;
  kind: 'on-chain' | 'local-draft';
  name: string;
  number: number | null;
  mintAddress: string | null;
  metadataUri: string | null;
  imageUri: string | null;
  collectionVerified: boolean | null;
  minted: boolean;
  tokenStandard: string | null;
  draft: StudioDraft | null;
};

export function mergeManagerListItems(params: {
  discovered: readonly DiscoveredCollectionItem[];
  drafts: readonly StudioDraft[];
  artworkPreviewUrls?: ReadonlyMap<string, string>;
  discoveryOk?: boolean;
  mintAccountPresence?: (mint: string) => MintAccountPresence;
}): ManagerListItem[] {
  const drafts =
    params.discoveryOk === true
      ? recoverDraftsAgainstDiscoveredItems(params.drafts, params.discovered, {
          mintAccountPresence: params.mintAccountPresence,
        })
      : params.drafts;
  const draftsByMint = new Map(
    drafts
      .filter((draft) => draft.mintAddress)
      .map((draft) => [draft.mintAddress as string, draft])
  );
  const listedMints = new Set<string>();
  const rows: ManagerListItem[] = [];

  for (const item of params.discovered) {
    listedMints.add(item.mint);
    const draft = draftsByMint.get(item.mint) ?? null;
    rows.push({
      id: draft?.id ?? `onchain:${item.mint}`,
      kind: 'on-chain',
      name: item.name,
      number: item.number ?? draft?.number ?? null,
      mintAddress: item.mint,
      metadataUri: item.metadataUri || null,
      imageUri: params.artworkPreviewUrls?.get(draft?.id ?? '') || item.imageUri,
      collectionVerified: item.collectionVerified,
      minted: true,
      tokenStandard: item.tokenStandard,
      draft,
    });
  }

  for (const draft of drafts) {
    if (draftRepresentedByDiscovered(draft, listedMints, params.discovered)) {
      continue;
    }

    rows.push({
      id: draft.id,
      kind: 'local-draft',
      name: draft.name,
      number: draft.number,
      mintAddress: draft.mintAddress,
      metadataUri: null,
      imageUri: params.artworkPreviewUrls?.get(draft.id) ?? null,
      collectionVerified: null,
      minted: hasOnChainMintProof(draft),
      tokenStandard: null,
      draft,
    });
  }

  return rows.sort((left, right) => {
    const leftNumber = left.number ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.number ?? Number.MAX_SAFE_INTEGER;
    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return left.name.localeCompare(right.name);
  });
}

export function snapshotFromCollection(
  collection: CachedCollection,
  numbering: StudioNumbering,
  defaults: StudioDefaults
): StudioSettings {
  return {
    collectionKey: collectionStudioKey(collection.network, collection.mint),
    numbering,
    defaults,
    collectionMint: collection.mint,
    network: collection.network,
    collectionName: collection.name,
    plannedCapacity: collection.plannedMaxItems,
    created: true,
    items: collection.items,
  };
}

export function collectionFromSnapshot(
  snapshot: StudioSettings,
  fallback: CachedCollection
): CachedCollection {
  if (snapshot.network && snapshot.network !== fallback.network) {
    return fallback;
  }

  return {
    ...fallback,
    mint: snapshot.collectionMint || fallback.mint,
    network: snapshot.network ?? fallback.network,
    name: snapshot.collectionName || fallback.name,
    plannedMaxItems: snapshot.plannedCapacity ?? fallback.plannedMaxItems,
    itemNamePrefix: snapshot.numbering?.baseName || fallback.itemNamePrefix,
    digitCount: snapshot.numbering?.digitCount || fallback.digitCount,
    startNumber: snapshot.numbering?.start || fallback.startNumber,
    items: mergeMintedItemRecords(fallback.items, snapshot.items ?? []),
  };
}

export function assertOpenCollectionNetwork(params: {
  collectionNetwork: SolanaNetwork;
  selectedNetwork: SolanaNetwork;
}): { ok: true } | { ok: false; error: string } {
  return assertCollectionNetworkMatch(params.collectionNetwork, params.selectedNetwork);
}

export function wrongNetworkCollectionMessage(
  collectionNetwork: SolanaNetwork,
  selectedNetwork: SolanaNetwork
): string {
  return `This collection is on ${networkDisplayName(collectionNetwork)}. The builder is set to ${networkDisplayName(selectedNetwork)}. Switch the network selector. The collection was not converted.`;
}

export function openingExistingCollectionCreatesCollectionNft(): false {
  return false;
}

export function addingItemDraftCreatesCollectionNft(): false {
  return false;
}

export function collectionCoverIsSeparateNft(): true {
  return true;
}

export function itemNumberDoesNotProveOnChainExistence(): true {
  return true;
}

export function plannedCapacityDescribedAsOnChainHardCap(): false {
  return false;
}

export function cachedCollectionFromSettings(settings: StudioSettings): CachedCollection | null {
  if (!settings.collectionMint || !settings.network || settings.created !== true) {
    return null;
  }

  return {
    mint: settings.collectionMint,
    network: settings.network,
    name: settings.collectionName || 'Collection',
    symbol: settings.defaults.symbol,
    plannedMaxItems: settings.plannedCapacity ?? settings.numbering.plannedCapacity,
    itemNamePrefix: settings.numbering.baseName,
    digitCount: settings.numbering.digitCount,
    startNumber: settings.numbering.start,
    commonDescription: settings.defaults.description,
    commonExternalUrl: settings.defaults.externalUrl,
    commonRoyaltyPercent: settings.defaults.royaltyPercent,
    commonAttributes: settings.defaults.attributes,
    isMutableDefault: settings.defaults.isMutable,
    items: settings.items ?? [],
  };
}

export function refuseCollectionOpenOnWrongNetwork(params: {
  selectedNetwork: SolanaNetwork;
  selectedCache: CachedCollection | null;
  otherCache: CachedCollection | null;
  selectedSettings: StudioSettings | null;
  otherSettings: StudioSettings | null;
}): { ok: true } | { ok: false; error: string } {
  const knownOnSelected =
    params.selectedCache?.network === params.selectedNetwork ||
    params.selectedSettings?.network === params.selectedNetwork;
  const otherNetwork = params.selectedNetwork === 'mainnet' ? 'devnet' : 'mainnet';
  const knownOnOther =
    params.otherCache?.network === otherNetwork ||
    params.otherSettings?.network === otherNetwork;

  if (knownOnOther && !knownOnSelected) {
    return {
      ok: false,
      error: wrongNetworkCollectionMessage(otherNetwork, params.selectedNetwork),
    };
  }

  return { ok: true };
}
