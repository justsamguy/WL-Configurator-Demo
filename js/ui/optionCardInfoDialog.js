let activeDialogCleanup = null;

function buildDescription(content, description) {
  const paragraphs = String(description || '')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!paragraphs.length) return;

  paragraphs.forEach((paragraph) => {
    const p = document.createElement('p');
    p.className = 'option-card-info-dialog-paragraph';
    p.textContent = paragraph;
    content.appendChild(p);
  });
}

export function showOptionCardInfoDialog({ title = '', description = '', triggerEl = null } = {}) {
  const dialogTitle = String(title || '').trim();
  const dialogDescription = String(description || '').trim();
  if (!dialogTitle || !dialogDescription) return;

  if (typeof activeDialogCleanup === 'function') {
    activeDialogCleanup({ restoreFocus: false });
  }

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modal = document.createElement('div');
  modal.className = 'option-card-info-dialog-backdrop';

  const panel = document.createElement('div');
  panel.className = 'option-card-info-dialog-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const titleId = `option-card-info-title-${Date.now()}`;
  const descriptionId = `option-card-info-description-${Date.now()}`;
  panel.setAttribute('aria-labelledby', titleId);
  panel.setAttribute('aria-describedby', descriptionId);

  const header = document.createElement('div');
  header.className = 'option-card-info-dialog-header';

  const heading = document.createElement('h2');
  heading.id = titleId;
  heading.className = 'option-card-info-dialog-title';
  heading.textContent = dialogTitle;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'option-card-info-dialog-close';
  closeButton.setAttribute('aria-label', `Close details for ${dialogTitle}`);
  closeButton.textContent = 'X';

  header.appendChild(heading);
  header.appendChild(closeButton);

  const body = document.createElement('div');
  body.id = descriptionId;
  body.className = 'option-card-info-dialog-body';
  buildDescription(body, dialogDescription);

  panel.appendChild(header);
  panel.appendChild(body);
  modal.appendChild(panel);

  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  const cleanup = ({ restoreFocus = true } = {}) => {
    document.removeEventListener('keydown', handleKeydown);
    modal.removeEventListener('click', handleBackdropClick);
    closeButton.removeEventListener('click', handleClose);
    modal.remove();
    activeDialogCleanup = null;
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      const focusTarget = triggerEl instanceof HTMLElement ? triggerEl : previousFocus;
      if (focusTarget) focusTarget.focus();
    }
  };

  const handleClose = () => cleanup();
  const handleBackdropClick = (event) => {
    if (event.target === modal) cleanup();
  };
  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cleanup();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(panel.querySelectorAll(focusableSelector))
      .filter((el) => !el.hasAttribute('disabled'));
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.body.appendChild(modal);
  if (triggerEl) triggerEl.setAttribute('aria-expanded', 'true');
  modal.addEventListener('click', handleBackdropClick);
  closeButton.addEventListener('click', handleClose);
  document.addEventListener('keydown', handleKeydown);
  closeButton.focus();
  activeDialogCleanup = cleanup;
}

export default {
  showOptionCardInfoDialog
};
