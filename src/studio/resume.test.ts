import { describe, expect, it, vi } from 'vitest';

import { ON_CHAIN_HARD_CAP_IMPLEMENTED, SIZE_CAP_IS_ON_CHAIN } from '../collection/constants';
import {
  findCachedCollection,
  findCachedCollectionOnOtherNetwork,
  loadLastOpenedCollectionMint,
  saveLastOpenedCollectionMint,
  upsertRecentCollection,
} from '../collection/persistence';
import { defaultStudioDefaults } from './defaults';
import {
  importFilesAsDrafts,
  markDraftMintOutcome,
} from './drafts';
import {
  canMintStudioDraft,
  itemMintIsOneAtATime,
  managerHasMintAll,
  prepareItemMintFromDraft,
  shouldMarkDraftFailedAfterMintError,
} from './itemMint';
import { defaultStudioNumbering } from './numbering';
import { collectionStudioKey, createMemoryStudioStore } from './persistence';
import {
  addItemDraftToExistingCollection,
  addingItemDraftCreatesCollectionNft,
  cachedCollectionFromSettings,
  collectionCoverIsSeparateNft,
  collectionFromSnapshot,
  collectionProgress,
  duplicateMintBlocked,
  emptyCollectionDiscovery,
  itemNumberDoesNotProveOnChainExistence,
  nextNumberForExistingCollection,
  openingExistingCollectionCreatesCollectionNft,
  plannedCapacityDescribedAsOnChainHardCap,
  refuseCollectionOpenOnWrongNetwork,
  snapshotFromCollection,
  wrongNetworkCollectionMessage,
} from './resume';
import type { StudioDraft } from './types';
import {
  renderCollectionManagerMarkup,
  renderDraftListMarkup,
  renderRecentCollectionsMarkup,
} from '../ui/collectionViews';
import { studioCapacityView } from './capacity';

function artwork(name: string, index: number) {
  return {
    name,
    type: 'image/png',
    size: 12 + index,
  };
}

function mangoCollection(network: 'devnet' | 'mainnet' = 'mainnet') {
  return {
    mint: 'ManGoColMint11111111111111111111111111111',
    network,
    name: 'ManGo Pixel Collection',
    symbol: 'MANGO',
    plannedMaxItems: 100,
    itemNamePrefix: 'ManGo Pixel',
    digitCount: 3,
    startNumber: 1,
    commonDescription: 'A collection of unique ManGo Pixel NFTs created on Solana.',
    commonExternalUrl: 'https://mangomeme.fun',
    commonRoyaltyPercent: 0,
    commonAttributes: [] as Array<{ trait_type: string; value: string }>,
    isMutableDefault: true,
    items: [
      { mint: 'Item001', number: 1, verified: true },
      { mint: 'Item002', number: 2, verified: true },
      { mint: 'Item003', number: 3, verified: true },
      { mint: 'Item004', number: 4, verified: true },
    ],
  };
}

function mintedDrafts(): StudioDraft[] {
  const numbering = defaultStudioNumbering({ baseName: 'ManGo Pixel' });
  const imported = importFilesAsDrafts({
    files: [artwork('a.png', 0), artwork('b.png', 1), artwork('c.png', 2), artwork('d.png', 3)],
    mintedNumbers: [],
    existingDrafts: [],
    numbering,
    defaults: defaultStudioDefaults({ symbol: 'MANGO' }),
    network: 'mainnet',
    collectionMint: mangoCollection().mint,
    collectionKey: collectionStudioKey('mainnet', mangoCollection().mint),
    now: 1,
  }).drafts;

  return imported.map((draft, index) =>
    markDraftMintOutcome(draft, {
      status: 'collection_verified',
      mintAddress: `Item00${index + 1}`,
    })
  );
}

describe('collection resume and isolation', () => {
  it('persists a Mainnet collection snapshot with mint name capacity and created status', async () => {
    const store = createMemoryStudioStore();
    const collection = mangoCollection('mainnet');
    const snapshot = snapshotFromCollection(
      collection,
      defaultStudioNumbering({ baseName: 'ManGo Pixel' }),
      defaultStudioDefaults({ symbol: 'MANGO' })
    );

    await store.putSettings(snapshot);
    const restored = await store.getSettings(collectionStudioKey('mainnet', collection.mint));

    expect(restored?.network).toBe('mainnet');
    expect(restored?.collectionMint).toBe(collection.mint);
    expect(restored?.collectionName).toBe('ManGo Pixel Collection');
    expect(restored?.plannedCapacity).toBe(100);
    expect(restored?.created).toBe(true);
    expect(restored?.items).toHaveLength(4);
    const fromSettings = restored ? cachedCollectionFromSettings(restored) : null;
    expect(fromSettings?.network).toBe('mainnet');
  });

  it('keeps Devnet and Mainnet collections isolated', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });

    upsertRecentCollection('mainnet', mangoCollection('mainnet'));
    upsertRecentCollection('devnet', {
      ...mangoCollection('devnet'),
      mint: 'DevnetColMint111111111111111111111111111',
      name: 'Devnet Pixel Collection',
    });

    expect(findCachedCollection('devnet', mangoCollection('mainnet').mint)).toBeNull();
    expect(findCachedCollectionOnOtherNetwork('devnet', mangoCollection('mainnet').mint)?.network).toBe(
      'mainnet'
    );

    const blocked = refuseCollectionOpenOnWrongNetwork({
      selectedNetwork: 'devnet',
      selectedCache: null,
      otherCache: mangoCollection('mainnet'),
      selectedSettings: null,
      otherSettings: snapshotFromCollection(
        mangoCollection('mainnet'),
        defaultStudioNumbering({ baseName: 'ManGo Pixel' }),
        defaultStudioDefaults()
      ),
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toContain('Mainnet');
      expect(blocked.error).toContain('Devnet');
      expect(blocked.error).toContain('was not converted');
    }

    expect(
      refuseCollectionOpenOnWrongNetwork({
        selectedNetwork: 'mainnet',
        selectedCache: mangoCollection('mainnet'),
        otherCache: null,
        selectedSettings: snapshotFromCollection(
          mangoCollection('mainnet'),
          defaultStudioNumbering({ baseName: 'ManGo Pixel' }),
          defaultStudioDefaults()
        ),
        otherSettings: null,
      }).ok
    ).toBe(true);

    expect(wrongNetworkCollectionMessage('mainnet', 'devnet')).not.toContain('converted automatically');
    vi.unstubAllGlobals();
  });

  it('reopens an existing collection after a simulated refresh without Create Collection', async () => {
    const store = createMemoryStudioStore();
    const collection = mangoCollection('mainnet');
    const drafts = mintedDrafts();
    await Promise.all(drafts.map((draft) => store.putDraft(draft)));
    await store.putSettings(
      snapshotFromCollection(collection, defaultStudioNumbering({ baseName: 'ManGo Pixel' }), defaultStudioDefaults())
    );

    const restoredDrafts = await store.getDrafts(collectionStudioKey('mainnet', collection.mint));
    const restoredSettings = await store.getSettings(collectionStudioKey('mainnet', collection.mint));
    const resumed = collectionFromSnapshot(restoredSettings!, collection);

    expect(openingExistingCollectionCreatesCollectionNft()).toBe(false);
    expect(restoredDrafts).toHaveLength(4);
    expect(resumed.mint).toBe(collection.mint);
    expect(resumed.network).toBe('mainnet');
    expect(JSON.stringify(restoredDrafts)).not.toContain('createCollectionNft');
  });

  it('adds #005 as a local draft on an existing collection without a collection transaction', () => {
    const collection = mangoCollection('mainnet');
    const drafts = mintedDrafts();
    const created = addItemDraftToExistingCollection({
      collection,
      existingDrafts: drafts,
      numbering: defaultStudioNumbering({ baseName: 'ManGo Pixel' }),
      defaults: defaultStudioDefaults({ symbol: 'MANGO' }),
      discovery: emptyCollectionDiscovery('mainnet'),
      now: 50,
    });

    expect(addingItemDraftCreatesCollectionNft()).toBe(false);
    expect('error' in created).toBe(false);
    if ('error' in created) {
      return;
    }

    expect(created.number).toBe(5);
    expect(created.name).toBe('ManGo Pixel #005');
    expect(created.collectionMint).toBe(collection.mint);
    expect(created.mintAddress).toBeNull();
    expect(created.status).toBe('draft');
    expect(created.mintSignature ?? null).toBeNull();
  });

  it('continues numbering after existing drafts and does not treat a number as on-chain proof', () => {
    const collection = mangoCollection('mainnet');
    const localOnly = importFilesAsDrafts({
      files: [artwork('five.png', 4)],
      mintedNumbers: collection.items.map((item) => item.number),
      existingDrafts: mintedDrafts(),
      numbering: defaultStudioNumbering({ baseName: 'ManGo Pixel' }),
      defaults: defaultStudioDefaults(),
      network: 'mainnet',
      collectionMint: collection.mint,
      collectionKey: collectionStudioKey('mainnet', collection.mint),
      now: 9,
    }).drafts;

    expect(nextNumberForExistingCollection(collection.items, mintedDrafts(), defaultStudioNumbering({ baseName: 'ManGo Pixel' }))).toBe(
      5
    );
    expect(localOnly[0].number).toBe(5);
    expect(localOnly[0].mintAddress).toBeNull();
    expect(itemNumberDoesNotProveOnChainExistence()).toBe(true);
    expect(canMintStudioDraft(localOnly[0])).toBe(true);
  });

  it('keeps draft metadata artwork mint address and verified state across reload', async () => {
    const store = createMemoryStudioStore();
    const collection = mangoCollection('mainnet');
    const [first, ...rest] = mintedDrafts();
    const withOverride: StudioDraft = {
      ...first,
      overrides: { description: 'The first ManGo Pixel...' },
    };
    await store.putDraft(withOverride);
    await store.putBlob(withOverride.id, new Blob(['png-bytes'], { type: 'image/png' }));
    await Promise.all(rest.map((draft) => store.putDraft(draft)));

    const restored = await store.getDrafts(collectionStudioKey('mainnet', collection.mint));
    const blob = await store.getBlob(withOverride.id);

    expect(restored[0].overrides.description).toBe('The first ManGo Pixel...');
    expect(restored[0].mintAddress).toBe('Item001');
    expect(restored[0].status).toBe('collection_verified');
    expect(blob).toBeInstanceOf(Blob);
    expect(restored.every((draft) => draft.collectionMint === collection.mint)).toBe(true);
  });

  it('protects against duplicate mints and stays one-at-a-time without Mint all', () => {
    const minted = mintedDrafts()[0];
    const submitted = markDraftMintOutcome(mintedDrafts()[1], { status: 'mint_submitted' });
    const numbering = defaultStudioNumbering({ baseName: 'ManGo Pixel' });
    const defaults = defaultStudioDefaults({ symbol: 'MANGO' });

    expect(duplicateMintBlocked(minted).blocked).toBe(true);
    expect(canMintStudioDraft(minted)).toBe(false);
    expect(prepareItemMintFromDraft(minted, defaults, numbering)).toMatchObject({
      error: expect.stringContaining('mint address'),
    });
    expect(duplicateMintBlocked(submitted).blocked).toBe(true);
    expect(shouldMarkDraftFailedAfterMintError(submitted, null)).toBe(false);
    expect(shouldMarkDraftFailedAfterMintError(mintedDrafts()[2], 'NewMint')).toBe(false);
    expect(itemMintIsOneAtATime()).toBe(true);

    const html = renderDraftListMarkup(mintedDrafts(), {
      collectionCreated: true,
      digitCount: 3,
    });
    expect(managerHasMintAll(html)).toBe(false);
    expect(html.toLowerCase()).not.toContain('mint all');
    expect(html).not.toMatch(/Mint #00[1-4]/);
  });

  it('keeps the collection cover as a separate NFT and planned capacity off-chain', () => {
    expect(collectionCoverIsSeparateNft()).toBe(true);
    expect(plannedCapacityDescribedAsOnChainHardCap()).toBe(false);
    expect(SIZE_CAP_IS_ON_CHAIN).toBe(false);
    expect(ON_CHAIN_HARD_CAP_IMPLEMENTED).toBe(false);

    const html = renderCollectionManagerMarkup({
      cache: mangoCollection('mainnet'),
      onChain: {
        mint: mangoCollection().mint,
        name: 'ManGo Pixel Collection',
        symbol: 'MANGO',
        uri: 'ipfs://bafy',
        updateAuthority: 'Update111',
        tokenStandard: 'NonFungible',
        isCollection: true,
        collectionDetailsKind: 'V1',
        onChainVerifiedSize: 4,
      },
      capacity: studioCapacityView({
        plannedCapacity: 100,
        mintedCount: 4,
        verifiedCount: 4,
        drafts: mintedDrafts(),
      }),
      nextNumberLabel: '#005',
      preparedCount: 0,
      mintedCount: 4,
      verifiedCount: 4,
    });

    expect(html).toContain('collection cover is a separate NFT');
    expect(html.toLowerCase()).not.toContain('on-chain hard cap');
    expect(html).toContain('Mainnet');
    expect(html).toContain('On-chain name');
    expect(html).toContain('Can be updated by');
    expect(html).toContain('Create next NFT');
  });

  it('shows Mainnet or Devnet on Recent Collections', () => {
    const html = renderRecentCollectionsMarkup([mangoCollection('mainnet')]);
    expect(html).toContain('Mainnet');
    expect(html).not.toContain('Devnet');
    expect(renderRecentCollectionsMarkup([{ ...mangoCollection('devnet'), mint: 'DevMint' }])).toContain(
      'Devnet'
    );
  });

  it('counts prepared minted and verified separately', () => {
    const drafts = [
      ...mintedDrafts(),
      addItemDraftToExistingCollection({
        collection: mangoCollection('mainnet'),
        existingDrafts: mintedDrafts(),
        numbering: defaultStudioNumbering({ baseName: 'ManGo Pixel' }),
        defaults: defaultStudioDefaults(),
        discovery: emptyCollectionDiscovery('mainnet'),
        now: 99,
      }),
    ];
    const extra = drafts[drafts.length - 1];
    expect('error' in extra).toBe(false);
    if ('error' in extra) {
      return;
    }

    const progress = collectionProgress({
      items: mangoCollection().items,
      drafts: [...mintedDrafts(), extra],
      discovery: emptyCollectionDiscovery('mainnet'),
    });
    expect(progress.prepared).toBe(1);
    expect(progress.minted).toBe(4);
    expect(progress.verified).toBe(4);
  });

  it('remembers last opened collection per network', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });

    saveLastOpenedCollectionMint('mainnet', mangoCollection().mint);
    saveLastOpenedCollectionMint('devnet', 'DevMint');
    expect(loadLastOpenedCollectionMint('mainnet')).toBe(mangoCollection().mint);
    expect(loadLastOpenedCollectionMint('devnet')).toBe('DevMint');
    vi.unstubAllGlobals();
  });
});
