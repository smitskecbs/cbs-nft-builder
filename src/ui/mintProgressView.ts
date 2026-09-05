import { escapeHtml } from './html';
import {
  FORM_MINT_IDLE_LABEL,
  mintActionButtonView,
  mintProgressBar,
  mintProgressDetail,
  mintProgressHeadline,
  mintProgressSteps,
  type MintProgressState,
} from '../studio/mintProgress';

export { FORM_MINT_IDLE_LABEL };

export function renderMintProgressMarkup(state: MintProgressState): string {
  if (state.phase === 'idle') {
    return '';
  }

  const headline = mintProgressHeadline(state);
  const detail = mintProgressDetail(state);
  const bar = mintProgressBar(state);
  const percent = bar.total === 0 ? 0 : Math.round((bar.completed / bar.total) * 100);
  const steps = mintProgressSteps(state);
  const tone =
    state.phase === 'complete'
      ? 'success'
      : state.phase === 'failed' || state.phase === 'cancelled'
        ? 'error'
        : 'loading';
  const dismissible =
    state.phase === 'complete' ||
    state.phase === 'failed' ||
    state.phase === 'cancelled' ||
    (state.phase === 'indexing' && state.transactionSucceeded);
  const close = dismissible
    ? '<button type="button" class="secondary-btn mint-progress-close" id="mintProgressClose">Close</button>'
    : '';

  return `
    <div class="mint-progress mint-progress--${tone}" data-mint-progress-phase="${escapeHtml(state.phase)}">
      <p id="mintProgressTitle" class="mint-progress-headline">${escapeHtml(headline)}</p>
      ${detail ? `<p class="mint-progress-detail">${escapeHtml(detail)}</p>` : ''}
      <div
        class="mint-progress-bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="${bar.total}"
        aria-valuenow="${bar.completed}"
        aria-label="Mint stages completed"
      >
        <div class="mint-progress-bar-fill" style="width: ${percent}%"></div>
      </div>
      <p class="mint-progress-count">${bar.completed} of ${bar.total} stages complete</p>
      <ol class="mint-progress-steps">
        ${steps
          .map(
            (step) => `
          <li class="mint-progress-step is-${step.status}" ${
            step.status === 'current' ? 'aria-current="step"' : ''
          }>
            <span class="mint-progress-step-mark" aria-hidden="true"></span>
            <span class="mint-progress-step-label">${escapeHtml(step.label)}</span>
          </li>`
          )
          .join('')}
      </ol>
      ${close}
    </div>
  `;
}

export function renderCollectionMintButtonMarkup(
  draftId: string,
  idleLabel: string,
  mintInProgress: boolean
): string {
  const view = mintActionButtonView(mintInProgress, idleLabel);
  const idleAttr = mintInProgress
    ? ` data-mint-idle-label="${escapeHtml(idleLabel)}"`
    : '';
  const disabled = view.disabled ? ' disabled' : '';

  return `<button type="button" class="primary-btn" data-draft-action="mint" data-draft-id="${escapeHtml(draftId)}"${idleAttr}${disabled} aria-busy="${view.ariaBusy ? 'true' : 'false'}">${escapeHtml(view.label)}</button>`;
}

export function applyMintingButtonState(
  root: ParentNode,
  mintInProgress: boolean
): void {
  const formButton = root.querySelector<HTMLButtonElement>('#createCollectionItemButton');
  if (formButton) {
    const view = mintActionButtonView(mintInProgress, FORM_MINT_IDLE_LABEL);
    formButton.disabled = view.disabled;
    formButton.setAttribute('aria-busy', view.ariaBusy ? 'true' : 'false');
    formButton.textContent = view.label;
  }

  root.querySelectorAll<HTMLButtonElement>('[data-draft-action="mint"]').forEach((button) => {
    const idleLabel = button.dataset.mintIdleLabel || button.textContent?.trim() || 'Mint';
    if (mintInProgress && !button.dataset.mintIdleLabel) {
      button.dataset.mintIdleLabel = idleLabel;
    }
    const view = mintActionButtonView(mintInProgress, idleLabel);
    button.disabled = view.disabled;
    button.setAttribute('aria-busy', view.ariaBusy ? 'true' : 'false');
    button.textContent = view.label;
    if (!mintInProgress) {
      delete button.dataset.mintIdleLabel;
    }
  });
}

export function ensureMintProgressOverlay(): HTMLElement {
  let overlay = document.getElementById('mintProgressOverlay');

  if (overlay) {
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = 'mintProgressOverlay';
  overlay.className = 'action-popup-overlay mint-progress-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="action-popup-card mint-progress-card" role="dialog" aria-modal="true" aria-labelledby="mintProgressTitle" aria-live="polite">
      <div id="mintProgressBody"></div>
    </div>
  `;
  overlay.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.id === 'mintProgressClose') {
      overlay.hidden = true;
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

export function showMintProgressOverlay(state: MintProgressState): void {
  const overlay = ensureMintProgressOverlay();
  const body = overlay.querySelector('#mintProgressBody');
  if (body) {
    body.innerHTML = renderMintProgressMarkup(state);
  }
  overlay.hidden = state.phase === 'idle';
}

export function hideMintProgressOverlay(): void {
  const overlay = document.getElementById('mintProgressOverlay');
  if (overlay) {
    overlay.hidden = true;
  }
}
