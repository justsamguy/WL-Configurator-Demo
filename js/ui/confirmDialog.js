// Shared confirmation dialog with the same styling used for model-change warnings.
export function showConfirmDialog(message, cancelText = 'Cancel', confirmText = 'Confirm') {
  return new Promise((resolve) => {
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.className = 'confirm-dialog-backdrop';

    // Create dialog box
    const dialogBox = document.createElement('div');
    dialogBox.className = 'confirm-dialog-panel';
    dialogBox.setAttribute('role', 'dialog');
    dialogBox.setAttribute('aria-modal', 'true');
    dialogBox.innerHTML = `
      <p class="confirm-dialog-message">${message}</p>
      <div class="confirm-dialog-actions">
        <button class="btn btn-secondary btn-md" id="confirm-cancel">${cancelText}</button>
        <button class="btn btn-primary btn-md" id="confirm-ok">${confirmText}</button>
      </div>
    `;

    modal.appendChild(dialogBox);

    const cleanup = () => {
      document.removeEventListener('keydown', handleKeydown);
      modal.remove();
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    // Close on Escape key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.body.appendChild(modal);

    dialogBox.querySelector('#confirm-cancel').addEventListener('click', onCancel);
    dialogBox.querySelector('#confirm-ok').addEventListener('click', onConfirm);
    document.addEventListener('keydown', handleKeydown);

    // Focus the confirm button for better UX
    dialogBox.querySelector('#confirm-ok').focus();
  });
}
