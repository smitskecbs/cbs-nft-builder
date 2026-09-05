import type { SolanaNetwork } from '../solana/config';
import type { NftAttribute } from '../validation/attributes';
import {
  AUTO_OPEN_LAST_COLLECTION,
  DEFAULT_DIGIT_COUNT,
  DEFAULT_PLANNED_CAPACITY,
  DEFAULT_START_NUMBER,
  LAST_OPENED_COLLECTION_STORAGE_PREFIX,
  RECENT_COLLECTIONS_STORAGE_PREFIX,
} from './constants';

export { AUTO_OPEN_LAST_COLLECTION };

export type CachedCollectionItem = {
  mint: string;
  number: number;
  verified: boolean;
};

export type CachedCollection = {
  mint: string;
  network: SolanaNetwork;
  name: string;
  symbol: string;
  plannedMaxItems: number;
  itemNamePrefix: string;
  digitCount: number;
  startNumber: number;
  commonDescription: string;
  commonExternalUrl: string;
  commonRoyaltyPercent: number;
  commonAttributes: NftAttribute[];
  isMutableDefault: boolean;
  items: CachedCollectionItem[];
};

function storageKey(network: SolanaNetwork): string {
  return `${RECENT_COLLECTIONS_STORAGE_PREFIX}.${network}`;
}

function lastOpenedStorageKey(network: SolanaNetwork): string {
  return `${LAST_OPENED_COLLECTION_STORAGE_PREFIX}.${network}`;
}

export function oppositeNetwork(network: SolanaNetwork): SolanaNetwork {
  return network === 'mainnet' ? 'devnet' : 'mainnet';
}

function asAttribute(value: unknown): NftAttribute | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as NftAttribute;

  if (typeof record.trait_type !== 'string' || typeof record.value !== 'string') {
    return null;
  }

  return { trait_type: record.trait_type, value: record.value };
}

function normalizeCachedCollection(value: unknown): CachedCollection | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<CachedCollection> & { mint?: string; network?: string };

  if (
    typeof record.mint !== 'string' ||
    (record.network !== 'devnet' && record.network !== 'mainnet') ||
    typeof record.name !== 'string' ||
    !Array.isArray(record.items)
  ) {
    return null;
  }

  return {
    mint: record.mint,
    network: record.network,
    name: record.name,
    symbol: typeof record.symbol === 'string' ? record.symbol : '',
    plannedMaxItems:
      typeof record.plannedMaxItems === 'number' && record.plannedMaxItems > 0
        ? record.plannedMaxItems
        : DEFAULT_PLANNED_CAPACITY,
    itemNamePrefix: typeof record.itemNamePrefix === 'string' ? record.itemNamePrefix : record.name,
    digitCount:
      typeof record.digitCount === 'number' && record.digitCount > 0
        ? record.digitCount
        : DEFAULT_DIGIT_COUNT,
    startNumber:
      typeof record.startNumber === 'number' && record.startNumber > 0
        ? record.startNumber
        : DEFAULT_START_NUMBER,
    commonDescription: typeof record.commonDescription === 'string' ? record.commonDescription : '',
    commonExternalUrl: typeof record.commonExternalUrl === 'string' ? record.commonExternalUrl : '',
    commonRoyaltyPercent:
      typeof record.commonRoyaltyPercent === 'number' ? record.commonRoyaltyPercent : 0,
    commonAttributes: Array.isArray(record.commonAttributes)
      ? record.commonAttributes.map(asAttribute).filter((item): item is NftAttribute => item !== null)
      : [],
    isMutableDefault: record.isMutableDefault !== false,
    items: record.items.filter(
      (item): item is CachedCollectionItem =>
        !!item &&
        typeof item.mint === 'string' &&
        typeof item.number === 'number' &&
        typeof item.verified === 'boolean'
    ),
  };
}

export function loadRecentCollections(network: SolanaNetwork): CachedCollection[] {
  try {
    const raw = localStorage.getItem(storageKey(network));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeCachedCollection)
      .filter((item): item is CachedCollection => item !== null && item.network === network);
  } catch {
    return [];
  }
}

export function saveRecentCollections(
  network: SolanaNetwork,
  collections: CachedCollection[]
): void {
  const filtered = collections.filter((item) => item.network === network);

  try {
    localStorage.setItem(storageKey(network), JSON.stringify(filtered));
  } catch {
    // Convenience cache only. Draft artwork lives in IndexedDB.
  }
}

export function upsertRecentCollection(
  network: SolanaNetwork,
  collection: CachedCollection
): CachedCollection[] {
  if (collection.network !== network) {
    throw new Error('Collection network does not match the selected network.');
  }

  const existing = loadRecentCollections(network).filter(
    (item) => item.mint !== collection.mint
  );
  const next = [collection, ...existing];
  saveRecentCollections(network, next);
  return next;
}

export function findCachedCollection(
  network: SolanaNetwork,
  mint: string
): CachedCollection | null {
  return (
    loadRecentCollections(network).find((item) => item.mint === mint) ?? null
  );
}

export function findCachedCollectionOnOtherNetwork(
  selectedNetwork: SolanaNetwork,
  mint: string
): CachedCollection | null {
  return findCachedCollection(oppositeNetwork(selectedNetwork), mint);
}

export function loadLastOpenedCollectionMint(network: SolanaNetwork): string | null {
  try {
    const value = localStorage.getItem(lastOpenedStorageKey(network));
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function saveLastOpenedCollectionMint(network: SolanaNetwork, mint: string): void {
  try {
    localStorage.setItem(lastOpenedStorageKey(network), mint);
  } catch {
    // Convenience pointer only. Collection identity lives in Recent Collections and IndexedDB.
  }
}

export function clearLastOpenedCollectionMint(network: SolanaNetwork): void {
  try {
    localStorage.removeItem(lastOpenedStorageKey(network));
  } catch {
    // Ignore storage failures.
  }
}

export function recordCachedItem(
  network: SolanaNetwork,
  collectionMint: string,
  item: CachedCollectionItem
): CachedCollection | null {
  const collection = findCachedCollection(network, collectionMint);

  if (!collection) {
    return null;
  }

  const items = collection.items.filter((entry) => entry.mint !== item.mint);
  items.push(item);
  items.sort((a, b) => a.number - b.number);

  const updated = { ...collection, items };
  upsertRecentCollection(network, updated);
  return updated;
}
