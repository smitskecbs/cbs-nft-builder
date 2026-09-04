import { collectionStudioKey } from './persistence';
import type { StudioDraft } from './types';
import type { SolanaNetwork } from '../solana/config';

export function attachDraftsToCollectionMint(
  drafts: readonly StudioDraft[],
  params: {
    collectionMint: string;
    network: SolanaNetwork;
    now?: number;
  }
): StudioDraft[] {
  const collectionKey = collectionStudioKey(params.network, params.collectionMint);
  const now = params.now ?? Date.now();

  return drafts.map((draft) => ({
    ...draft,
    collectionKey,
    collectionMint: params.collectionMint,
    network: params.network,
    updatedAt: now,
  }));
}

/**
 * After a collection NFT exists, pending local drafts should continue in the
 * Collection Manager. If the mint already has drafts, leave pending drafts
 * untouched so a later uncreated collection is not stolen.
 */
export function draftsForOpenedCollection(params: {
  collectionDrafts: readonly StudioDraft[];
  pendingDrafts: readonly StudioDraft[];
  collectionMint: string;
  network: SolanaNetwork;
  now?: number;
}): {
  drafts: StudioDraft[];
  newlyLinked: StudioDraft[];
} {
  if (params.collectionDrafts.length > 0) {
    return {
      drafts: [...params.collectionDrafts],
      newlyLinked: [],
    };
  }

  const adoptable = params.pendingDrafts.filter(
    (draft) => draft.collectionMint === null && draft.mintAddress === null
  );

  if (adoptable.length === 0) {
    return { drafts: [], newlyLinked: [] };
  }

  const newlyLinked = attachDraftsToCollectionMint(adoptable, {
    collectionMint: params.collectionMint,
    network: params.network,
    now: params.now,
  });

  return {
    drafts: newlyLinked,
    newlyLinked,
  };
}

export function collectionCreateDoesNotMintItems(
  before: readonly StudioDraft[],
  after: readonly StudioDraft[]
): boolean {
  if (before.length !== after.length) {
    return false;
  }

  return after.every((draft, index) => {
    const previous = before[index];
    return (
      draft.id === previous.id &&
      draft.mintAddress === previous.mintAddress &&
      draft.status === previous.status &&
      JSON.stringify(draft.overrides) === JSON.stringify(previous.overrides)
    );
  });
}
