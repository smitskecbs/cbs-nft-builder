import {
  buildStudioItemName,
  canAllocateStudioNumber,
  nextStudioItemNumber,
  type StudioNumbering,
} from './numbering';
import {
  isNumberLocked,
  type DraftStatus,
  type StudioDefaults,
  type StudioDraft,
  type StudioDraftArtwork,
  type StudioDraftOverrides,
} from './types';
import type { NftAttribute } from '../validation/attributes';
import type { SolanaNetwork } from '../solana/config';

export function createDraftId(): string {
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveDraftStatus(params: {
  artwork: StudioDraftArtwork | null;
  name: string;
  current?: DraftStatus;
}): DraftStatus {
  if (params.current === 'mint_submitted' || params.current === 'minted' || params.current === 'collection_verified') {
    return params.current;
  }

  if (params.current === 'failed') {
    return 'failed';
  }

  if (params.artwork && params.name.trim()) {
    return 'metadata_ready';
  }

  if (params.artwork) {
    return 'artwork_uploaded';
  }

  return 'draft';
}

export function createStudioDraft(params: {
  network: SolanaNetwork;
  collectionMint: string | null;
  collectionKey: string;
  number: number;
  numbering: StudioNumbering;
  defaults: StudioDefaults;
  artwork: StudioDraftArtwork | null;
  sortIndex: number;
  now?: number;
}): StudioDraft {
  const now = params.now ?? Date.now();
  const name = buildStudioItemName(params.numbering, params.number);
  void params.defaults;

  return {
    id: createDraftId(),
    collectionKey: params.collectionKey,
    network: params.network,
    collectionMint: params.collectionMint,
    number: params.number,
    name,
    status: resolveDraftStatus({ artwork: params.artwork, name }),
    overrides: {},
    artwork: params.artwork,
    mintAddress: null,
    mintSignature: null,
    sortIndex: params.sortIndex,
    createdAt: now,
    updatedAt: now,
  };
}

export function usedNumbersFromDraftsAndMinted(
  mintedNumbers: readonly number[],
  drafts: readonly StudioDraft[]
): number[] {
  return [...mintedNumbers, ...drafts.map((draft) => draft.number)];
}

export function importFilesAsDrafts(params: {
  files: readonly StudioDraftArtwork[];
  mintedNumbers: readonly number[];
  existingDrafts: readonly StudioDraft[];
  numbering: StudioNumbering;
  defaults: StudioDefaults;
  network: SolanaNetwork;
  collectionMint: string | null;
  collectionKey: string;
  now?: number;
}): {
  drafts: StudioDraft[];
  skipped: number;
  nextSortIndex: number;
} {
  const created: StudioDraft[] = [];
  const used = usedNumbersFromDraftsAndMinted(params.mintedNumbers, [
    ...params.existingDrafts,
  ]);
  let sortIndex =
    params.existingDrafts.reduce((max, draft) => Math.max(max, draft.sortIndex), -1) + 1;
  let skipped = 0;

  for (const artwork of params.files) {
    const workingUsed = [...used, ...created.map((draft) => draft.number)];
    const number = nextStudioItemNumber(workingUsed, params.numbering);

    if (number === null) {
      skipped += 1;
      continue;
    }

    created.push(
      createStudioDraft({
        network: params.network,
        collectionMint: params.collectionMint,
        collectionKey: params.collectionKey,
        number,
        numbering: params.numbering,
        defaults: params.defaults,
        artwork,
        sortIndex,
        now: params.now,
      })
    );
    sortIndex += 1;
  }

  return {
    drafts: created,
    skipped,
    nextSortIndex: sortIndex,
  };
}

export function canReorderDraft(draft: StudioDraft): boolean {
  return !isNumberLocked(draft.status);
}

export function reorderPreparedDrafts(
  drafts: readonly StudioDraft[],
  fromId: string,
  toIndex: number
): StudioDraft[] | { error: string } {
  const ordered = [...drafts].sort((a, b) => a.sortIndex - b.sortIndex);
  const fromIndex = ordered.findIndex((draft) => draft.id === fromId);

  if (fromIndex < 0) {
    return { error: 'Draft was not found.' };
  }

  const moving = ordered[fromIndex];

  if (!canReorderDraft(moving)) {
    return { error: 'A minted NFT number cannot be changed by reordering.' };
  }

  const clamped = Math.max(0, Math.min(toIndex, ordered.length - 1));
  const next = [...ordered];
  next.splice(fromIndex, 1);
  next.splice(clamped, 0, moving);

  return next.map((draft, index) => ({
    ...draft,
    sortIndex: index,
    updatedAt: Date.now(),
  }));
}

export function reassignPreparedNumbers(params: {
  drafts: readonly StudioDraft[];
  mintedNumbers: readonly number[];
  numbering: StudioNumbering;
}): StudioDraft[] | { error: string } {
  const locked = params.drafts.filter((draft) => isNumberLocked(draft.status));
  const movable = [...params.drafts]
    .filter((draft) => canReorderDraft(draft))
    .sort((a, b) => a.sortIndex - b.sortIndex);

  const used = [...params.mintedNumbers, ...locked.map((draft) => draft.number)];
  const updatedMovable: StudioDraft[] = [];

  for (const draft of movable) {
    const number = nextStudioItemNumber(
      [...used, ...updatedMovable.map((item) => item.number)],
      params.numbering
    );

    if (number === null) {
      return { error: 'CBS planned capacity has no remaining numbers for reordering.' };
    }

    const allocated = canAllocateStudioNumber(
      [...used, ...updatedMovable.map((item) => item.number)],
      number,
      params.numbering
    );

    if (!allocated.ok) {
      return allocated;
    }

    const inheritedName = buildStudioItemName(params.numbering, number);
    const nameOverride = draft.overrides?.name;
    updatedMovable.push({
      ...draft,
      number,
      name:
        nameOverride !== undefined ? nameOverride : inheritedName,
      updatedAt: Date.now(),
    });
  }

  const byId = new Map<string, StudioDraft>([
    ...locked.map((draft) => [draft.id, draft] as const),
    ...updatedMovable.map((draft) => [draft.id, draft] as const),
  ]);

  return params.drafts.map((draft) => byId.get(draft.id) ?? draft);
}

export function removeDraft(
  drafts: readonly StudioDraft[],
  draftId: string
): StudioDraft[] | { error: string } {
  const draft = drafts.find((item) => item.id === draftId);

  if (!draft) {
    return { error: 'Draft was not found.' };
  }

  if (isNumberLocked(draft.status)) {
    return { error: 'A minted item cannot be removed from Collection Studio drafts.' };
  }

  return drafts.filter((item) => item.id !== draftId);
}

export function updateDraftFields(
  draft: StudioDraft,
  patch: {
    name?: string;
    overrides?: StudioDraftOverrides;
    descriptionOverride?: string;
    attributes?: NftAttribute[];
    artwork?: StudioDraftArtwork | null;
  }
): StudioDraft | { error: string } {
  if (isNumberLocked(draft.status) && (patch.name || patch.artwork)) {
    return { error: 'A minted NFT cannot be renamed or have its artwork replaced here.' };
  }

  const artwork = patch.artwork === undefined ? draft.artwork : patch.artwork;
  const overrides: StudioDraftOverrides = {
    ...(draft.overrides ?? {}),
    ...(patch.overrides ?? {}),
  };

  if (patch.descriptionOverride !== undefined) {
    overrides.description = patch.descriptionOverride;
  }

  if (patch.attributes !== undefined) {
    overrides.attributes = patch.attributes;
  }

  const name = patch.name?.trim() || overrides.name || draft.name;
  const next: StudioDraft = {
    ...draft,
    name,
    overrides,
    artwork,
    updatedAt: Date.now(),
  };
  next.status = resolveDraftStatus({
    artwork: next.artwork,
    name: next.name,
    current: draft.status === 'failed' ? 'failed' : undefined,
  });
  return next;
}

export function markDraftMintOutcome(
  draft: StudioDraft,
  outcome: {
    status: Extract<DraftStatus, 'mint_submitted' | 'minted' | 'collection_verified' | 'failed'>;
    mintAddress?: string | null;
    mintSignature?: string | null;
  }
): StudioDraft {
  return {
    ...draft,
    status: outcome.status,
    mintAddress: outcome.mintAddress ?? draft.mintAddress,
    mintSignature: outcome.mintSignature ?? draft.mintSignature ?? null,
    updatedAt: Date.now(),
  };
}

export function draftStatusAfterMintSend(params: {
  sendSucceeded: boolean;
  confirmSucceeded: boolean;
  collectionVerified: boolean;
  mintAddress?: string | null;
  signature?: string | null;
}): Extract<DraftStatus, 'mint_submitted' | 'minted' | 'collection_verified' | 'failed'> {
  const hasProof = Boolean(params.mintAddress?.trim() || params.signature?.trim());
  if (!params.sendSucceeded || !hasProof) {
    return 'failed';
  }

  if (!params.confirmSucceeded) {
    return 'mint_submitted';
  }

  return params.collectionVerified ? 'collection_verified' : 'minted';
}

export function effectiveDraftDescription(
  draft: StudioDraft,
  defaults: StudioDefaults
): string {
  const overrides = draft.overrides ?? {};
  if (Object.prototype.hasOwnProperty.call(overrides, 'description')) {
    return overrides.description ?? '';
  }

  return defaults.description;
}
