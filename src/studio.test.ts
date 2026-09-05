import { describe, expect, it } from 'vitest';

import { ON_CHAIN_HARD_CAP_IMPLEMENTED, SIZE_CAP_IS_ON_CHAIN } from './collection/constants';
import { studioCapacityView } from './studio/capacity';
import { defaultStudioDefaults, inheritItemFields } from './studio/defaults';
import {
  canReorderDraft,
  importFilesAsDrafts,
  markDraftMintOutcome,
  removeDraft,
  reorderPreparedDrafts,
  updateDraftFields,
} from './studio/drafts';
import {
  applyDraftEditorValues,
  resolveDraftMetadata,
  resolvedItemMetadataJson,
} from './studio/resolve';
import {
  attachDraftsToCollectionMint,
  collectionCreateDoesNotMintItems,
  draftsForOpenedCollection,
} from './studio/link';
import {
  assertMintTargetsDraft,
  managerHasMintAll,
  prepareItemMintFromDraft,
} from './studio/itemMint';
import { classifyArtworkFiles } from './studio/importArtwork';
import {
  buildStudioItemName,
  defaultStudioNumbering,
  previewStudioNames,
  validateStudioNumbering,
} from './studio/numbering';
import { collectionStudioKey, createMemoryStudioStore } from './studio/persistence';
import { collectionItemStatusLabel, normalizeStudioDraft, type StudioDraft } from './studio/types';
import {
  renderCollectionManagerMarkup,
  renderDraftListMarkup,
  renderNumberingPreviewMarkup,
} from './ui/collectionViews';

function mangoNumbering() {
  return defaultStudioNumbering({ baseName: 'ManGo Pixel' });
}

function artwork(name: string, index: number) {
  return {
    name,
    type: 'image/png',
    size: 12 + index,
  };
}

describe('studio numbering', () => {
  it('uses a generic Item prefix until a collection supplies one', () => {
    const numbering = defaultStudioNumbering();
    expect(numbering.baseName).toBe('Item');
    expect(buildStudioItemName(numbering, 1)).toBe('Item #001');
    expect(previewStudioNames(numbering)).toEqual([
      'Item #001',
      'Item #002',
      'Item #003',
      'Item #100',
    ]);
  });

  it('previews ManGo Pixel #001 through planned #100 when that prefix is supplied', () => {
    const numbering = defaultStudioNumbering({ baseName: 'ManGo Pixel' });
    expect(buildStudioItemName(numbering, 1)).toBe('ManGo Pixel #001');
    expect(previewStudioNames(numbering)).toEqual([
      'ManGo Pixel #001',
      'ManGo Pixel #002',
      'ManGo Pixel #003',
      'ManGo Pixel #100',
    ]);
  });

  it('supports a generic 4-digit collection', () => {
    const numbering = defaultStudioNumbering({
      baseName: 'Space Ape',
      digitCount: 4,
      start: 1,
      plannedCapacity: 500,
    });
    expect(buildStudioItemName(numbering, 1)).toBe('Space Ape #0001');
    expect(previewStudioNames(numbering, 1)).toEqual([
      'Space Ape #0001',
      'Space Ape #0500',
    ]);
    expect(validateStudioNumbering(numbering).ok).toBe(true);
  });
});

function makeDraft(
  fields: Partial<StudioDraft> & Pick<StudioDraft, 'id' | 'number' | 'name' | 'status'>
): StudioDraft {
  return {
    collectionKey: 'devnet:Col',
    network: 'devnet',
    collectionMint: 'Col',
    overrides: {},
    artwork: artwork('one.png', 0),
    mintAddress: null,
    sortIndex: 0,
    createdAt: 1,
    updatedAt: 1,
    ...fields,
  };
}

describe('studio drafts', () => {
  it('imports multiple images as drafts without counting them as minted', () => {
    const numbering = mangoNumbering();
    const imported = importFilesAsDrafts({
      files: Array.from({ length: 8 }, (_, index) => artwork(`pixel-${index + 8}.png`, index)),
      mintedNumbers: [1],
      existingDrafts: [],
      numbering,
      defaults: defaultStudioDefaults({ symbol: 'MANGO' }),
      network: 'devnet',
      collectionMint: null,
      collectionKey: collectionStudioKey('devnet', null),
      now: 1,
    });

    expect(imported.drafts).toHaveLength(8);
    expect(imported.drafts[0].name).toBe('ManGo Pixel #002');
    expect(imported.drafts[7].name).toBe('ManGo Pixel #009');
    expect(imported.drafts.every((draft) => draft.status === 'metadata_ready' || draft.status === 'artwork_uploaded')).toBe(true);
    expect(imported.drafts.every((draft) => draft.mintAddress === null)).toBe(true);
  });

  it('does not let a minted draft be removed or reordered', () => {
    const minted = makeDraft({
      id: 'minted-1',
      number: 1,
      name: 'ManGo Pixel #001',
      status: 'minted',
      mintAddress: 'Mint1',
    });
    const draft = makeDraft({
      id: 'draft-2',
      number: 2,
      name: 'ManGo Pixel #002',
      status: 'artwork_uploaded',
      sortIndex: 1,
    });

    expect(canReorderDraft(minted)).toBe(false);
    expect(canReorderDraft(draft)).toBe(true);
    const removed = removeDraft([minted, draft], 'minted-1');
    expect('error' in removed).toBe(true);
    const reordered = reorderPreparedDrafts([minted, draft], 'minted-1', 1);
    expect('error' in reordered).toBe(true);
  });

  it('keeps collection defaults unless a draft overrides them', () => {
    const defaults = defaultStudioDefaults({
      description: 'Collection description',
      symbol: 'MANGO',
      attributes: [{ trait_type: 'Set', value: 'Pixel' }],
    });
    const inherited = inheritItemFields(defaults, { descriptionOverride: 'Unique item' });
    expect(inherited.description).toBe('Unique item');
    expect(inherited.attributes).toEqual([{ trait_type: 'Set', value: 'Pixel' }]);
  });

  it('lets each imported draft override name description url and attributes independently', () => {
    const numbering = defaultStudioNumbering();
    const defaults = defaultStudioDefaults({
      description: 'A ManGo Pixel NFT from the ManGo collection.',
      externalUrl: 'https://mangomeme.fun',
      attributes: [{ trait_type: 'Set', value: 'Pixel' }],
    });
    const imported = importFilesAsDrafts({
      files: [artwork('one.png', 0), artwork('two.png', 1)],
      mintedNumbers: [],
      existingDrafts: [],
      numbering,
      defaults,
      network: 'devnet',
      collectionMint: 'Col',
      collectionKey: collectionStudioKey('devnet', 'Col'),
      now: 1,
    });
    const first = applyDraftEditorValues(imported.drafts[0], defaults, numbering, {
      name: 'First ManGo',
      description: 'The first ManGo Pixel...',
      externalUrl: 'https://mangomeme.fun/001',
      attributes: [
        { trait_type: 'Background', value: 'Blue' },
        { trait_type: 'Accessory', value: 'Sunglasses' },
      ],
    });
    const second = applyDraftEditorValues(imported.drafts[1], defaults, numbering, {
      name: 'ManGo Pixel #002',
      description: 'A ManGo exploring...',
      externalUrl: 'https://mangomeme.fun/002',
      attributes: [
        { trait_type: 'Background', value: 'Jungle' },
        { trait_type: 'Accessory', value: 'Hat' },
      ],
    });

    expect(resolveDraftMetadata(first, defaults, numbering)).toMatchObject({
      name: 'First ManGo',
      description: 'The first ManGo Pixel...',
      externalUrl: 'https://mangomeme.fun/001',
      attributes: [
        { trait_type: 'Background', value: 'Blue' },
        { trait_type: 'Accessory', value: 'Sunglasses' },
      ],
      descriptionIsOverride: true,
      nameIsOverride: true,
      externalUrlIsOverride: true,
      attributesAreOverride: true,
    });
    expect(resolveDraftMetadata(second, defaults, numbering).description).toBe(
      'A ManGo exploring...'
    );
    expect(imported.drafts[0].overrides).toEqual({});
    expect(resolveDraftMetadata(imported.drafts[1], defaults, numbering).description).toBe(
      defaults.description
    );
  });

  it('keeps inherited drafts following later default changes and frozen overrides', () => {
    const numbering = defaultStudioNumbering();
    const defaults = defaultStudioDefaults({
      description: 'A ManGo Pixel NFT from the ManGo collection.',
      externalUrl: 'https://mangomeme.fun',
      attributes: [{ trait_type: 'Background', value: 'Studio' }],
    });
    const imported = importFilesAsDrafts({
      files: [artwork('one.png', 0), artwork('two.png', 1)],
      mintedNumbers: [],
      existingDrafts: [],
      numbering,
      defaults,
      network: 'devnet',
      collectionMint: 'Col',
      collectionKey: collectionStudioKey('devnet', 'Col'),
      now: 1,
    });
    const overridden = applyDraftEditorValues(imported.drafts[0], defaults, numbering, {
      name: imported.drafts[0].name,
      description: 'The first ManGo Pixel...',
      externalUrl: defaults.externalUrl,
      attributes: defaults.attributes,
    });
    const inherited = imported.drafts[1];
    const nextDefaults = defaultStudioDefaults({
      ...defaults,
      description: 'Updated collection description.',
      externalUrl: 'https://mangomeme.fun/new',
      attributes: [{ trait_type: 'Background', value: 'Night' }],
    });

    expect(resolveDraftMetadata(inherited, nextDefaults, numbering)).toMatchObject({
      description: 'Updated collection description.',
      externalUrl: 'https://mangomeme.fun/new',
      attributes: [{ trait_type: 'Background', value: 'Night' }],
      descriptionIsOverride: false,
    });
    expect(resolveDraftMetadata(overridden, nextDefaults, numbering)).toMatchObject({
      description: 'The first ManGo Pixel...',
      descriptionIsOverride: true,
    });
    expect(overridden.overrides).not.toBe(inherited.overrides);
  });

  it('does not mutate a sibling draft when one item is edited', () => {
    const numbering = defaultStudioNumbering();
    const defaults = defaultStudioDefaults({
      description: 'Shared default',
    });
    const one = makeDraft({
      id: 'draft-1',
      number: 1,
      name: 'ManGo Pixel #001',
      status: 'artwork_uploaded',
    });
    const two = makeDraft({
      id: 'draft-2',
      number: 2,
      name: 'ManGo Pixel #002',
      status: 'artwork_uploaded',
      sortIndex: 1,
    });
    const edited = applyDraftEditorValues(one, defaults, numbering, {
      name: 'Custom Name',
      description: 'Only this item',
      externalUrl: 'https://example.com/one',
      attributes: [{ trait_type: 'Mood', value: 'Calm' }],
    });

    expect(edited).not.toBe(one);
    expect(one.overrides).toEqual({});
    expect(two.overrides).toEqual({});
    expect(two.name).toBe('ManGo Pixel #002');
    expect(resolveDraftMetadata(two, defaults, numbering).description).toBe('Shared default');
  });

  it('puts the per-item description into resolved off-chain metadata JSON', () => {
    const numbering = defaultStudioNumbering();
    const defaults = defaultStudioDefaults({
      description: 'A ManGo Pixel NFT from the ManGo collection.',
      symbol: 'MANGO',
    });
    const draft = applyDraftEditorValues(
      makeDraft({
        id: 'draft-1',
        number: 1,
        name: 'ManGo Pixel #001',
        status: 'metadata_ready',
      }),
      defaults,
      numbering,
      {
        name: 'ManGo Pixel #001',
        description: 'The first ManGo Pixel...\nStill unique.',
        externalUrl: 'https://mangomeme.fun/001',
        attributes: [{ trait_type: 'Background', value: 'Blue' }],
      }
    );
    const json = resolvedItemMetadataJson(draft, defaults, numbering);

    expect(json.name).toBe('ManGo Pixel #001');
    expect(json.description).toBe('The first ManGo Pixel...\nStill unique.');
    expect(json.external_url).toBe('https://mangomeme.fun/001');
    expect(json.attributes).toEqual([{ trait_type: 'Background', value: 'Blue' }]);
  });
});

describe('studio capacity labels', () => {
  it('shows planned remaining slots without claiming an on-chain hard cap', () => {
    const view = studioCapacityView({
      plannedCapacity: 100,
      mintedCount: 7,
      verifiedCount: 7,
      drafts: Array.from({ length: 5 }, (_, index) =>
        makeDraft({
          id: `d${index}`,
          number: 8 + index,
          name: `ManGo Pixel #00${8 + index}`,
          status: 'artwork_uploaded',
          artwork: artwork(`${index}.png`, index),
          sortIndex: index,
        })
      ),
    });

    expect(view.capacityLabel).toBe('7 / 100');
    expect(view.remainingPlanned).toBe(93);
    expect(view.preparedCount).toBe(5);
    expect(view.mintedCount).toBe(7);
    expect(view.sizeCapIsOnChain).toBe(false);
    expect(SIZE_CAP_IS_ON_CHAIN).toBe(false);
    expect(ON_CHAIN_HARD_CAP_IMPLEMENTED).toBe(false);
  });
});

describe('studio persistence choice', () => {
  it('stores drafts in an IndexedDB-shaped store without counting them as chain items', async () => {
    const store = createMemoryStudioStore();
    const numbering = defaultStudioNumbering();
    const imported = importFilesAsDrafts({
      files: [artwork('a.png', 0)],
      mintedNumbers: [],
      existingDrafts: [],
      numbering,
      defaults: defaultStudioDefaults(),
      network: 'devnet',
      collectionMint: 'Col',
      collectionKey: collectionStudioKey('devnet', 'Col'),
    });

    await store.putDraft(imported.drafts[0]);
    const listed = await store.getDrafts(collectionStudioKey('devnet', 'Col'));
    expect(listed).toHaveLength(1);
    expect(listed[0].mintAddress).toBeNull();
    expect(store.kind).toBe('memory');
  });

  it('persists item overrides across reload', async () => {
    const store = createMemoryStudioStore();
    const numbering = defaultStudioNumbering();
    const defaults = defaultStudioDefaults({
      description: 'A ManGo Pixel NFT from the ManGo collection.',
    });
    const imported = importFilesAsDrafts({
      files: [artwork('a.png', 0)],
      mintedNumbers: [],
      existingDrafts: [],
      numbering,
      defaults,
      network: 'devnet',
      collectionMint: 'Col',
      collectionKey: collectionStudioKey('devnet', 'Col'),
    });
    const saved = applyDraftEditorValues(imported.drafts[0], defaults, numbering, {
      name: 'ManGo Pixel #001',
      description: 'The first ManGo Pixel...',
      externalUrl: 'https://mangomeme.fun/001',
      attributes: [{ trait_type: 'Background', value: 'Blue' }],
    });
    await store.putDraft(saved);
    const listed = await store.getDrafts(collectionStudioKey('devnet', 'Col'));
    expect(listed[0].overrides.description).toBe('The first ManGo Pixel...');
    expect(listed[0].overrides.externalUrl).toBe('https://mangomeme.fun/001');
    expect(listed[0].overrides.attributes).toEqual([{ trait_type: 'Background', value: 'Blue' }]);
    expect(resolveDraftMetadata(listed[0], defaults, numbering).description).toBe(
      'The first ManGo Pixel...'
    );
  });

  it('treats legacy empty descriptionOverride as inherit', () => {
    const numbering = defaultStudioNumbering();
    const defaults = defaultStudioDefaults({
      description: 'Collection description',
    });
    const legacy = normalizeStudioDraft({
      id: 'legacy-1',
      collectionKey: 'devnet:Col',
      network: 'devnet',
      collectionMint: 'Col',
      number: 1,
      name: 'ManGo Pixel #001',
      status: 'artwork_uploaded',
      descriptionOverride: '',
      attributes: [{ trait_type: 'Set', value: 'Pixel' }],
      artwork: artwork('one.png', 0),
      mintAddress: null,
      sortIndex: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    expect(legacy.overrides).toEqual({});
    expect(resolveDraftMetadata(legacy, defaults, numbering).description).toBe(
      'Collection description'
    );
  });
});

describe('artwork import classification', () => {
  it('accepts PNG JPEG WebP GIF and rejects other types', () => {
    const result = classifyArtworkFiles([
      new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }),
      new File([new Uint8Array([1, 2, 3])], 'b.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array([1, 2, 3])], 'c.webp', { type: 'image/webp' }),
      new File([new Uint8Array([1, 2, 3])], 'd.gif', { type: 'image/gif' }),
      new File([new Uint8Array([1, 2, 3])], 'e.txt', { type: 'text/plain' }),
    ]);

    expect(result.accepted).toHaveLength(4);
    expect(result.rejected).toHaveLength(1);
  });
});

describe('studio markup honesty', () => {
  it('does not label planned capacity as an on-chain hard cap', () => {
    const html = renderCollectionManagerMarkup({
      cache: {
        mint: 'ColMint',
        network: 'devnet',
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
        items: [],
      },
      onChain: null,
      capacity: studioCapacityView({
        plannedCapacity: 100,
        mintedCount: 7,
        verifiedCount: 7,
        drafts: [],
      }),
      nextNumberLabel: '#008',
      preparedCount: 0,
      mintedCount: 7,
      verifiedCount: 7,
    });

    expect(html.toLowerCase()).not.toContain('on-chain hard cap');
    expect(html).toContain('CBS planned');
    expect(html).toContain('Collection created ✓');
    expect(html).toContain('ManGo Pixel Collection');
    expect(html).toContain('ManGo Pixel #008');
    expect(html).toContain('id="copyCollectionMint"');
    expect(html).toContain('Copy');
    expect(html).toContain('Explorer');
    expect(html).toContain('100');
    expect(html).toContain('Create next NFT');
    expect(html).toContain('Drafts are local. On-chain items stay on-chain.');
    expect(html).toContain('Prepared');
    expect(html).toContain('Verified in collection');
    expect(html).toContain('collection cover is a separate NFT');
    expect(renderNumberingPreviewMarkup(mangoNumbering())).toContain('ManGo Pixel #001');
    expect(renderDraftListMarkup([])).toContain('No prepared drafts yet');
    expect(renderDraftListMarkup([
      makeDraft({
        id: 'draft-1',
        number: 1,
        name: 'ManGo Pixel #001',
        status: 'artwork_uploaded',
      }),
    ])).toContain('Edit item');
  });

  it('does not rename a minted draft through the editor', () => {
    const minted = makeDraft({
      id: 'minted-1',
      number: 1,
      name: 'ManGo Pixel #001',
      status: 'collection_verified',
      mintAddress: 'Mint1',
    });
    const updated = updateDraftFields(minted, { name: 'ManGo Pixel #099' });
    expect('error' in updated).toBe(true);
  });
});

describe('collection manager draft continuation', () => {
  const numbering = defaultStudioNumbering();
  const defaults = defaultStudioDefaults({
    description: 'A ManGo Pixel NFT from the ManGo collection.',
    externalUrl: 'https://mangomeme.fun',
    symbol: 'MANGO',
    royaltyPercent: 0,
    isMutable: true,
    attributes: [{ trait_type: 'Set', value: 'Pixel' }],
  });

  function preparedDrafts() {
    return importFilesAsDrafts({
      files: [artwork('a.png', 0), artwork('b.png', 1), artwork('c.png', 2), artwork('d.png', 3)],
      mintedNumbers: [],
      existingDrafts: [],
      numbering,
      defaults,
      network: 'devnet',
      collectionMint: null,
      collectionKey: collectionStudioKey('devnet', null),
      now: 1,
    }).drafts;
  }

  it('keeps drafts after collection creation and links them to the collection mint', () => {
    const pending = preparedDrafts();
    const withOverrides = applyDraftEditorValues(pending[0], defaults, numbering, {
      name: pending[0].name,
      description: 'The first ManGo Pixel...',
      externalUrl: defaults.externalUrl,
      attributes: [{ trait_type: 'Background', value: 'Blue' }],
    });
    const before = [withOverrides, ...pending.slice(1)];
    const linked = attachDraftsToCollectionMint(before, {
      collectionMint: '3M6WCollectionMintRGG2',
      network: 'devnet',
      now: 2,
    });

    expect(collectionCreateDoesNotMintItems(before, linked)).toBe(true);
    expect(linked).toHaveLength(4);
    expect(linked.every((draft) => draft.collectionMint === '3M6WCollectionMintRGG2')).toBe(true);
    expect(linked.every((draft) => draft.collectionKey === 'devnet:3M6WCollectionMintRGG2')).toBe(true);
    expect(linked.every((draft) => draft.mintAddress === null)).toBe(true);
    expect(linked[0].overrides.description).toBe('The first ManGo Pixel...');
    expect(linked.map((draft) => draft.id)).toEqual(before.map((draft) => draft.id));
  });

  it('restores matching Studio drafts when opening a recent collection', async () => {
    const store = createMemoryStudioStore();
    const linked = attachDraftsToCollectionMint(preparedDrafts(), {
      collectionMint: 'ManGoColMint',
      network: 'devnet',
    });
    await Promise.all(linked.map((draft) => store.putDraft(draft)));
    const restored = await store.getDrafts(collectionStudioKey('devnet', 'ManGoColMint'));
    expect(restored).toHaveLength(4);
    expect(restored.map((draft) => draft.number)).toEqual([1, 2, 3, 4]);
  });

  it('safely adopts orphan pending drafts only when the collection has none', async () => {
    const store = createMemoryStudioStore();
    const pending = preparedDrafts();
    await Promise.all(pending.map((draft) => store.putDraft(draft)));
    const empty = await store.getDrafts(collectionStudioKey('devnet', 'ManGoColMint'));
    const adopted = draftsForOpenedCollection({
      collectionDrafts: empty,
      pendingDrafts: await store.getDrafts(collectionStudioKey('devnet', null)),
      collectionMint: 'ManGoColMint',
      network: 'devnet',
    });
    expect(adopted.newlyLinked).toHaveLength(4);
    await Promise.all(adopted.newlyLinked.map((draft) => store.putDraft(draft)));
    expect(await store.getDrafts(collectionStudioKey('devnet', 'ManGoColMint'))).toHaveLength(4);

    const extraPending = importFilesAsDrafts({
      files: [artwork('later.png', 9)],
      mintedNumbers: [],
      existingDrafts: [],
      numbering,
      defaults,
      network: 'devnet',
      collectionMint: null,
      collectionKey: collectionStudioKey('devnet', null),
      now: 9,
    }).drafts;
    const ignored = draftsForOpenedCollection({
      collectionDrafts: await store.getDrafts(collectionStudioKey('devnet', 'ManGoColMint')),
      pendingDrafts: extraPending,
      collectionMint: 'ManGoColMint',
      network: 'devnet',
    });
    expect(ignored.newlyLinked).toHaveLength(0);
    expect(ignored.drafts).toHaveLength(4);
  });

  it('uses that draft’s resolved metadata for Mint #001 and cannot mint #002', () => {
    const pending = preparedDrafts();
    const first = applyDraftEditorValues(pending[0], defaults, numbering, {
      name: pending[0].name,
      description: 'The first ManGo Pixel...',
      externalUrl: 'https://mangomeme.fun/001',
      attributes: [{ trait_type: 'Background', value: 'Blue' }],
    });
    const linked = attachDraftsToCollectionMint([first, pending[1]], {
      collectionMint: 'ManGoColMint',
      network: 'devnet',
    });
    const prepared = prepareItemMintFromDraft(linked[0], defaults, numbering);
    expect('error' in prepared).toBe(false);
    if ('error' in prepared) {
      return;
    }

    expect(prepared.draftId).toBe(linked[0].id);
    expect(prepared.number).toBe(1);
    expect(prepared.description).toBe('The first ManGo Pixel...');
    expect(prepared.externalUrl).toBe('https://mangomeme.fun/001');
    expect(prepared.attributes).toEqual([{ trait_type: 'Background', value: 'Blue' }]);
    expect(prepared.mintLabel).toBe('Mint #001');
    expect(assertMintTargetsDraft(prepared, linked[0]).ok).toBe(true);
    expect(assertMintTargetsDraft(prepared, linked[1]).ok).toBe(false);
    expect(prepareItemMintFromDraft(linked[1], defaults, numbering)).toMatchObject({
      number: 2,
      mintLabel: 'Mint #002',
    });
  });

  it('persists mint address and verified state so refresh restores progress', async () => {
    const store = createMemoryStudioStore();
    const linked = attachDraftsToCollectionMint(preparedDrafts(), {
      collectionMint: 'ManGoColMint',
      network: 'devnet',
    });
    const minted = markDraftMintOutcome(linked[0], {
      status: 'collection_verified',
      mintAddress: 'ItemMint001',
    });
    await store.putDraft(minted);
    await Promise.all(linked.slice(1).map((draft) => store.putDraft(draft)));
    const restored = await store.getDrafts(collectionStudioKey('devnet', 'ManGoColMint'));
    expect(restored[0].mintAddress).toBe('ItemMint001');
    expect(restored[0].status).toBe('collection_verified');
    expect(restored.filter((draft) => draft.mintAddress === null)).toHaveLength(3);
    expect(collectionItemStatusLabel(restored[1].status)).toBe('Ready to mint');
    expect(collectionItemStatusLabel(restored[0].status)).toBe('Collection verified');
  });

  it('shows Collection Manager items with Mint #001 and no Mint all', () => {
    const linked = attachDraftsToCollectionMint(preparedDrafts(), {
      collectionMint: 'ManGoColMint',
      network: 'devnet',
    });
    const html = renderDraftListMarkup(linked, {
      collectionCreated: true,
      digitCount: 3,
    });
    expect(html).toContain('Items');
    expect(html).toContain('Ready to mint');
    expect(html).toContain('Mint #001');
    expect(html).toContain('Mint #002');
    expect(html).toContain('Mint #004');
    expect(html).toContain('>Edit<');
    expect(managerHasMintAll(html)).toBe(false);
    expect(html.toLowerCase()).not.toContain('mint all');
  });

  it('opening or creating the manager is a local action without a transaction field', () => {
    const linked = attachDraftsToCollectionMint(preparedDrafts(), {
      collectionMint: 'ManGoColMint',
      network: 'devnet',
    });
    expect(linked.every((draft) => draft.status !== 'mint_submitted')).toBe(true);
    expect(JSON.stringify(linked)).not.toContain('signature');
  });
});
