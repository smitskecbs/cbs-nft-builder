type PopupState = 'loading' | 'success' | 'error';

export function ensureActionPopup(): HTMLElement {
  let overlay = document.getElementById('actionPopup');

  if (overlay) {
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = 'actionPopup';
  overlay.className = 'action-popup-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="action-popup-card" role="dialog" aria-modal="true" aria-labelledby="actionPopupTitle">
      <p id="actionPopupTitle" class="action-popup-title"></p>
      <p id="actionPopupBody" class="action-popup-body"></p>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

export function showActionPopup(
  title: string,
  body: string,
  state: PopupState = 'loading'
): void {
  const overlay = ensureActionPopup();
  const titleEl = overlay.querySelector('#actionPopupTitle');
  const bodyEl = overlay.querySelector('#actionPopupBody');
  const card = overlay.querySelector('.action-popup-card');

  if (titleEl) {
    titleEl.textContent = title;
  }

  if (bodyEl) {
    bodyEl.textContent = body;
  }

  card?.classList.remove(
    'action-popup-card--success',
    'action-popup-card--error'
  );

  if (state === 'success') {
    card?.classList.add('action-popup-card--success');
  }

  if (state === 'error') {
    card?.classList.add('action-popup-card--error');
  }

  overlay.hidden = false;
}

export function hideActionPopup(delayMs = 0): void {
  const overlay = document.getElementById('actionPopup');

  if (!overlay) {
    return;
  }

  window.setTimeout(() => {
    overlay.hidden = true;
  }, delayMs);
}
