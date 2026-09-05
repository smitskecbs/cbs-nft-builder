import { describe, expect, it, vi } from 'vitest';

import type { OnChainCollectionView } from './collectionOnChain';
import type { DasAssetLike } from './discoverCollectionItems';
import {
  MANAGED_COLLECTION_DISCOVERY_METHOD,
  buildSearchAssetsByAuthorityRequest,
  dasAssetIsCollectionMemberOfOtherMint,
  discoverManagedCollections,
  parseDasManagedCollectionCandidate,
} from './discoverManagedCollections';
import {
  renderManagedCollectionsMarkup,
  YOUR_COLLECTIONS_NONE_FOUND,
  YOUR_COLLECTIONS_WALLET_DISCONNECTED,
} from '../ui/collectionViews';
import { renderAppMarkup } from '../ui/renderApp';
import { AUTO_OPEN_LAST_COLLECTION } from '../collection/constants';

const WALLET = 'WalletUpdate1111111111111111111111111111';
const COLLECTION_MINT = 'CollectionCover11111111111111111111111111';
const ITEM_MINT = 'CollectionItem111111111111111111111111111';
const STANDALONE_MINT = 'StandaloneNft111111111111111111111111111';

function dasAsset(params: {
  mint: string;
  name: string;
  authority?: string;
  collection?: string;
  iface?: string;
  burnt?: boolean;
  image?: string;
}): DasAssetLike {
  return {
    id: params.mint,
    interface: params.iface ?? 'V1_NFT',
    content: {
      json_uri: `https://example.com/${params.mint}.json`,
      metadata: { name: params.name, symbol: 'TEST' },
      links: { image: params.image ?? 'https://example.com/cover.png' },
    },
    authorities: [{ address: params.authority ?? WALLET, scopes: ['full'] }],
    grouping: params.collection
      ? [{ group_key: 'collection', group_value: params.collection, verified: true }]
      : [],
    burnt: params.burnt ?? false,
  };
}

function page(items: DasAssetLike[]) {
  return {
    jsonrpc: '2.0',
    result: {
      total: items.length,
      limit: 1000,
      page: 1,
      items,
    },
  };
}

function collectionView(params: Partial<OnChainCollectionView> = {}): OnChainCollectionView {
  return {
    mint: COLLECTION_MINT,
    name: 'Cats Collection',
    symbol: 'CATS',
    uri: 'https://example.com/collection.json',
    updateAuthority: WALLET,
    tokenStandard: 'NonFungible',
    isCollection: true,
    collectionDetailsKind: 'V1',
    onChainVerifiedSize: 3,
    ...params,
  };
}

describe('managed collection discovery', () => {
  it('searches DAS by update authority rather than wallet ownership', () => {
    const body = buildSearchAssetsByAuthorityRequest({
      authorityAddress: WALLET,
      page: 1,
    });

    expect(body.method).toBe(MANAGED_COLLECTION_DISCOVERY_METHOD);
    expect(body.params).toMatchObject({
      authorityAddress: WALLET,
      page: 1,
    });
    expect(JSON.stringify(body)).not.toContain('ownerAddress');
    expect(JSON.stringify(body)).not.toContain('getAssetsByOwner');
  });

  it('drops ordinary collection items and keeps collection-cover candidates', () => {
    const cover = dasAsset({ mint: COLLECTION_MINT, name: 'Cats Collection' });
    const item = dasAsset({
      mint: ITEM_MINT,
      name: 'Cats #001',
      collection: COLLECTION_MINT,
    });
    const standalone = dasAsset({ mint: STANDALONE_MINT, name: 'Loose Cat' });

    expect(dasAssetIsCollectionMemberOfOtherMint(cover)).toBe(false);
    expect(dasAssetIsCollectionMemberOfOtherMint(item)).toBe(true);
    expect(parseDasManagedCollectionCandidate(cover, WALLET)?.mint).toBe(COLLECTION_MINT);
    expect(parseDasManagedCollectionCandidate(item, WALLET)).toBeNull();
    expect(parseDasManagedCollectionCandidate(standalone, WALLET)?.mint).toBe(STANDALONE_MINT);
    expect(parseDasManagedCollectionCandidate(dasAsset({ mint: 'Burnt', name: 'X', burnt: true }), WALLET)).toBeNull();
  });

  it('confirms candidates with on-chain collectionDetails and matching update authority', async () => {
    const fetchCollection = vi.fn(async (_network: 'devnet' | 'mainnet', mint: string) => {
      if (mint === COLLECTION_MINT) {
        return collectionView();
      }

      return collectionView({
        mint: STANDALONE_MINT,
        name: 'Loose Cat',
        isCollection: false,
        collectionDetailsKind: null,
        onChainVerifiedSize: null,
      });
    });

    const result = await discoverManagedCollections({
      network: 'mainnet',
      walletAddress: WALLET,
      rpcPost: async () =>
        page([
          dasAsset({ mint: COLLECTION_MINT, name: 'Cats Collection' }),
          dasAsset({
            mint: ITEM_MINT,
            name: 'Cats #001',
            collection: COLLECTION_MINT,
          }),
          dasAsset({ mint: STANDALONE_MINT, name: 'Loose Cat' }),
        ]),
      fetchCollection,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.collections.map((item) => item.mint)).toEqual([COLLECTION_MINT]);
    expect(result.collections[0]).toMatchObject({
      name: 'Cats Collection',
      updateAuthority: WALLET,
      network: 'mainnet',
    });
    expect(fetchCollection).toHaveBeenCalledWith('mainnet', COLLECTION_MINT);
    expect(fetchCollection).toHaveBeenCalledWith('mainnet', STANDALONE_MINT);
    expect(fetchCollection).not.toHaveBeenCalledWith('mainnet', ITEM_MINT);
  });

  it('does not treat a collection the wallet does not update as managed', async () => {
    const result = await discoverManagedCollections({
      network: 'mainnet',
      walletAddress: WALLET,
      rpcPost: async () => page([dasAsset({ mint: COLLECTION_MINT, name: 'Cats Collection' })]),
      fetchCollection: async () =>
        collectionView({
          updateAuthority: 'SomeoneElse111111111111111111111111111',
        }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.collections).toEqual([]);
  });
});

describe('managed collection cards', () => {
  it('renders beginner collection cards that reuse the open-collection mint attribute', () => {
    const html = renderManagedCollectionsMarkup([
      {
        mint: COLLECTION_MINT,
        name: 'Cats Collection',
        imageUri: 'https://example.com/cover.png',
        network: 'mainnet',
      },
    ]);

    expect(html).toContain('Cats Collection');
    expect(html).toContain('Mainnet');
    expect(html).toContain(`data-collection-mint="${COLLECTION_MINT}"`);
    expect(html).toContain('Open collection');
    expect(html).toContain('https://example.com/cover.png');
    expect(html).not.toContain('3M6W1vqH7c7gNdh7moLcN3HTcCffBn8ohVrx9aZFRGG2');
    expect(html).not.toContain('ManGo');
  });
});

describe('manage collection empty markup', () => {
  it('starts with an empty collection address and wallet empty state', () => {
    const html = renderAppMarkup();
    expect(html).toContain(YOUR_COLLECTIONS_WALLET_DISCONNECTED);
    expect(html).toContain('Recent collections');
    expect(html).toContain('They are not opened automatically');
    expect(YOUR_COLLECTIONS_NONE_FOUND).toContain('No collections found for this wallet.');
    expect(YOUR_COLLECTIONS_NONE_FOUND).toContain('You can still open a collection by address.');
    expect(AUTO_OPEN_LAST_COLLECTION).toBe(false);
    expect(html).not.toMatch(/id="openCollectionMint"[^>]*value="/);
  });
});
