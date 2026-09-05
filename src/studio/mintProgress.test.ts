import { describe, expect, it } from 'vitest';

import { canMintStudioDraft } from './itemMint';
import {
  FORM_MINT_IDLE_LABEL,
  MINT_COMPLETE_VERIFIED_HEADLINE,
  MINT_SUBMITTED_INDEXING_HEADLINE,
  MINTING_BUTTON_LABEL,
  createMintBusyLock,
  dasConfirmedCollectionItem,
  idleMintProgress,
  mintActionButtonView,
  mintProgressBar,
  mintProgressHeadline,
  mintProgressSteps,
  reduceMintProgress,
  workflowStagesFor,
  type MintProgressState,
} from './mintProgress';
import type { StudioDraft } from './types';
import { renderCollectionMintButtonMarkup, renderMintProgressMarkup } from '../ui/mintProgressView';

function run(
  events: Parameters<typeof reduceMintProgress>[1][],
  initial: MintProgressState = idleMintProgress()
): MintProgressState {
  return events.reduce((state, event) => reduceMintProgress(state, event), initial);
}

function preparedDraft(status: StudioDraft['status'], proof = false): StudioDraft {
  return {
    id: 'draft-027',
    collectionKey: 'mainnet:Collection11111111111111111111111111111',
    network: 'mainnet',
    collectionMint: 'Collection11111111111111111111111111111',
    number: 27,
    name: 'Pixel Item #027',
    status,
    overrides: {},
    artwork: { name: '027.png', type: 'image/png', size: 12 },
    mintAddress: proof ? 'Mint111111111111111111111111111111111111111' : null,
    mintSignature: proof
      ? '5Sig111111111111111111111111111111111111111111111111111111111111111111111111111111111111'
      : null,
    sortIndex: 27,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('collection mint progress', () => {
  it('starts with the real auto-save stage and disables Mint immediately', () => {
    const state = reduceMintProgress(idleMintProgress(), {
      type: 'start',
      includeSaving: true,
    });
    const button = mintActionButtonView(true, FORM_MINT_IDLE_LABEL);

    expect(state.phase).toBe('saving');
    expect(mintProgressHeadline(state)).toBe('Saving draft...');
    expect(button).toEqual({
      disabled: true,
      label: MINTING_BUTTON_LABEL,
      ariaBusy: true,
    });
    expect(mintProgressSteps(state)[0]).toMatchObject({
      stage: 'saving',
      status: 'current',
    });
  });

  it('skips saving when the card mint does not auto-save', () => {
    const state = reduceMintProgress(idleMintProgress(), {
      type: 'start',
      includeSaving: false,
    });

    expect(state.phase).toBe('preparing');
    expect(workflowStagesFor(false)[0]).toBe('preparing');
    expect(mintProgressSteps(state).some((step) => step.stage === 'saving')).toBe(false);
  });

  it('advances only to the next real stage', () => {
    const saving = reduceMintProgress(idleMintProgress(), {
      type: 'start',
      includeSaving: true,
    });
    const skipped = reduceMintProgress(saving, { type: 'stage', stage: 'awaitingWallet' });
    const completeTooSoon = reduceMintProgress(saving, { type: 'completeVerified' });
    const preparing = reduceMintProgress(saving, { type: 'stage', stage: 'preparing' });

    expect(skipped.phase).toBe('saving');
    expect(completeTooSoon.phase).toBe('saving');
    expect(preparing.phase).toBe('preparing');
    expect(mintProgressBar(preparing)).toEqual({ completed: 1, total: 8 });
  });

  it('shows the wallet approval stage before send returns', () => {
    const state = run([
      { type: 'start', includeSaving: true },
      { type: 'stage', stage: 'preparing' },
      { type: 'stage', stage: 'authorizingUpload' },
      { type: 'stage', stage: 'uploadingArtwork' },
      { type: 'stage', stage: 'uploadingMetadata' },
      { type: 'stage', stage: 'awaitingWallet' },
    ]);

    expect(state.phase).toBe('awaitingWallet');
    expect(mintProgressHeadline(state)).toBe('Waiting for wallet approval...');
    expect(mintProgressSteps(state).find((step) => step.stage === 'awaitingWallet')?.status).toBe(
      'current'
    );
    expect(mintProgressSteps(state).find((step) => step.stage === 'confirming')?.status).toBe(
      'pending'
    );
  });

  it('marks wallet rejection as cancelled, preserves later stages as not complete, and keeps an unproven draft mintable', () => {
    const state = run([
      { type: 'start', includeSaving: true },
      { type: 'stage', stage: 'preparing' },
      { type: 'stage', stage: 'authorizingUpload' },
      { type: 'stage', stage: 'uploadingArtwork' },
      { type: 'stage', stage: 'uploadingMetadata' },
      { type: 'stage', stage: 'awaitingWallet' },
      { type: 'cancel', error: 'Wallet request was cancelled.' },
    ]);

    expect(state.phase).toBe('cancelled');
    expect(state.failedStage).toBe('awaitingWallet');
    expect(state.dasVerified).toBe(false);
    expect(mintProgressHeadline(state)).toBe('Mint cancelled');
    expect(mintProgressHeadline(state)).not.toContain('Verified');
    expect(mintProgressHeadline(state)).not.toContain('complete');
    expect(mintProgressSteps(state).find((step) => step.stage === 'confirming')?.status).toBe(
      'pending'
    );
    expect(mintProgressSteps(state).find((step) => step.stage === 'indexing')?.status).toBe(
      'pending'
    );
    expect(canMintStudioDraft(preparedDraft('failed'))).toBe(true);
  });

  it('never reaches Complete after a transaction send failure', () => {
    const state = run([
      { type: 'start', includeSaving: true },
      { type: 'stage', stage: 'preparing' },
      { type: 'stage', stage: 'authorizingUpload' },
      { type: 'stage', stage: 'uploadingArtwork' },
      { type: 'stage', stage: 'uploadingMetadata' },
      { type: 'stage', stage: 'awaitingWallet' },
      { type: 'fail', error: 'The mint transaction could not be simulated. Check the form and try again.' },
    ]);
    const forcedComplete = reduceMintProgress(state, { type: 'completeVerified' });

    expect(state.phase).toBe('failed');
    expect(state.failedStage).toBe('awaitingWallet');
    expect(forcedComplete.phase).toBe('failed');
    expect(mintProgressHeadline(state)).toBe('Wallet approval failed');
    expect(mintProgressHeadline(state)).not.toBe(MINT_COMPLETE_VERIFIED_HEADLINE);
    expect(canMintStudioDraft(preparedDraft('failed'))).toBe(true);
  });

  it('enters waiting-for-indexing after a successful send without DAS confirmation', () => {
    const state = run([
      { type: 'start', includeSaving: true },
      { type: 'stage', stage: 'preparing' },
      { type: 'stage', stage: 'authorizingUpload' },
      { type: 'stage', stage: 'uploadingArtwork' },
      { type: 'stage', stage: 'uploadingMetadata' },
      { type: 'stage', stage: 'awaitingWallet' },
      { type: 'stage', stage: 'confirming' },
      { type: 'indexing' },
    ]);

    expect(state.phase).toBe('indexing');
    expect(state.transactionSucceeded).toBe(true);
    expect(state.dasVerified).toBe(false);
    expect(mintProgressHeadline(state)).toBe(MINT_SUBMITTED_INDEXING_HEADLINE);
    expect(mintProgressSteps(state).find((step) => step.stage === 'confirming')?.status).toBe(
      'complete'
    );
    expect(mintProgressSteps(state).find((step) => step.stage === 'indexing')?.status).toBe(
      'current'
    );
    expect(canMintStudioDraft(preparedDraft('mint_submitted', true))).toBe(false);
  });

  it('reaches Verified/Complete only after DAS confirms the mint', () => {
    const indexing = run([
      { type: 'start', includeSaving: false },
      { type: 'stage', stage: 'authorizingUpload' },
      { type: 'stage', stage: 'uploadingArtwork' },
      { type: 'stage', stage: 'uploadingMetadata' },
      { type: 'stage', stage: 'awaitingWallet' },
      { type: 'stage', stage: 'confirming' },
      { type: 'indexing' },
    ]);
    const tooEarly = dasConfirmedCollectionItem(
      [{ mint: 'Mint111111111111111111111111111111111111111', collectionVerified: null }],
      'Mint111111111111111111111111111111111111111'
    );
    const confirmed = dasConfirmedCollectionItem(
      [{ mint: 'Mint111111111111111111111111111111111111111', collectionVerified: true }],
      'Mint111111111111111111111111111111111111111'
    );
    const complete = reduceMintProgress(indexing, { type: 'completeVerified' });

    expect(tooEarly).toBe(false);
    expect(confirmed).toBe(true);
    expect(complete.phase).toBe('complete');
    expect(complete.dasVerified).toBe(true);
    expect(mintProgressHeadline(complete)).toBe(MINT_COMPLETE_VERIFIED_HEADLINE);
    expect(mintProgressBar(complete)).toEqual({ completed: 7, total: 7 });
  });

  it('does not start a second mint while a lock is held', () => {
    const lock = createMintBusyLock();

    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
    expect(lock.tryAcquire()).toBe(false);
    expect(lock.isHeld()).toBe(true);

    lock.release();
    expect(lock.tryAcquire()).toBe(true);
  });

  it('does not treat a later stage as complete after an earlier upload failure', () => {
    const state = run([
      { type: 'start', includeSaving: true },
      { type: 'stage', stage: 'preparing' },
      { type: 'stage', stage: 'authorizingUpload' },
      { type: 'stage', stage: 'uploadingArtwork' },
      { type: 'fail', error: 'Artwork or metadata upload failed. Please try again.' },
    ]);
    const skipped = reduceMintProgress(state, { type: 'stage', stage: 'uploadingMetadata' });

    expect(state.phase).toBe('failed');
    expect(state.failedStage).toBe('uploadingArtwork');
    expect(skipped.phase).toBe('failed');
    expect(mintProgressSteps(state).find((step) => step.stage === 'uploadingArtwork')?.status).toBe(
      'failed'
    );
    expect(mintProgressSteps(state).find((step) => step.stage === 'awaitingWallet')?.status).toBe(
      'pending'
    );
    expect(mintProgressHeadline(state)).not.toBe(MINT_COMPLETE_VERIFIED_HEADLINE);
  });
});

describe('mint progress UI', () => {
  it('renders the current operation, completed steps, and stage-based bar', () => {
    const state = run([
      { type: 'start', includeSaving: true },
      { type: 'stage', stage: 'preparing' },
      { type: 'stage', stage: 'authorizingUpload' },
      { type: 'stage', stage: 'uploadingArtwork' },
      { type: 'stage', stage: 'uploadingMetadata' },
      { type: 'stage', stage: 'awaitingWallet' },
    ]);
    const html = renderMintProgressMarkup(state);

    expect(html).toContain('Waiting for wallet approval...');
    expect(html).toContain('aria-valuenow="5"');
    expect(html).toContain('aria-valuemax="8"');
    expect(html).toContain('is-current');
    expect(html).toContain('is-complete');
    expect(html).toContain('Confirm transaction');
    expect(html).not.toContain('Mint complete');
  });

  it('renders a disabled Minting... button for the in-progress collection mint', () => {
    const html = renderCollectionMintButtonMarkup('draft-027', 'Mint #027', true);

    expect(html).toContain('Minting...');
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-draft-action="mint"');
    expect(html).not.toContain('>Mint #027<');
  });
});
