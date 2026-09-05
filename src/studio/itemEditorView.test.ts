import { describe, expect, it } from 'vitest';

import { addItemDraftToExistingCollection } from './resume';
import { defaultStudioDefaults } from './defaults';
import { defaultStudioNumbering } from './numbering';
import { COLLECTION_ITEM_DISCOVERY_METHOD } from '../solana/discoverCollectionItems';
import {
  applyCollectionStudioPane,
  collectionItemEditorAutoUploadsOrMints,
  collectionItemEditorHeading,
  leavingCollectionItemEditorDeletesDraft,
} from './itemEditorView';
import { renderAppMarkup } from '../ui/renderApp';

describe('collection item editor view', () => {
  it('titles the editor with the active NFT name and does not auto-upload or mint', () => {
    expect(collectionItemEditorHeading('ManGo Pixel #010')).toBe('Create ManGo Pixel #010');
    expect(collectionItemEditorHeading('  Cats #002  ')).toBe('Create Cats #002');
    expect(collectionItemEditorAutoUploadsOrMints()).toBe(false);
    expect(leavingCollectionItemEditorDeletesDraft()).toBe(false);
  });

  it('shows the full mint form immediately and hides the gallery', () => {
    const gallery = { hidden: false };
    const editor = { hidden: true };
    const extras = { hidden: false };

    applyCollectionStudioPane({
      pane: 'item-editor',
      gallery,
      editor,
      extras,
    });

    expect(gallery.hidden).toBe(true);
    expect(editor.hidden).toBe(false);
    expect(extras.hidden).toBe(true);

    applyCollectionStudioPane({
      pane: 'gallery',
      gallery,
      editor,
      extras,
    });

    expect(gallery.hidden).toBe(false);
    expect(editor.hidden).toBe(true);
    expect(extras.hidden).toBe(false);
  });

  it('keeps artwork, name, description, traits, save, and mint on the existing form', () => {
    const html = renderAppMarkup();

    expect(html).toContain('id="collectionItemForm"');
    expect(html).toContain('id="collectionItemEditorTitle"');
    expect(html).toContain('id="backToCollectionButton"');
    expect(html).toContain('← Back to collection');
    expect(html).toContain('id="collectionItemArtworkInput"');
    expect(html).toContain('id="collectionItemArtworkPreview"');
    expect(html).toContain('id="collectionItemName"');
    expect(html).toContain('id="collectionItemDescription"');
    expect(html).toContain('id="collectionItemAttributeRows"');
    expect(html).toContain('id="saveDraftButton"');
    expect(html).toContain('id="createCollectionItemButton"');
    expect(html).toContain('form-group-artwork');
    expect(html).toContain('<legend>Details</legend>');
    expect(html).toContain('<legend>Traits (optional)</legend>');
    expect(html).toContain('id="studioGallery"');
    expect(html).toContain('id="studioAdvancedDetails"');
    expect(html).toMatch(/id="collectionItemForm"[^>]*\bhidden\b/);
    expect(html).toContain('type="button" class="ghost-btn back-to-collection-btn"');
    expect(html).not.toContain('Mint one item');
  });

  it('uses the same editor heading for an existing local draft', () => {
    expect(collectionItemEditorHeading('Cats #001')).toBe('Create Cats #001');
  });

  it('creates the next numbered draft without minting or deleting it on back', () => {
    const created = addItemDraftToExistingCollection({
      collection: {
        mint: 'ColMint',
        network: 'mainnet',
        name: 'Cats Collection',
        symbol: 'CATS',
        plannedMaxItems: 100,
        itemNamePrefix: 'Cats',
        digitCount: 3,
        startNumber: 1,
        commonDescription: '',
        commonExternalUrl: '',
        commonRoyaltyPercent: 0,
        commonAttributes: [],
        isMutableDefault: true,
        items: [
          { mint: 'Item1', number: 1, verified: true },
          { mint: 'Item2', number: 2, verified: true },
        ],
      },
      existingDrafts: [],
      numbering: defaultStudioNumbering({ baseName: 'Cats' }),
      defaults: defaultStudioDefaults({ symbol: 'CATS' }),
      discovery: {
        ok: true,
        items: [],
        method: COLLECTION_ITEM_DISCOVERY_METHOD,
        readOnly: true,
        network: 'mainnet',
      },
    });

    expect('error' in created).toBe(false);
    if ('error' in created) {
      return;
    }

    expect(created.number).toBe(3);
    expect(created.name).toBe('Cats #003');
    expect(created.mintAddress).toBeNull();
    expect(created.status).toBe('draft');
    expect(leavingCollectionItemEditorDeletesDraft()).toBe(false);
    expect(collectionItemEditorHeading(created.name)).toBe('Create Cats #003');
  });
});
