import { describe, expect, it } from 'vitest';

import { defaultStudioDefaults } from './defaults';
import { defaultStudioNumbering } from './numbering';
import { COLLECTION_ITEM_DISCOVERY_METHOD } from '../solana/discoverCollectionItems';
import { buildSavedCollectionItemDraft, shouldAutoSaveBeforeMint } from './saveItemDraft';
import type { StudioDraft } from './types';

const COLLECTION = '3M6W1vqH7c7gNdh7moLcN3HTcCffBn8ohVrx9aZFRGG2';

function collection() {
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
    commonAttributes: [] as Array<{ trait_type: string; value: string }>,
    isMutableDefault: true,
    items: [
      { mint: 'OnChain019', number: 19, verified: true },
      { mint: 'ADDgMXLtvcxtYavJtqTsNCDv1hd83Fy2px3oyMBGPaPf', number: 21, verified: true },
    ],
  };
}

function discovery(items: Array<{ name: string; mint: string; number: number }> = []) {
  return {
    ok: true as const,
    items: items.map((item) => ({
      mint: item.mint,
      name: item.name,
      metadataUri: 'https://example.com/item.json',
      imageUri: 'https://example.com/pixel.png',
      collectionKey: COLLECTION,
      collectionVerified: true as const,
      tokenStandard: 'NonFungible',
      number: item.number,
    })),
    method: COLLECTION_ITEM_DISCOVERY_METHOD,
    readOnly: true as const,
    network: 'mainnet' as const,
  };
}

function draft(params: Partial<StudioDraft> & Pick<StudioDraft, 'id' | 'number' | 'name'>): StudioDraft {
  return {
    collectionKey: `mainnet:${COLLECTION}`,
    network: 'mainnet',
    collectionMint: COLLECTION,
    status: 'metadata_ready',
    overrides: {
      description: 'Saved description',
      attributes: [{ trait_type: 'Series', value: 'ManGo' }],
    },
    artwork: { name: '025.png', type: 'image/png', size: 24 },
    mintAddress: null,
    mintSignature: null,
    sortIndex: params.number,
    createdAt: 1,
    updatedAt: 1,
    ...params,
  };
}

const numbering = defaultStudioNumbering({ baseName: 'ManGo Pixel' });
const defaults = defaultStudioDefaults({ symbol: 'MANGO' });

describe('save collection item draft before mint', () => {
  it('creates a new draft from an unsaved form instead of requiring Save draft first', () => {
    const saved = buildSavedCollectionItemDraft({
      collection: collection(),
      existingDrafts: [],
      existingDraft: null,
      numbering,
      defaults,
      discovery: discovery(),
      name: 'ManGo Pixel #025',
      description: 'Fresh pixel',
      externalUrl: 'https://mangomeme.fun',
      attributes: [{ trait_type: 'Series', value: 'ManGo' }],
      artwork: { name: '025.png', type: 'image/png', size: 24 },
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    expect(saved.created).toBe(true);
    expect(saved.draft.status).not.toBe('mint_submitted');
    expect(saved.draft.status).not.toBe('minted');
    expect(saved.draft.status).not.toBe('collection_verified');
    expect(saved.draft.mintAddress).toBeNull();
    expect(saved.draft.name).toBe('ManGo Pixel #025');
    expect(saved.draft.overrides.description).toBe('Fresh pixel');
    expect(saved.draft.overrides.attributes).toEqual([{ trait_type: 'Series', value: 'ManGo' }]);
    expect(saved.draft.artwork?.name).toBe('025.png');
  });

  it('updates the existing draft rather than creating a duplicate', () => {
    const existing = draft({
      id: 'draft-025',
      number: 25,
      name: 'ManGo Pixel #025',
    });
    const saved = buildSavedCollectionItemDraft({
      collection: collection(),
      existingDrafts: [existing],
      existingDraft: existing,
      numbering,
      defaults,
      discovery: discovery(),
      name: 'ManGo Pixel #025',
      description: 'Updated description',
      externalUrl: '',
      attributes: [{ trait_type: 'Type', value: 'Pixel' }],
      artwork: { name: '025-new.png', type: 'image/png', size: 48 },
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    expect(saved.created).toBe(false);
    expect(saved.draft.id).toBe('draft-025');
    expect(saved.draft.number).toBe(25);
    expect(saved.draft.overrides.description).toBe('Updated description');
    expect(saved.draft.overrides.attributes).toEqual([{ trait_type: 'Type', value: 'Pixel' }]);
    expect(saved.draft.artwork?.name).toBe('025-new.png');
    expect(saved.draft.mintAddress).toBeNull();
  });

  it('returns an error instead of minting when a new draft cannot be saved', () => {
    const saved = buildSavedCollectionItemDraft({
      collection: collection(),
      existingDrafts: [],
      existingDraft: null,
      numbering,
      defaults,
      discovery: {
        ok: false,
        error: 'Unable to load existing collection items. New item numbering is disabled until collection discovery succeeds.',
        method: COLLECTION_ITEM_DISCOVERY_METHOD,
        readOnly: true,
        network: 'mainnet',
      },
      name: 'ManGo Pixel #025',
      description: 'Fresh pixel',
      externalUrl: '',
      attributes: [],
      artwork: { name: '025.png', type: 'image/png', size: 24 },
    });

    expect(saved.ok).toBe(false);
    if (saved.ok) {
      return;
    }

    expect(saved.error).toContain('Unable to load existing collection items');
  });

  it('does not rewrite a draft that already has mint proof', () => {
    const existing = draft({
      id: 'draft-025',
      number: 25,
      name: 'ManGo Pixel #025',
      status: 'mint_submitted',
      mintAddress: 'Real025Mint111111111111111111111111111111',
      mintSignature: '5sig',
    });
    const saved = buildSavedCollectionItemDraft({
      collection: collection(),
      existingDrafts: [existing],
      existingDraft: existing,
      numbering,
      defaults,
      discovery: discovery(),
      name: 'Changed',
      description: 'Should not apply',
      externalUrl: '',
      attributes: [],
      artwork: { name: 'other.png', type: 'image/png', size: 8 },
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    expect(saved.unchanged).toBe(true);
    expect(saved.draft).toBe(existing);
    expect(saved.draft.name).toBe('ManGo Pixel #025');
  });

  it('auto-saves the open form before minting that item, not a different card', () => {
    expect(shouldAutoSaveBeforeMint('', null)).toBe(true);
    expect(shouldAutoSaveBeforeMint('draft-025', 'draft-025')).toBe(true);
    expect(shouldAutoSaveBeforeMint('draft-025', 'draft-026')).toBe(false);
  });
});
