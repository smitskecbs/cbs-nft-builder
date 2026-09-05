import { describe, expect, it } from 'vitest';

import { defaultStudioDefaults } from './defaults';
import { draftStatusAfterMintSend, markDraftMintOutcome } from './drafts';
import {
  canMintStudioDraft,
  shouldMarkDraftFailedAfterMintError,
} from './itemMint';
import { defaultStudioNumbering } from './numbering';
import { collectionStudioKey, createMemoryStudioStore } from './persistence';
import {
  addItemDraftToExistingCollection,
  COLLECTION_INDEXING_WAIT_LABEL,
  mergeManagerListItems,
  recoverDraftAgainstDiscoveredItems,
} from './resume';
import {
  hasOnChainMintProof,
  normalizeStudioDraft,
  type StudioDraft,
} from './types';
import { renderManagerItemListMarkup } from '../ui/collectionViews';
import { classifyMintAccountLookupError } from '../solana/collectionOnChain';
import { COLLECTION_ITEM_DISCOVERY_METHOD } from '../solana/discoverCollectionItems';

const COLLECTION = '3M6W1vqH7c7gNdh7moLcN3HTcCffBn8ohVrx9aZFRGG2';

function collectionCache() {
  return {
    mint: COLLECTION,
    network: 'mainnet' as const,
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
    items: Array.from({ length: 19 }, (_, index) => ({
      mint: `OnChain${String(index + 1).padStart(3, '0')}`,
      number: index + 1,
      verified: true,
    })).concat([
      { mint: 'ADDgMXLtvcxtYavJtqTsNCDv1hd83Fy2px3oyMBGPaPf', number: 21, verified: true },
      { mint: 'H22uJsXrb1vpMe2hXTqvEXFuUaEretNejph29TVESuyz', number: 22, verified: true },
    ]),
  };
}

function draft(params: Partial<StudioDraft> & Pick<StudioDraft, 'id' | 'number' | 'name' | 'status'>): StudioDraft {
  return {
    collectionKey: `mainnet:${COLLECTION}`,
    network: 'mainnet',
    collectionMint: COLLECTION,
    overrides: params.overrides ?? {
      description: 'Recovered pixel description',
      attributes: [{ trait_type: 'Series', value: 'ManGo' }],
    },
    artwork: params.artwork ?? { name: '020.png', type: 'image/png', size: 24 },
    mintAddress: params.mintAddress ?? null,
    mintSignature: params.mintSignature ?? null,
    sortIndex: params.number,
    createdAt: 1,
    updatedAt: 1,
    ...params,
  };
}

function discovered(name: string, mint: string, number: number) {
  return {
    mint,
    name,
    metadataUri: `https://example.com/${number}.json`,
    imageUri: 'https://example.com/pixel.png',
    collectionKey: COLLECTION,
    collectionVerified: true as const,
    tokenStandard: 'NonFungible',
    number,
  };
}

function discovery() {
  return {
    ok: true as const,
    items: [
      ...Array.from({ length: 19 }, (_, index) =>
        discovered(
          `ManGo Pixel #${String(index + 1).padStart(3, '0')}`,
          `OnChain${String(index + 1).padStart(3, '0')}`,
          index + 1
        )
      ),
      discovered('ManGo Pixel #021', 'ADDgMXLtvcxtYavJtqTsNCDv1hd83Fy2px3oyMBGPaPf', 21),
      discovered('ManGo Pixel #022', 'H22uJsXrb1vpMe2hXTqvEXFuUaEretNejph29TVESuyz', 22),
    ],
    method: COLLECTION_ITEM_DISCOVERY_METHOD,
    readOnly: true as const,
    network: 'mainnet' as const,
  };
}

describe('recover unproven local mint drafts', () => {
  it('legacy minted draft with no mint address or signature becomes retryable', () => {
    const recovered = normalizeStudioDraft(
      draft({
        id: 'draft-020',
        number: 20,
        name: 'ManGo Pixel #020',
        status: 'minted',
        mintAddress: null,
      })
    );

    expect(recovered.status).toBe('failed');
    expect(hasOnChainMintProof(recovered)).toBe(false);
    expect(canMintStudioDraft(recovered)).toBe(true);
    expect(recovered.name).toBe('ManGo Pixel #020');
    expect(recovered.overrides.description).toBe('Recovered pixel description');
    expect(recovered.overrides.attributes).toEqual([{ trait_type: 'Series', value: 'ManGo' }]);
    expect(recovered.artwork?.name).toBe('020.png');
  });

  it('legacy mint_submitted draft with no signature becomes retryable', () => {
    const recovered = normalizeStudioDraft(
      draft({
        id: 'draft-020b',
        number: 20,
        name: 'ManGo Pixel #020',
        status: 'mint_submitted',
        mintAddress: '',
        mintSignature: '   ',
      })
    );

    expect(recovered.status).toBe('failed');
    expect(recovered.mintAddress).toBeNull();
    expect(recovered.mintSignature).toBeNull();
    expect(canMintStudioDraft(recovered)).toBe(true);
  });

  it('real successful minted draft remains protected and read-only', () => {
    const minted = normalizeStudioDraft(
      draft({
        id: 'draft-021',
        number: 21,
        name: 'ManGo Pixel #021',
        status: 'collection_verified',
        mintAddress: 'ADDgMXLtvcxtYavJtqTsNCDv1hd83Fy2px3oyMBGPaPf',
        mintSignature: '3YDL149jQeMjtpi2YrNQ2dMZgLobpx4f5T65R7WXFWtVL4RgXrEUosgZjNEWHJSTbJZVA91wBbS6iB2qitq67vch',
      })
    );

    expect(minted.status).toBe('collection_verified');
    expect(hasOnChainMintProof(minted)).toBe(true);
    expect(canMintStudioDraft(minted)).toBe(false);
  });

  it('on-chain discovered NFT remains View-only', () => {
    const html = renderManagerItemListMarkup(
      mergeManagerListItems({
        discovered: discovery().items,
        drafts: [],
      }),
      { digitCount: 3, network: 'mainnet' }
    );

    expect(html).toContain('On-chain item');
    expect(html).toContain('Verified');
    expect(html).toContain('>View<');
    expect(html).not.toContain('data-draft-action="edit"');
    expect(html).not.toContain('data-draft-action="mint"');
  });

  it('recovered #020-style local draft shows Edit and Failed, not Verified', () => {
    const recovered = normalizeStudioDraft(
      draft({
        id: 'draft-020',
        number: 20,
        name: 'ManGo Pixel #020',
        status: 'minted',
      })
    );
    const prepared023 = draft({
      id: 'draft-023',
      number: 23,
      name: 'ManGo Pixel #023',
      status: 'metadata_ready',
      overrides: {},
    });
    const rows = mergeManagerListItems({
      discovered: discovery().items,
      drafts: [recovered, prepared023],
    });
    const html = renderManagerItemListMarkup(rows, { digitCount: 3, network: 'mainnet' });
    const recoveredRow = rows.find((row) => row.name === 'ManGo Pixel #020');

    expect(recoveredRow?.kind).toBe('local-draft');
    expect(recoveredRow?.minted).toBe(false);
    expect(recoveredRow?.collectionVerified).not.toBe(true);
    expect(html).toContain('ManGo Pixel #020');
    expect(html).toContain('Local draft');
    expect(html).toContain('Failed');
    expect(html).toContain('data-draft-id="draft-020"');
    expect(html).toContain('data-draft-action="edit"');
    expect(html).toContain('data-draft-action="up"');
    expect(html).toContain('data-draft-action="remove"');
    expect(html).toContain('Mint #020');
    expect(html).toContain('ManGo Pixel #023');
    expect(html).toContain('Prepared');
  });

  it('recovered draft preserves name, description, and traits across store load', async () => {
    const store = createMemoryStudioStore();
    await store.putDraft(
      draft({
        id: 'draft-020',
        number: 20,
        name: 'ManGo Pixel #020',
        status: 'minted',
        mintAddress: null,
      })
    );

    const loaded = await store.getDrafts(collectionStudioKey('mainnet', COLLECTION));
    expect(loaded).toHaveLength(1);
    expect(loaded[0].status).toBe('failed');
    expect(loaded[0].id).toBe('draft-020');
    expect(loaded[0].name).toBe('ManGo Pixel #020');
    expect(loaded[0].overrides.description).toBe('Recovered pixel description');
    expect(loaded[0].overrides.attributes).toEqual([{ trait_type: 'Series', value: 'ManGo' }]);
    expect(loaded[0].artwork?.name).toBe('020.png');
  });

  it('wallet rejection before signature does not mark minted or submitted', () => {
    const status = draftStatusAfterMintSend({
      sendSucceeded: false,
      confirmSucceeded: false,
      collectionVerified: false,
    });
    const base = draft({
      id: 'draft-020',
      number: 20,
      name: 'ManGo Pixel #020',
      status: 'metadata_ready',
    });
    const next = markDraftMintOutcome(base, { status });

    expect(status).toBe('failed');
    expect(next.status).toBe('failed');
    expect(shouldMarkDraftFailedAfterMintError(base, null)).toBe(true);
    expect(canMintStudioDraft(next)).toBe(true);
  });

  it('send failure before signature remains retryable', () => {
    const submittedWithoutProof = draft({
      id: 'draft-020',
      number: 20,
      name: 'ManGo Pixel #020',
      status: 'mint_submitted',
      mintAddress: null,
    });

    expect(shouldMarkDraftFailedAfterMintError(submittedWithoutProof, null)).toBe(true);
    expect(
      draftStatusAfterMintSend({
        sendSucceeded: false,
        confirmSucceeded: false,
        collectionVerified: false,
        mintAddress: null,
        signature: null,
      })
    ).toBe('failed');
  });

  it('a returned signature transitions to mint_submitted until confirm succeeds', () => {
    expect(
      draftStatusAfterMintSend({
        sendSucceeded: true,
        confirmSucceeded: false,
        collectionVerified: false,
        mintAddress: 'MintAddress1111111111111111111111111111111',
        signature: '5sig',
      })
    ).toBe('mint_submitted');
  });

  it('confirmed success transitions to minted or collection_verified', () => {
    expect(
      draftStatusAfterMintSend({
        sendSucceeded: true,
        confirmSucceeded: true,
        collectionVerified: false,
        mintAddress: 'MintAddress1111111111111111111111111111111',
        signature: '5sig',
      })
    ).toBe('minted');
    expect(
      draftStatusAfterMintSend({
        sendSucceeded: true,
        confirmSucceeded: true,
        collectionVerified: true,
        mintAddress: 'MintAddress1111111111111111111111111111111',
        signature: '5sig',
      })
    ).toBe('collection_verified');
  });

  it('recovering #020 does not create a duplicate #020 local draft', () => {
    const recovered = normalizeStudioDraft(
      draft({
        id: 'draft-020',
        number: 20,
        name: 'ManGo Pixel #020',
        status: 'minted',
      })
    );
    const prepared023 = draft({
      id: 'draft-023',
      number: 23,
      name: 'ManGo Pixel #023',
      status: 'metadata_ready',
      overrides: {},
    });
    const created = addItemDraftToExistingCollection({
      collection: collectionCache(),
      existingDrafts: [recovered, prepared023],
      numbering: defaultStudioNumbering({ baseName: 'ManGo Pixel' }),
      defaults: defaultStudioDefaults({ symbol: 'MANGO' }),
      discovery: discovery(),
    });

    expect('error' in created).toBe(false);
    if ('error' in created) {
      return;
    }

    expect(created.number).toBe(24);
    expect(created.name).toBe('ManGo Pixel #024');
    expect(created.id).not.toBe('draft-020');
  });

  it('keeps #021 and #022 as unchanged on-chain items', () => {
    const recovered = normalizeStudioDraft(
      draft({
        id: 'draft-020',
        number: 20,
        name: 'ManGo Pixel #020',
        status: 'minted',
      })
    );
    const rows = mergeManagerListItems({
      discovered: discovery().items,
      drafts: [recovered],
    });
    const onChain = rows.filter((row) => row.kind === 'on-chain');

    expect(onChain.map((row) => row.name)).toContain('ManGo Pixel #021');
    expect(onChain.map((row) => row.name)).toContain('ManGo Pixel #022');
    expect(onChain.map((row) => row.name)).not.toContain('ManGo Pixel #020');
    expect(onChain.every((row) => row.minted)).toBe(true);
    expect(onChain.every((row) => row.collectionVerified === true)).toBe(true);
    expect(rows.find((row) => row.name === 'ManGo Pixel #020')?.kind).toBe('local-draft');
  });

  it('keeps a normal prepared #023 draft editable', () => {
    const prepared023 = draft({
      id: 'draft-023',
      number: 23,
      name: 'ManGo Pixel #023',
      status: 'metadata_ready',
      overrides: {},
    });
    const html = renderManagerItemListMarkup(
      mergeManagerListItems({
        discovered: discovery().items,
        drafts: [prepared023],
      }),
      { digitCount: 3, network: 'mainnet' }
    );

    expect(html).toContain('ManGo Pixel #023');
    expect(html).toContain('Prepared');
    expect(html).toContain('data-draft-action="edit"');
    expect(html).toContain('Mint #023');
    expect(canMintStudioDraft(prepared023)).toBe(true);
  });
});

/**
 * Live Collection Manager fingerprint for the real #020 record:
 * Local draft + Minted + View, and no Edit after the empty-proof recovery.
 * That combination requires a locked status plus a non-empty local mintAddress
 * that is not present in DAS collection items.
 */
const PERSISTED_USER_020 = {
  id: 'draft_lz8k2_mango020',
  collectionKey: `mainnet:${COLLECTION}`,
  network: 'mainnet' as const,
  collectionMint: COLLECTION,
  number: 20,
  name: 'ManGo Pixel #020',
  status: 'collection_verified' as const,
  overrides: {
    description: 'A unique ManGo Pixel from the original series.',
    attributes: [
      { trait_type: 'Series', value: 'ManGo' },
      { trait_type: 'Type', value: 'Pixel' },
    ],
  },
  artwork: { name: '020.png', type: 'image/png', size: 184320 },
  mintAddress: '7kStale020MintNotOnMainnet111111111111111',
  mintSignature:
    '5Stale020TxSig111111111111111111111111111111111111111111111111111111111111111111111111111',
  sortIndex: 20,
  createdAt: 1712345678000,
  updatedAt: 1712345678000,
};

const ON_CHAIN_021 = 'ADDgMXLtvcxtYavJtqTsNCDv1hd83Fy2px3oyMBGPaPf';
const ON_CHAIN_022 = 'H22uJsXrb1vpMe2hXTqvEXFuUaEretNejph29TVESuyz';
const ON_CHAIN_024 = 'Completed024MintOnMainnet1111111111111111';

function discoveryWith024() {
  return {
    ok: true as const,
    items: [
      ...discovery().items,
      discovered('ManGo Pixel #024', ON_CHAIN_024, 24),
    ],
    method: COLLECTION_ITEM_DISCOVERY_METHOD,
    readOnly: true as const,
    network: 'mainnet' as const,
  };
}

describe('recover stale local mint proof against collection discovery', () => {
  it('load-time normalization keeps the exact #020 persisted shape locked', () => {
    const loaded = normalizeStudioDraft(PERSISTED_USER_020);

    expect(loaded.status).toBe('collection_verified');
    expect(loaded.mintAddress).toBe(PERSISTED_USER_020.mintAddress);
    expect(loaded.mintSignature).toBe(PERSISTED_USER_020.mintSignature);
    expect(hasOnChainMintProof(loaded)).toBe(true);
    expect(canMintStudioDraft(loaded)).toBe(false);

    const html = renderManagerItemListMarkup(
      mergeManagerListItems({
        discovered: discovery().items,
        drafts: [loaded],
      }),
      { digitCount: 3, network: 'mainnet' }
    );

    expect(html).toContain('ManGo Pixel #020');
    expect(html).toContain('Local draft');
    expect(html).toContain('Minted');
    expect(html).toContain('>View<');
    expect(html).not.toContain('data-draft-action="edit"');
    expect(html).not.toContain('Mint #020');
  });

  it('DAS-corroborated recovery makes the exact #020 record editable and mintable', () => {
    const loaded = normalizeStudioDraft(PERSISTED_USER_020);
    const recovered = recoverDraftAgainstDiscoveredItems(loaded, discovery().items, 42);

    expect(recovered.id).toBe(PERSISTED_USER_020.id);
    expect(recovered.status).toBe('failed');
    expect(recovered.mintAddress).toBeNull();
    expect(recovered.mintSignature).toBeNull();
    expect(recovered.staleMintAddress).toBe(PERSISTED_USER_020.mintAddress);
    expect(recovered.staleMintSignature).toBe(PERSISTED_USER_020.mintSignature);
    expect(recovered.name).toBe('ManGo Pixel #020');
    expect(recovered.number).toBe(20);
    expect(recovered.overrides.description).toBe(PERSISTED_USER_020.overrides.description);
    expect(recovered.overrides.attributes).toEqual(PERSISTED_USER_020.overrides.attributes);
    expect(recovered.artwork).toEqual(PERSISTED_USER_020.artwork);
    expect(hasOnChainMintProof(recovered)).toBe(false);
    expect(canMintStudioDraft(recovered)).toBe(true);

    const rows = mergeManagerListItems({
      discovered: discovery().items,
      drafts: [loaded],
      discoveryOk: true,
    });
    const html = renderManagerItemListMarkup(rows, { digitCount: 3, network: 'mainnet' });
    const recoveredRow = rows.find((row) => row.name === 'ManGo Pixel #020');

    expect(recoveredRow?.kind).toBe('local-draft');
    expect(recoveredRow?.minted).toBe(false);
    expect(recoveredRow?.collectionVerified).not.toBe(true);
    expect(recoveredRow?.mintAddress).toBeNull();
    expect(html).toContain('Local draft');
    expect(html).toContain('Failed');
    expect(html).toContain('data-draft-action="edit"');
    expect(html).toContain('Mint #020');
    expect(rows.filter((row) => row.name === 'ManGo Pixel #020')).toHaveLength(1);
  });

  it('does not unlock #020 when collection discovery failed', () => {
    const loaded = normalizeStudioDraft(PERSISTED_USER_020);
    const html = renderManagerItemListMarkup(
      mergeManagerListItems({
        discovered: [],
        drafts: [loaded],
        discoveryOk: false,
      }),
      { digitCount: 3, network: 'mainnet' }
    );

    expect(loaded.status).toBe('collection_verified');
    expect(canMintStudioDraft(loaded)).toBe(false);
    expect(html).toContain('>View<');
    expect(html).not.toContain('data-draft-action="edit"');
    expect(html).not.toContain('Mint #020');
  });

  it('does not remint #020 if DAS actually has an on-chain #020', () => {
    const loaded = normalizeStudioDraft(PERSISTED_USER_020);
    const items = [
      ...discovery().items,
      discovered('ManGo Pixel #020', 'Real020OnChainMint11111111111111111111111', 20),
    ];
    const recovered = recoverDraftAgainstDiscoveredItems(loaded, items, 42);
    const rows = mergeManagerListItems({
      discovered: items,
      drafts: [loaded],
      discoveryOk: true,
    });
    const html = renderManagerItemListMarkup(rows, { digitCount: 3, network: 'mainnet' });

    expect(recovered.status).toBe('collection_verified');
    expect(recovered.mintAddress).toBe(PERSISTED_USER_020.mintAddress);
    expect(rows.filter((row) => row.name === 'ManGo Pixel #020')).toHaveLength(1);
    expect(rows.find((row) => row.name === 'ManGo Pixel #020')?.kind).toBe('on-chain');
    expect(html).toContain('On-chain item');
    expect(html).toContain('>View<');
    expect(html).not.toContain('data-draft-action="edit"');
    expect(html).not.toContain('Mint #020');
  });

  it('keeps #021 #022 and completed #024 as on-chain View-only', () => {
    const loaded = normalizeStudioDraft(PERSISTED_USER_020);
    const rows = mergeManagerListItems({
      discovered: discoveryWith024().items,
      drafts: [loaded],
      discoveryOk: true,
    });
    const html = renderManagerItemListMarkup(rows, { digitCount: 3, network: 'mainnet' });
    const onChain = rows.filter((row) => row.kind === 'on-chain');

    expect(onChain.map((row) => row.mintAddress)).toContain(ON_CHAIN_021);
    expect(onChain.map((row) => row.mintAddress)).toContain(ON_CHAIN_022);
    expect(onChain.map((row) => row.mintAddress)).toContain(ON_CHAIN_024);
    expect(onChain.every((row) => row.minted)).toBe(true);
    expect(html).toContain('ManGo Pixel #021');
    expect(html).toContain('ManGo Pixel #022');
    expect(html).toContain('ManGo Pixel #024');
    expect(html).toContain('On-chain item');
    expect(rows.find((row) => row.name === 'ManGo Pixel #020')?.kind).toBe('local-draft');
    expect(rows.find((row) => row.name === 'ManGo Pixel #020')?.draft?.status).toBe('failed');
  });

  it('does not create a second #020 after recovering the persisted record', () => {
    const recovered = recoverDraftAgainstDiscoveredItems(
      normalizeStudioDraft(PERSISTED_USER_020),
      discovery().items,
      42
    );
    const created = addItemDraftToExistingCollection({
      collection: collectionCache(),
      existingDrafts: [recovered],
      numbering: defaultStudioNumbering({ baseName: 'ManGo Pixel' }),
      defaults: defaultStudioDefaults({ symbol: 'MANGO' }),
      discovery: discovery(),
    });

    expect('error' in created).toBe(false);
    if ('error' in created) {
      return;
    }

    expect(created.number).not.toBe(20);
    expect(created.name).not.toBe('ManGo Pixel #020');
    expect(created.id).not.toBe(PERSISTED_USER_020.id);
  });

  it('maps legacy nested mintResult proof the same way as mintAddress', () => {
    const loaded = normalizeStudioDraft({
      ...PERSISTED_USER_020,
      mintAddress: null,
      mintSignature: null,
      mintResult: {
        mintAddress: PERSISTED_USER_020.mintAddress,
        signature: PERSISTED_USER_020.mintSignature,
      },
    });

    expect(loaded.mintAddress).toBe(PERSISTED_USER_020.mintAddress);
    expect(loaded.mintSignature).toBe(PERSISTED_USER_020.mintSignature);
    expect(loaded.status).toBe('collection_verified');

    const recovered = recoverDraftAgainstDiscoveredItems(loaded, discovery().items, 42);
    expect(recovered.status).toBe('failed');
    expect(recovered.mintAddress).toBeNull();
    expect(canMintStudioDraft(recovered)).toBe(true);
  });

  it('keeps a minted status + stale mintAddress variant retryable after DAS check', () => {
    const loaded = normalizeStudioDraft({
      ...PERSISTED_USER_020,
      status: 'minted',
    });
    const recovered = recoverDraftAgainstDiscoveredItems(loaded, discovery().items, 42);

    expect(loaded.status).toBe('minted');
    expect(recovered.status).toBe('failed');
    expect(canMintStudioDraft(recovered)).toBe(true);
  });

  it('keeps a DAS-delayed successful mint waiting instead of showing Mint or Verified', () => {
    const minted025 = normalizeStudioDraft(
      draft({
        id: 'draft-025',
        number: 25,
        name: 'ManGo Pixel #025',
        status: 'collection_verified',
        mintAddress: 'Real025Mint111111111111111111111111111111',
        mintSignature:
          '5Real025TxSig111111111111111111111111111111111111111111111111111111111111111111111111111',
        artwork: { name: '025.png', type: 'image/png', size: 24 },
      })
    );
    const recovered = recoverDraftAgainstDiscoveredItems(minted025, discovery().items, {
      now: 42,
      mintAccountPresence: () => 'exists',
    });

    expect(recovered.status).toBe('mint_submitted');
    expect(recovered.mintAddress).toBe(minted025.mintAddress);
    expect(recovered.mintSignature).toBe(minted025.mintSignature);
    expect(hasOnChainMintProof(recovered)).toBe(true);
    expect(canMintStudioDraft(recovered)).toBe(false);

    const rows = mergeManagerListItems({
      discovered: discovery().items,
      drafts: [minted025],
      discoveryOk: true,
      mintAccountPresence: () => 'exists',
    });
    const html = renderManagerItemListMarkup(rows, { digitCount: 3, network: 'mainnet' });
    const waiting = rows.find((row) => row.name === 'ManGo Pixel #025');

    expect(waiting?.kind).toBe('local-draft');
    expect(waiting?.collectionVerified).not.toBe(true);
    expect(html).toContain(COLLECTION_INDEXING_WAIT_LABEL);
    expect(html).not.toContain('Mint #025');
    expect(html).not.toContain('data-draft-action="edit"');
  });

  it('does not recover a mint to failed when on-chain lookup is unknown', () => {
    const minted025 = normalizeStudioDraft(
      draft({
        id: 'draft-025',
        number: 25,
        name: 'ManGo Pixel #025',
        status: 'minted',
        mintAddress: 'Real025Mint111111111111111111111111111111',
        mintSignature: '5sig',
      })
    );
    const recovered = recoverDraftAgainstDiscoveredItems(minted025, discovery().items, {
      mintAccountPresence: () => 'unknown',
    });

    expect(recovered.status).toBe('mint_submitted');
    expect(recovered.mintAddress).toBe(minted025.mintAddress);
    expect(canMintStudioDraft(recovered)).toBe(false);
  });

  it('makes a DAS-confirmed #025 the authoritative on-chain Verified item without Mint', () => {
    const minted025 = normalizeStudioDraft(
      draft({
        id: 'draft-025',
        number: 25,
        name: 'ManGo Pixel #025',
        status: 'mint_submitted',
        mintAddress: 'Real025Mint111111111111111111111111111111',
        mintSignature: '5sig',
      })
    );
    const items = [
      ...discovery().items,
      discovered('ManGo Pixel #025', 'Real025Mint111111111111111111111111111111', 25),
    ];
    const rows = mergeManagerListItems({
      discovered: items,
      drafts: [minted025],
      discoveryOk: true,
      mintAccountPresence: () => 'exists',
    });
    const html = renderManagerItemListMarkup(rows, { digitCount: 3, network: 'mainnet' });
    const confirmed = rows.find((row) => row.name === 'ManGo Pixel #025');

    expect(rows.filter((row) => row.name === 'ManGo Pixel #025')).toHaveLength(1);
    expect(confirmed?.kind).toBe('on-chain');
    expect(confirmed?.collectionVerified).toBe(true);
    expect(confirmed?.mintAddress).toBe('Real025Mint111111111111111111111111111111');
    expect(html).toContain('On-chain item');
    expect(html).toContain('Verified');
    expect(html).toContain('>View<');
    expect(html).not.toContain('Mint #025');
    expect(html).not.toContain(COLLECTION_INDEXING_WAIT_LABEL);
  });

  it('treats account-not-found lookup errors as missing mints', () => {
    expect(classifyMintAccountLookupError(new Error('Account not found at mint'))).toBe('missing');
    expect(classifyMintAccountLookupError(new Error('network down'))).toBe('unknown');
  });
});
