// Shared confirmation dialog with the same styling used for model-change warnings.
export function showConfirmDialog(message, cancelText = 'Cancel', confirmText = 'Confirm') {
  return new Promise((resolve) => {
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; pointer-events: auto;';

    // Create dialog box
    const dialogBox = document.createElement('div');
    dialogBox.style.cssText = 'background-color: white; border-radius: 0.5rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); padding: 2rem; max-width: 28rem; width: 90%; pointer-events: auto;';
    dialogBox.innerHTML = `
      <p class="text-gray-900 text-base mb-8">${message}</p>
      <div class="flex justify-end gap-3">
        <button class="btn btn-secondary btn-md" id="confirm-cancel">${cancelText}</button>
        <button class="btn btn-primary btn-md" id="confirm-ok">${confirmText}</button>
      </div>
    `;

    modal.appendChild(dialogBox);

    const onCancel = () => {
      modal.remove();
      resolve(false);
    };
    const onConfirm = () => {
      modal.remove();
      resolve(true);
    };

    // Close on Escape key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
        document.removeEventListener('keydown', handleKeydown);
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
