import { describe, expect, it } from 'vitest';

import {
  COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
  COLLECTION_ITEM_DISCOVERY_METHOD,
  assertDiscoveryCoversVerifiedSize,
  buildGetAssetsByGroupRequest,
  discoverCollectionItems,
  discoveryRequestIsReadOnly,
  parseDasCollectionAsset,
  parseDasCollectionPage,
  type DasAssetLike,
  type DiscoveredCollectionItem,
} from './discoverCollectionItems';
import { defaultStudioDefaults } from '../studio/defaults';
import { addItemDraftToExistingCollection, collectionProgress, mergeManagerListItems } from '../studio/resume';
import { defaultStudioNumbering } from '../studio/numbering';
import { managerHasMintAll } from '../studio/itemMint';
import { renderCollectionManagerMarkup, renderManagerItemListMarkup } from '../ui/collectionViews';
import { studioCapacityView } from '../studio/capacity';

function mangoNumbering() {
  return defaultStudioNumbering({ baseName: 'ManGo Pixel' });
}

const COLLECTION = '3M6W1vgH7c7gNdh7moLcN3HTcCffBn8ohVrx9aZFRGG2';

function dasNft(params: {
  mint: string;
  name: string;
  collection: string;
  verified?: boolean;
  iface?: string;
  owner?: string;
  image?: string;
}): DasAssetLike {
  return {
    id: params.mint,
    interface: params.iface ?? 'V1_NFT',
    content: {
      json_uri: `https://example.com/${params.mint}.json`,
      metadata: { name: params.name, symbol: 'MANGO' },
      links: { image: params.image ?? 'https://example.com/pixel.png' },
    },
    grouping: [
      {
        group_key: 'collection',
        group_value: params.collection,
        verified: params.verified,
      },
    ],
    burnt: false,
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

function mangoItems(): DiscoveredCollectionItem[] {
  return [1, 2, 3, 4].map((n) => ({
    mint: `ItemMint00${n}`,
    name: `ManGo Pixel #00${n}`,
    metadataUri: `https://example.com/${n}.json`,
    imageUri: 'https://example.com/pixel.png',
    collectionKey: COLLECTION,
    collectionVerified: true,
    tokenStandard: 'NonFungible',
    number: n,
  }));
}

function collectionCache(items: Array<{ mint: string; number: number; verified: boolean }> = []) {
  return {
    mint: COLLECTION,
    network: 'mainnet' as const,
    name: 'ManGo Pixel Collection',
    symbol: 'MANGO',
    plannedMaxItems: 100,
    itemNamePrefix: 'ManGo Pixel',
    digitCount: 3,
    startNumber: 1,
    commonDescription: '',
    commonExternalUrl: '',
    commonRoyaltyPercent: 0,
    commonAttributes: [],
    isMutableDefault: true,
    items,
  };
}

describe('on-chain collection item discovery', () => {
  it('builds a read-only getAssetsByGroup request without owner or transaction fields', () => {
    const body = buildGetAssetsByGroupRequest({ collectionMint: COLLECTION, page: 1 });
    const json = JSON.stringify(body);

    expect(body.method).toBe(COLLECTION_ITEM_DISCOVERY_METHOD);
    expect(discoveryRequestIsReadOnly(String(body.method))).toBe(true);
    expect(json).not.toContain('sendTransaction');
    expect(json).not.toContain('ownerAddress');
    expect(json.toLowerCase()).not.toContain('signature');
    const params = body.params as { groupKey: string; groupValue: string; options: { showUnverifiedCollections: boolean } };
    expect(params.groupKey).toBe('collection');
    expect(params.groupValue).toBe(COLLECTION);
    expect(params.options.showUnverifiedCollections).toBe(true);
  });

  it('parses four verified items and ignores the wrong collection key and the collection mint itself', () => {
    const items = parseDasCollectionPage(
      page([
        dasNft({ mint: COLLECTION, name: 'ManGo Pixel Collection', collection: COLLECTION, verified: true }),
        dasNft({ mint: 'Item001', name: 'ManGo Pixel #001', collection: COLLECTION, verified: true, owner: 'WalletA' }),
        dasNft({ mint: 'Item002', name: 'ManGo Pixel #002', collection: COLLECTION, verified: true, owner: 'WalletB' }),
        dasNft({ mint: 'Item003', name: 'ManGo Pixel #003', collection: COLLECTION, verified: true }),
        dasNft({ mint: 'Item004', name: 'ManGo Pixel #004', collection: COLLECTION, verified: true }),
        dasNft({ mint: 'Other001', name: 'Other #001', collection: 'DifferentCollectionMint', verified: true }),
      ]),
      COLLECTION
    );

    expect(items.map((item) => item.name)).toEqual([
      'ManGo Pixel #001',
      'ManGo Pixel #002',
      'ManGo Pixel #003',
      'ManGo Pixel #004',
    ]);
    expect(items.every((item) => item.collectionKey === COLLECTION)).toBe(true);
    expect(items.every((item) => item.collectionVerified === true)).toBe(true);
    expect(items.find((item) => item.mint === 'Other001')).toBeUndefined();
  });

  it('counts a transferred NFT because discovery is collection-based, not owner-based', () => {
    const transferred = parseDasCollectionAsset(
      dasNft({
        mint: 'Item001',
        name: 'ManGo Pixel #001',
        collection: COLLECTION,
        verified: true,
        owner: 'SomeOtherWallet111',
      }),
      COLLECTION
    );

    expect(transferred?.mint).toBe('Item001');
    expect(transferred?.collectionVerified).toBe(true);
  });

  it('keeps unverified collection members separate from verified counts', () => {
    const discovered: DiscoveredCollectionItem[] = [
      ...mangoItems().slice(0, 3),
      {
        ...mangoItems()[3],
        collectionVerified: false,
      },
    ];
    const progress = collectionProgress({
      items: [],
      drafts: [],
      discovery: {
        ok: true,
        items: discovered,
        method: COLLECTION_ITEM_DISCOVERY_METHOD,
        readOnly: true,
        network: 'mainnet',
      },
    });

    expect(progress.minted).toBe(4);
    expect(progress.verified).toBe(3);
    expect(progress.prepared).toBe(0);
    expect(progress.numberingBlocked).toBe(false);
  });

  it('shows counters 4/4 with no local drafts and suggests #005', () => {
    const discovery = {
      ok: true as const,
      items: mangoItems(),
      method: COLLECTION_ITEM_DISCOVERY_METHOD,
      readOnly: true as const,
      network: 'mainnet' as const,
    };
    const progress = collectionProgress({
      items: [],
      drafts: [],
      discovery,
    });
    const created = addItemDraftToExistingCollection({
      collection: collectionCache(),
      existingDrafts: [],
      numbering: mangoNumbering(),
      defaults: defaultStudioDefaults({ symbol: 'MANGO' }),
      discovery,
    });

    expect(progress.minted).toBe(4);
    expect(progress.verified).toBe(4);
    expect(progress.prepared).toBe(0);
    expect('error' in created).toBe(false);
    if ('error' in created) {
      return;
    }
    expect(created.number).toBe(5);
    expect(created.name).toBe('ManGo Pixel #005');
    expect(created.mintAddress).toBeNull();
  });

  it('suggests #006 after a local #005 draft exists', () => {
    const discovery = {
      ok: true as const,
      items: mangoItems(),
      method: COLLECTION_ITEM_DISCOVERY_METHOD,
      readOnly: true as const,
      network: 'mainnet' as const,
    };
    const fifth = addItemDraftToExistingCollection({
      collection: collectionCache(),
      existingDrafts: [],
      numbering: mangoNumbering(),
      defaults: defaultStudioDefaults(),
      discovery,
    });
    expect('error' in fifth).toBe(false);
    if ('error' in fifth) {
      return;
    }

    const sixth = addItemDraftToExistingCollection({
      collection: collectionCache(),
      existingDrafts: [fifth],
      numbering: mangoNumbering(),
      defaults: defaultStudioDefaults(),
      discovery,
    });
    expect('error' in sixth).toBe(false);
    if ('error' in sixth) {
      return;
    }
    expect(sixth.number).toBe(6);
    expect(sixth.name).toBe('ManGo Pixel #006');
  });

  it('deduplicates on-chain items and local mint records by mint address', () => {
    const discovered = mangoItems();
    const localDraft = {
      id: 'draft-1',
      collectionKey: `mainnet:${COLLECTION}`,
      network: 'mainnet' as const,
      collectionMint: COLLECTION,
      number: 1,
      name: 'ManGo Pixel #001',
      status: 'collection_verified' as const,
      overrides: {},
      artwork: null,
      mintAddress: 'ItemMint001',
      sortIndex: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    const rows = mergeManagerListItems({
      discovered,
      drafts: [localDraft],
    });

    expect(rows.filter((row) => row.mintAddress === 'ItemMint001')).toHaveLength(1);
    expect(rows[0].kind).toBe('on-chain');
    expect(rows).toHaveLength(4);
  });

  it('blocks unsafe numbering when discovery fails', () => {
    const progress = collectionProgress({
      items: [],
      drafts: [],
      discovery: {
        ok: false,
        error: COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
        method: COLLECTION_ITEM_DISCOVERY_METHOD,
        readOnly: true,
        network: 'mainnet',
      },
    });
    const created = addItemDraftToExistingCollection({
      collection: collectionCache(),
      existingDrafts: [],
      numbering: mangoNumbering(),
      defaults: defaultStudioDefaults(),
      discovery: {
        ok: false,
        error: COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
        method: COLLECTION_ITEM_DISCOVERY_METHOD,
        readOnly: true,
        network: 'mainnet',
      },
    });

    expect(progress.minted).toBeNull();
    expect(progress.verified).toBeNull();
    expect(progress.numberingBlocked).toBe(true);
    expect('error' in created).toBe(true);
    if ('error' in created) {
      expect(created.error).toBe(COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE);
    }

    const html = renderCollectionManagerMarkup({
      cache: collectionCache(),
      onChain: null,
      capacity: studioCapacityView({
        plannedCapacity: 100,
        mintedCount: 0,
        verifiedCount: 0,
        drafts: [],
      }),
      nextNumberLabel: 'disabled',
      preparedCount: 0,
      mintedCount: null,
      verifiedCount: null,
      numberingBlocked: true,
      discoveryError: COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
    });
    expect(html).toContain(COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE);
    expect(html).toContain('id="addNftDraftButton" disabled');
  });

  it('treats incomplete discovery as failure when verified size is larger than found items', () => {
    expect(
      assertDiscoveryCoversVerifiedSize({ discoveredCount: 0, onChainVerifiedSize: 4 }).ok
    ).toBe(false);
    expect(
      assertDiscoveryCoversVerifiedSize({ discoveredCount: 4, onChainVerifiedSize: 4 }).ok
    ).toBe(true);
  });

  it('keeps Mainnet discovery on the requested network and does not create a transaction', async () => {
    const networks: string[] = [];
    const result = await discoverCollectionItems({
      network: 'mainnet',
      collectionMint: COLLECTION,
      onChainVerifiedSize: 4,
      rpcPost: async (network, body) => {
        networks.push(network);
        expect(body.method).toBe(COLLECTION_ITEM_DISCOVERY_METHOD);
        expect(JSON.stringify(body)).not.toContain('sendTransaction');
        return page(
          mangoItems().map((item) =>
            dasNft({
              mint: item.mint,
              name: item.name,
              collection: COLLECTION,
              verified: true,
            })
          )
        );
      },
    });

    expect(networks).toEqual(['mainnet']);
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(true);
    expect(result.network).toBe('mainnet');
    if (result.ok) {
      expect(result.items).toHaveLength(4);
    }
  });

  it('renders on-chain items without Edit or Mint all and opening markup has no transaction field', () => {
    const html = renderManagerItemListMarkup(
      mergeManagerListItems({
        discovered: mangoItems(),
        drafts: [],
      }),
      { digitCount: 3, network: 'mainnet' }
    );

    expect(html).toContain('On-chain item');
    expect(html).toContain('ManGo Pixel #001');
    expect(html).toContain('ManGo Pixel #004');
    expect(html).toContain('Verified');
    expect(html).toContain('Minted');
    expect(html).toContain('class="nft-card');
    expect(html).toContain('nft-card-art');
    expect(html).toContain('>View<');
    expect(html).not.toContain('>Edit<');
    expect(html).not.toContain('data-draft-action="mint"');
    expect(managerHasMintAll(html)).toBe(false);
    expect(html.toLowerCase()).not.toContain('mint all');
    expect(html).not.toContain('signature');
  });
});
