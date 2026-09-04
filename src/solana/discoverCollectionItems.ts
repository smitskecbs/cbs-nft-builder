import { extractStudioItemNumberFromName } from '../studio/numbering';
import { fetchExistingNftSnapshot } from './collectionOnChain';
import type { SolanaNetwork } from './config';
import { getRpc } from './config';

export const COLLECTION_ITEM_DISCOVERY_METHOD = 'getAssetsByGroup' as const;

export const COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE =
  'Unable to load existing collection items. New item numbering is disabled until collection discovery succeeds.';

export const DISCOVERY_INCOMPLETE_MESSAGE =
  'Collection metadata reports more verified items than discovery returned. New item numbering is disabled until the full item list is loaded.';

const DAS_PAGE_LIMIT = 1000;
const DAS_MAX_PAGES = 20;
const NFT_INTERFACES = new Set([
  'V1_NFT',
  'V2_NFT',
  'LEGACY_NFT',
  'ProgrammableNFT',
  'Custom',
]);
const SKIP_INTERFACES = new Set([
  'FungibleAsset',
  'FungibleToken',
  'MplCoreCollection',
  'MplCoreGroup',
  'Executable',
  'Identity',
]);

export type DiscoveredCollectionItem = {
  mint: string;
  name: string;
  metadataUri: string;
  imageUri: string | null;
  collectionKey: string;
  collectionVerified: boolean | null;
  tokenStandard: string | null;
  number: number | null;
};

export type CollectionItemDiscovery =
  | {
      ok: true;
      items: DiscoveredCollectionItem[];
      method: typeof COLLECTION_ITEM_DISCOVERY_METHOD;
      readOnly: true;
      network: SolanaNetwork;
    }
  | {
      ok: false;
      error: string;
      method: typeof COLLECTION_ITEM_DISCOVERY_METHOD;
      readOnly: true;
      network: SolanaNetwork;
    };

export type DasRpcPost = (
  network: SolanaNetwork,
  body: Record<string, unknown>
) => Promise<unknown>;

export type DasAssetLike = {
  id?: unknown;
  interface?: unknown;
  content?: {
    json_uri?: unknown;
    metadata?: { name?: unknown; symbol?: unknown };
    links?: { image?: unknown };
    files?: Array<{ uri?: unknown }>;
  };
  grouping?: Array<{
    group_key?: unknown;
    group_value?: unknown;
    verified?: unknown;
  }>;
  token_info?: { token_standard?: unknown };
  burnt?: unknown;
};

type DasPageResult = {
  items?: unknown;
  total?: unknown;
};

export function discoveryRequestIsReadOnly(method: string): boolean {
  return (
    method === COLLECTION_ITEM_DISCOVERY_METHOD &&
    !/send|sign|mint|create/i.test(method)
  );
}

export function buildGetAssetsByGroupRequest(params: {
  collectionMint: string;
  page: number;
  limit?: number;
}): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: 'cbs-nft-builder-collection-items',
    method: COLLECTION_ITEM_DISCOVERY_METHOD,
    params: {
      groupKey: 'collection',
      groupValue: params.collectionMint,
      page: params.page,
      limit: params.limit ?? DAS_PAGE_LIMIT,
      options: {
        showUnverifiedCollections: true,
        showCollectionMetadata: false,
      },
    },
  };
}

export async function defaultDasRpcPost(
  network: SolanaNetwork,
  body: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(getRpc(network), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Collection item discovery failed (${response.status}).`);
  }

  return response.json();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function httpsOrNull(value: unknown): string | null {
  const text = stringOrEmpty(value);
  if (!text) {
    return null;
  }

  if (text.startsWith('https://') || text.startsWith('http://')) {
    return text;
  }

  return null;
}

export function tokenStandardFromDasInterface(value: unknown): string | null {
  if (value === 'V1_NFT' || value === 'V2_NFT' || value === 'LEGACY_NFT') {
    return 'NonFungible';
  }

  if (value === 'ProgrammableNFT') {
    return 'ProgrammableNonFungible';
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return null;
}

export function parseDasCollectionAsset(
  raw: unknown,
  collectionMint: string
): DiscoveredCollectionItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const asset = raw as DasAssetLike;
  const mint = stringOrEmpty(asset.id);

  if (!mint || mint === collectionMint) {
    return null;
  }

  if (asset.burnt === true) {
    return null;
  }

  const iface = stringOrEmpty(asset.interface);
  if (SKIP_INTERFACES.has(iface)) {
    return null;
  }

  if (iface && !NFT_INTERFACES.has(iface) && iface !== '') {
    return null;
  }

  const groups = Array.isArray(asset.grouping) ? asset.grouping : [];
  const match = groups.find(
    (group) =>
      stringOrEmpty(group.group_key) === 'collection' &&
      stringOrEmpty(group.group_value) === collectionMint
  );

  if (!match) {
    return null;
  }

  const name = stringOrEmpty(asset.content?.metadata?.name) || mint;
  const metadataUri = stringOrEmpty(asset.content?.json_uri);
  const imageUri =
    httpsOrNull(asset.content?.links?.image) ??
    httpsOrNull(asset.content?.files?.[0]?.uri);
  const verified =
    typeof match.verified === 'boolean'
      ? match.verified
      : null;

  return {
    mint,
    name,
    metadataUri,
    imageUri,
    collectionKey: collectionMint,
    collectionVerified: verified,
    tokenStandard:
      tokenStandardFromDasInterface(asset.interface) ??
      tokenStandardFromDasInterface(asset.token_info?.token_standard),
    number: extractStudioItemNumberFromName(name),
  };
}

export function parseDasCollectionPage(
  payload: unknown,
  collectionMint: string
): DiscoveredCollectionItem[] {
  const root = asRecord(payload);
  if (!root) {
    throw new Error(COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE);
  }

  if (root.error) {
    throw new Error(COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE);
  }

  const result = asRecord(root.result) as DasPageResult | null;
  if (!result || !Array.isArray(result.items)) {
    throw new Error(COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE);
  }

  return result.items
    .map((item) => parseDasCollectionAsset(item, collectionMint))
    .filter((item): item is DiscoveredCollectionItem => item !== null);
}

export function assertDiscoveryCoversVerifiedSize(params: {
  discoveredCount: number;
  onChainVerifiedSize: number | null;
}): { ok: true } | { ok: false; error: string } {
  if (
    params.onChainVerifiedSize !== null &&
    params.onChainVerifiedSize > 0 &&
    params.discoveredCount < params.onChainVerifiedSize
  ) {
    return { ok: false, error: DISCOVERY_INCOMPLETE_MESSAGE };
  }

  return { ok: true };
}

async function hydrateVerifiedFromChain(
  network: SolanaNetwork,
  collectionMint: string,
  items: DiscoveredCollectionItem[]
): Promise<DiscoveredCollectionItem[]> {
  const hydrated: DiscoveredCollectionItem[] = [];

  for (const item of items) {
    if (item.collectionVerified !== null) {
      hydrated.push(item);
      continue;
    }

    try {
      const snapshot = await fetchExistingNftSnapshot(network, item.mint);
      if (snapshot.collectionKey !== collectionMint) {
        continue;
      }

      hydrated.push({
        ...item,
        name: snapshot.name || item.name,
        collectionVerified: snapshot.collectionVerified,
        tokenStandard: snapshot.tokenStandard ?? item.tokenStandard,
        number: extractStudioItemNumberFromName(snapshot.name || item.name),
      });
    } catch {
      hydrated.push(item);
    }
  }

  return hydrated;
}

function jsonRpcItemCount(payload: unknown): number {
  const root = asRecord(payload);
  const result = asRecord(root?.result);
  const items = result?.items;
  return Array.isArray(items) ? items.length : 0;
}

export async function discoverCollectionItems(params: {
  network: SolanaNetwork;
  collectionMint: string;
  onChainVerifiedSize?: number | null;
  rpcPost?: DasRpcPost;
}): Promise<CollectionItemDiscovery> {
  const rpcPost = params.rpcPost ?? defaultDasRpcPost;
  const collected: DiscoveredCollectionItem[] = [];

  try {
    for (let page = 1; page <= DAS_MAX_PAGES; page += 1) {
      const body = buildGetAssetsByGroupRequest({
        collectionMint: params.collectionMint,
        page,
      });
      const payload = await rpcPost(params.network, body);
      const pageItems = parseDasCollectionPage(payload, params.collectionMint);
      collected.push(...pageItems);

      if (jsonRpcItemCount(payload) < DAS_PAGE_LIMIT) {
        break;
      }
    }

    const byMint = new Map<string, DiscoveredCollectionItem>();
    for (const item of collected) {
      byMint.set(item.mint, item);
    }

    let items = [...byMint.values()].sort((left, right) => {
      const leftNumber = left.number ?? Number.MAX_SAFE_INTEGER;
      const rightNumber = right.number ?? Number.MAX_SAFE_INTEGER;
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }

      return left.name.localeCompare(right.name);
    });

    if (!params.rpcPost) {
      items = await hydrateVerifiedFromChain(params.network, params.collectionMint, items);
    }

    const coverage = assertDiscoveryCoversVerifiedSize({
      discoveredCount: items.length,
      onChainVerifiedSize: params.onChainVerifiedSize ?? null,
    });

    if (!coverage.ok) {
      return {
        ok: false,
        error: coverage.error,
        method: COLLECTION_ITEM_DISCOVERY_METHOD,
        readOnly: true,
        network: params.network,
      };
    }

    return {
      ok: true,
      items,
      method: COLLECTION_ITEM_DISCOVERY_METHOD,
      readOnly: true,
      network: params.network,
    };
  } catch {
    return {
      ok: false,
      error: COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
      method: COLLECTION_ITEM_DISCOVERY_METHOD,
      readOnly: true,
      network: params.network,
    };
  }
}
