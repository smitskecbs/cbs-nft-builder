import type { SolanaNetwork } from './config';
import {
  fetchCollectionOnChain,
  type OnChainCollectionView,
} from './collectionOnChain';
import {
  defaultDasRpcPost,
  type DasAssetLike,
  type DasRpcPost,
} from './discoverCollectionItems';

export const MANAGED_COLLECTION_DISCOVERY_METHOD = 'searchAssets' as const;

export const MANAGED_COLLECTION_DISCOVERY_FAILURE_MESSAGE =
  'Could not load collections for this wallet. You can still open a collection by address.';

const DAS_PAGE_LIMIT = 1000;
const DAS_MAX_PAGES = 5;
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

export type ManagedCollectionSummary = {
  mint: string;
  name: string;
  imageUri: string | null;
  updateAuthority: string;
  network: SolanaNetwork;
};

export type ManagedCollectionDiscovery =
  | {
      ok: true;
      collections: ManagedCollectionSummary[];
      method: typeof MANAGED_COLLECTION_DISCOVERY_METHOD;
      readOnly: true;
      network: SolanaNetwork;
    }
  | {
      ok: false;
      error: string;
      method: typeof MANAGED_COLLECTION_DISCOVERY_METHOD;
      readOnly: true;
      network: SolanaNetwork;
    };

export type FetchCollectionOnChainFn = (
  network: SolanaNetwork,
  mintAddress: string
) => Promise<OnChainCollectionView>;

export type DasManagedCollectionCandidate = {
  mint: string;
  name: string;
  imageUri: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function jsonRpcItemCount(payload: unknown): number {
  const root = asRecord(payload);
  const result = asRecord(root?.result);
  const items = result?.items;
  return Array.isArray(items) ? items.length : 0;
}

export function buildSearchAssetsByAuthorityRequest(params: {
  authorityAddress: string;
  page: number;
  limit?: number;
}): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: 'cbs-nft-builder-managed-collections',
    method: MANAGED_COLLECTION_DISCOVERY_METHOD,
    params: {
      authorityAddress: params.authorityAddress,
      page: params.page,
      limit: params.limit ?? DAS_PAGE_LIMIT,
      options: {
        showUnverifiedCollections: true,
        showCollectionMetadata: true,
      },
    },
  };
}

export function dasAssetIsCollectionMemberOfOtherMint(asset: DasAssetLike): boolean {
  const mint = stringOrEmpty(asset.id);
  const groups = Array.isArray(asset.grouping) ? asset.grouping : [];

  return groups.some((group) => {
    if (stringOrEmpty(group.group_key) !== 'collection') {
      return false;
    }

    const collectionMint = stringOrEmpty(group.group_value);
    return Boolean(collectionMint) && collectionMint !== mint;
  });
}

function dasImageUri(asset: DasAssetLike): string | null {
  const image = stringOrEmpty(asset.content?.links?.image) || stringOrEmpty(asset.content?.files?.[0]?.uri);
  return image || null;
}

export function parseDasManagedCollectionCandidate(
  raw: unknown,
  authorityAddress: string
): DasManagedCollectionCandidate | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const asset = raw as DasAssetLike;
  const mint = stringOrEmpty(asset.id);
  const wallet = authorityAddress.trim();

  if (!mint || !wallet || asset.burnt === true) {
    return null;
  }

  const iface = stringOrEmpty(asset.interface);
  if (SKIP_INTERFACES.has(iface)) {
    return null;
  }

  if (iface && !NFT_INTERFACES.has(iface) && iface !== '') {
    return null;
  }

  if (dasAssetIsCollectionMemberOfOtherMint(asset)) {
    return null;
  }

  const authorities = Array.isArray(asset.authorities) ? asset.authorities : [];
  if (authorities.length > 0) {
    const matchesAuthority = authorities.some(
      (entry) => stringOrEmpty(entry.address) === wallet
    );
    if (!matchesAuthority) {
      return null;
    }
  }

  return {
    mint,
    name: stringOrEmpty(asset.content?.metadata?.name) || mint,
    imageUri: dasImageUri(asset),
  };
}

export function parseDasManagedCollectionPage(
  payload: unknown,
  authorityAddress: string
): DasManagedCollectionCandidate[] {
  const root = asRecord(payload);
  if (!root) {
    throw new Error(MANAGED_COLLECTION_DISCOVERY_FAILURE_MESSAGE);
  }

  if (root.error) {
    throw new Error(MANAGED_COLLECTION_DISCOVERY_FAILURE_MESSAGE);
  }

  const result = asRecord(root.result);
  if (!result || !Array.isArray(result.items)) {
    throw new Error(MANAGED_COLLECTION_DISCOVERY_FAILURE_MESSAGE);
  }

  return result.items
    .map((item) => parseDasManagedCollectionCandidate(item, authorityAddress))
    .filter((item): item is DasManagedCollectionCandidate => item !== null);
}

function confirmManagedCollection(
  view: OnChainCollectionView,
  walletAddress: string
): boolean {
  return view.isCollection === true && view.updateAuthority === walletAddress.trim();
}

export async function discoverManagedCollections(params: {
  network: SolanaNetwork;
  walletAddress: string;
  rpcPost?: DasRpcPost;
  fetchCollection?: FetchCollectionOnChainFn;
}): Promise<ManagedCollectionDiscovery> {
  const walletAddress = params.walletAddress.trim();
  const rpcPost = params.rpcPost ?? defaultDasRpcPost;
  const fetchCollection = params.fetchCollection ?? fetchCollectionOnChain;

  if (!walletAddress) {
    return {
      ok: true,
      collections: [],
      method: MANAGED_COLLECTION_DISCOVERY_METHOD,
      readOnly: true,
      network: params.network,
    };
  }

  try {
    const candidates: DasManagedCollectionCandidate[] = [];

    for (let page = 1; page <= DAS_MAX_PAGES; page += 1) {
      const payload = await rpcPost(
        params.network,
        buildSearchAssetsByAuthorityRequest({
          authorityAddress: walletAddress,
          page,
        })
      );
      candidates.push(...parseDasManagedCollectionPage(payload, walletAddress));

      if (jsonRpcItemCount(payload) < DAS_PAGE_LIMIT) {
        break;
      }
    }

    const unique = new Map<string, DasManagedCollectionCandidate>();
    for (const candidate of candidates) {
      unique.set(candidate.mint, candidate);
    }

    const collections: ManagedCollectionSummary[] = [];

    for (const candidate of unique.values()) {
      try {
        const view = await fetchCollection(params.network, candidate.mint);
        if (!confirmManagedCollection(view, walletAddress)) {
          continue;
        }

        collections.push({
          mint: view.mint,
          name: view.name || candidate.name,
          imageUri: candidate.imageUri,
          updateAuthority: view.updateAuthority,
          network: params.network,
        });
      } catch {
        // Skip assets that are not readable collection NFTs.
      }
    }

    collections.sort((left, right) => left.name.localeCompare(right.name));

    return {
      ok: true,
      collections,
      method: MANAGED_COLLECTION_DISCOVERY_METHOD,
      readOnly: true,
      network: params.network,
    };
  } catch {
    return {
      ok: false,
      error: MANAGED_COLLECTION_DISCOVERY_FAILURE_MESSAGE,
      method: MANAGED_COLLECTION_DISCOVERY_METHOD,
      readOnly: true,
      network: params.network,
    };
  }
}
