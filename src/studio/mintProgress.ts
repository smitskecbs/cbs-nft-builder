export const FORM_MINT_IDLE_LABEL = 'Mint this item';
export const MINTING_BUTTON_LABEL = 'Minting...';
export const MINT_SUBMITTED_INDEXING_HEADLINE =
  'Mint submitted — waiting for on-chain indexing';
export const MINT_COMPLETE_VERIFIED_HEADLINE = 'Mint complete — Verified';

export type MintWorkflowStage =
  | 'saving'
  | 'preparing'
  | 'authorizingUpload'
  | 'uploadingArtwork'
  | 'uploadingMetadata'
  | 'awaitingWallet'
  | 'confirming'
  | 'indexing';

export type MintProgressPhase =
  | 'idle'
  | MintWorkflowStage
  | 'complete'
  | 'failed'
  | 'cancelled';

export type MintProgressState = {
  phase: MintProgressPhase;
  includeSaving: boolean;
  itemName: string | null;
  error: string | null;
  failedStage: MintWorkflowStage | null;
  transactionSucceeded: boolean;
  dasVerified: boolean;
};

export type MintProgressEvent =
  | { type: 'start'; includeSaving: boolean; itemName?: string | null }
  | { type: 'stage'; stage: MintWorkflowStage }
  | { type: 'fail'; error: string }
  | { type: 'cancel'; error: string }
  | { type: 'indexing' }
  | { type: 'completeVerified' }
  | { type: 'reset' };

export const MINT_WORKFLOW_STAGES: readonly MintWorkflowStage[] = [
  'saving',
  'preparing',
  'authorizingUpload',
  'uploadingArtwork',
  'uploadingMetadata',
  'awaitingWallet',
  'confirming',
  'indexing',
];

const STEP_LABELS: Record<MintWorkflowStage, string> = {
  saving: 'Saving draft',
  preparing: 'Preparing artwork',
  authorizingUpload: 'Authorize upload',
  uploadingArtwork: 'Upload artwork',
  uploadingMetadata: 'Upload metadata',
  awaitingWallet: 'Wallet approval',
  confirming: 'Confirm transaction',
  indexing: 'Collection indexing',
};

const ACTIVE_HEADLINES: Record<MintWorkflowStage, string> = {
  saving: 'Saving draft...',
  preparing: 'Preparing artwork...',
  authorizingUpload: 'Waiting for upload authorization...',
  uploadingArtwork: 'Uploading artwork...',
  uploadingMetadata: 'Uploading metadata...',
  awaitingWallet: 'Waiting for wallet approval...',
  confirming: 'Confirming transaction...',
  indexing: 'Waiting for on-chain indexing...',
};

export function idleMintProgress(): MintProgressState {
  return {
    phase: 'idle',
    includeSaving: true,
    itemName: null,
    error: null,
    failedStage: null,
    transactionSucceeded: false,
    dasVerified: false,
  };
}

export function createMintBusyLock(): {
  isHeld: () => boolean;
  tryAcquire: () => boolean;
  release: () => void;
} {
  let held = false;

  return {
    isHeld: () => held,
    tryAcquire: () => {
      if (held) {
        return false;
      }
      held = true;
      return true;
    },
    release: () => {
      held = false;
    },
  };
}

export function workflowStagesFor(includeSaving: boolean): MintWorkflowStage[] {
  return includeSaving
    ? [...MINT_WORKFLOW_STAGES]
    : MINT_WORKFLOW_STAGES.filter((stage) => stage !== 'saving');
}

export function isMintProgressActive(state: MintProgressState): boolean {
  return MINT_WORKFLOW_STAGES.includes(state.phase as MintWorkflowStage);
}

export function mintActionButtonView(
  mintInProgress: boolean,
  idleLabel: string
): { disabled: boolean; label: string; ariaBusy: boolean } {
  if (mintInProgress) {
    return {
      disabled: true,
      label: MINTING_BUTTON_LABEL,
      ariaBusy: true,
    };
  }

  return {
    disabled: false,
    label: idleLabel,
    ariaBusy: false,
  };
}

export function mintProgressHeadline(state: MintProgressState): string {
  if (state.phase === 'complete' || state.dasVerified) {
    return MINT_COMPLETE_VERIFIED_HEADLINE;
  }

  if (state.phase === 'indexing' && state.transactionSucceeded) {
    return MINT_SUBMITTED_INDEXING_HEADLINE;
  }

  if (state.phase === 'failed') {
    return state.failedStage
      ? `${STEP_LABELS[state.failedStage]} failed`
      : 'Mint failed';
  }

  if (state.phase === 'cancelled') {
    return 'Mint cancelled';
  }

  if (state.phase === 'idle') {
    return '';
  }

  return ACTIVE_HEADLINES[state.phase];
}

export function mintProgressDetail(state: MintProgressState): string {
  if (state.phase === 'awaitingWallet') {
    return 'Approve the mint in your wallet. The Builder is waiting — it is not frozen.';
  }

  if (state.phase === 'authorizingUpload') {
    return 'Approve the upload signature in your wallet. This does not send a mint transaction.';
  }

  if (state.phase === 'indexing' && state.transactionSucceeded && !state.dasVerified) {
    return 'The transaction succeeded. Collection Manager will show Verified after on-chain indexing.';
  }

  if (state.phase === 'complete') {
    return 'DAS confirmed this item in the collection.';
  }

  if ((state.phase === 'failed' || state.phase === 'cancelled') && state.error) {
    return state.error;
  }

  return '';
}

export function mintProgressBar(state: MintProgressState): {
  completed: number;
  total: number;
} {
  const stages = workflowStagesFor(state.includeSaving);
  const total = stages.length;

  if (state.phase === 'complete' || state.dasVerified) {
    return { completed: total, total };
  }

  if (state.phase === 'idle') {
    return { completed: 0, total };
  }

  const current =
    state.phase === 'failed' || state.phase === 'cancelled'
      ? state.failedStage
      : state.phase;
  const index = current ? stages.indexOf(current) : -1;

  if (index < 0) {
    return { completed: 0, total };
  }

  return { completed: index, total };
}

export function mintProgressSteps(state: MintProgressState): Array<{
  stage: MintWorkflowStage;
  label: string;
  status: 'complete' | 'current' | 'pending' | 'failed';
}> {
  const stages = workflowStagesFor(state.includeSaving);
  const failedStage =
    state.phase === 'failed' || state.phase === 'cancelled' ? state.failedStage : null;
  const currentStage: MintWorkflowStage | null =
    failedStage ??
    (state.phase === 'complete' || state.dasVerified
      ? null
      : MINT_WORKFLOW_STAGES.includes(state.phase as MintWorkflowStage)
        ? (state.phase as MintWorkflowStage)
        : null);
  const currentIndex = currentStage ? stages.indexOf(currentStage) : stages.length;

  return stages.map((stage, index) => {
    if (failedStage === stage) {
      return {
        stage,
        label: STEP_LABELS[stage],
        status: 'failed' as const,
      };
    }

    if (state.phase === 'complete' || state.dasVerified || index < currentIndex) {
      return {
        stage,
        label: STEP_LABELS[stage],
        status: 'complete' as const,
      };
    }

    if (index === currentIndex) {
      return {
        stage,
        label: ACTIVE_HEADLINES[stage],
        status: 'current' as const,
      };
    }

    return {
      stage,
      label: STEP_LABELS[stage],
      status: 'pending' as const,
    };
  });
}

export function dasConfirmedCollectionItem(
  items: readonly { mint: string; collectionVerified: boolean | null }[],
  mintAddress: string | null | undefined
): boolean {
  const mint = mintAddress?.trim() ?? '';
  if (!mint) {
    return false;
  }

  return items.some((item) => item.mint === mint && item.collectionVerified === true);
}

export function reduceMintProgress(
  state: MintProgressState,
  event: MintProgressEvent
): MintProgressState {
  if (event.type === 'reset') {
    return idleMintProgress();
  }

  if (event.type === 'start') {
    const includeSaving = event.includeSaving;
    return {
      phase: includeSaving ? 'saving' : 'preparing',
      includeSaving,
      itemName: event.itemName?.trim() || null,
      error: null,
      failedStage: null,
      transactionSucceeded: false,
      dasVerified: false,
    };
  }

  if (state.phase === 'idle') {
    return state;
  }

  if (event.type === 'fail' || event.type === 'cancel') {
    if (state.phase === 'complete' || state.dasVerified) {
      return state;
    }

    if (state.transactionSucceeded) {
      return {
        ...state,
        phase: 'indexing',
        error: event.error,
        failedStage: null,
      };
    }

    const failedStage = activeWorkflowStage(state);
    return {
      ...state,
      phase: event.type === 'cancel' ? 'cancelled' : 'failed',
      error: event.error,
      failedStage,
      dasVerified: false,
    };
  }

  if (event.type === 'stage') {
    if (!canAdvanceTo(state, event.stage)) {
      return state;
    }

    return {
      ...state,
      phase: event.stage,
      error: null,
      failedStage: null,
      transactionSucceeded:
        state.transactionSucceeded ||
        event.stage === 'confirming' ||
        event.stage === 'indexing',
    };
  }

  if (event.type === 'indexing') {
    if (state.phase !== 'confirming' && state.phase !== 'indexing') {
      return state;
    }

    return {
      ...state,
      phase: 'indexing',
      transactionSucceeded: true,
      error: null,
      failedStage: null,
    };
  }

  if (event.type === 'completeVerified') {
    if (state.phase !== 'indexing' && state.phase !== 'confirming') {
      return state;
    }

    return {
      ...state,
      phase: 'complete',
      transactionSucceeded: true,
      dasVerified: true,
      error: null,
      failedStage: null,
    };
  }

  return state;
}

function activeWorkflowStage(state: MintProgressState): MintWorkflowStage | null {
  if (MINT_WORKFLOW_STAGES.includes(state.phase as MintWorkflowStage)) {
    return state.phase as MintWorkflowStage;
  }

  return state.failedStage;
}

function canAdvanceTo(state: MintProgressState, next: MintWorkflowStage): boolean {
  if (state.phase === 'failed' || state.phase === 'cancelled' || state.phase === 'complete') {
    return false;
  }

  const stages = workflowStagesFor(state.includeSaving);
  const currentIndex = stages.indexOf(state.phase as MintWorkflowStage);
  const nextIndex = stages.indexOf(next);

  if (currentIndex < 0 || nextIndex < 0) {
    return false;
  }

  return nextIndex === currentIndex + 1;
}
