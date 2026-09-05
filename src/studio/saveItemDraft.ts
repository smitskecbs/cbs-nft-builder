import type { CachedCollection } from '../collection/persistence';
import type { NftAttribute } from '../validation/attributes';
import {
  COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
  type CollectionItemDiscovery,
} from '../solana/discoverCollectionItems';
import { createStudioDraft, updateDraftFields } from './drafts';
import { collectionStudioKey } from './persistence';
import { nextNumberForExistingCollection } from './resume';
import { applyDraftEditorValues } from './resolve';
import { hasOnChainMintProof, isNumberLocked, type StudioDefaults, type StudioDraft, type StudioDraftArtwork } from './types';
import type { StudioNumbering } from './numbering';

export type SaveCollectionItemDraftInput = {
  collection: CachedCollection;
  existingDrafts: readonly StudioDraft[];
  existingDraft: StudioDraft | null;
  numbering: StudioNumbering;
  defaults: StudioDefaults;
  discovery: CollectionItemDiscovery | null;
  name: string;
  description: string;
  externalUrl: string;
  attributes: NftAttribute[];
  artwork: StudioDraftArtwork | null;
};

export type SaveCollectionItemDraftResult =
  | { ok: true; draft: StudioDraft; created: boolean; unchanged: boolean }
  | { ok: false; error: string };

export function shouldAutoSaveBeforeMint(
  editingDraftId: string,
  targetDraftId: string | null
): boolean {
  if (!targetDraftId) {
    return true;
  }

  return editingDraftId === targetDraftId;
}

export function buildSavedCollectionItemDraft(
  input: SaveCollectionItemDraftInput
): SaveCollectionItemDraftResult {
  const existing = input.existingDraft;

  if (existing && (isNumberLocked(existing.status) || hasOnChainMintProof(existing))) {
    return { ok: true, draft: existing, created: false, unchanged: true };
  }

  const editorValues = {
    name: input.name,
    description: input.description,
    externalUrl: input.externalUrl,
    attributes: input.attributes,
  };

  if (existing) {
    const withFields = applyDraftEditorValues(
      existing,
      input.defaults,
      input.numbering,
      editorValues
    );
    const updated = updateDraftFields(withFields, {
      artwork: input.artwork ?? existing.artwork,
    });

    if ('error' in updated) {
      return { ok: false, error: updated.error };
    }

    return { ok: true, draft: updated, created: false, unchanged: false };
  }

  if (!input.discovery?.ok) {
    return {
      ok: false,
      error: input.discovery?.error ?? COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
    };
  }

  const number = nextNumberForExistingCollection(
    input.collection.items,
    input.existingDrafts,
    input.numbering,
    input.discovery.items
  );

  if (number === null) {
    return {
      ok: false,
      error: `CBS planned capacity of ${input.numbering.plannedCapacity} items has been reached. This is not an on-chain maximum.`,
    };
  }

  const draft = createStudioDraft({
    network: input.collection.network,
    collectionMint: input.collection.mint,
    collectionKey: collectionStudioKey(input.collection.network, input.collection.mint),
    number,
    numbering: input.numbering,
    defaults: input.defaults,
    artwork: input.artwork,
    sortIndex: input.existingDrafts.reduce((max, item) => Math.max(max, item.sortIndex), -1) + 1,
  });
  const named = applyDraftEditorValues(draft, input.defaults, input.numbering, editorValues);
  const withArtwork = updateDraftFields(named, { artwork: input.artwork });

  if ('error' in withArtwork) {
    return { ok: false, error: withArtwork.error };
  }

  return { ok: true, draft: withArtwork, created: true, unchanged: false };
}
