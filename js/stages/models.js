import { createLogger } from '../logger.js';
import { isSelectionClickHandled, markSelectionClickHandled } from '../ui/selectionEventGuard.js';

const log = createLogger('Models');

// Models stage module
// Single responsibility: wire model option-card interactions and restore visual selections from state.
// Exports:
// - init(): attaches event handlers for model selection, dispatches standardized events
// - restoreFromState(state): restores visual ARIA state for the selected model

export function init() {
  // Delegate clicks on model option-cards. Dispatch 'option-selected' event with category 'model'
  // for main.js to handle global state mutation and price updates.
  document.addEventListener('click', (ev) => {
    if (isSelectionClickHandled(ev)) return;
    const card = ev.target.closest && ev.target.closest('.option-card[data-id^="mdl-"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    markSelectionClickHandled(ev);
    // Set visual pressed state in one pass so deselection and selection update together.
    document.querySelectorAll('.option-card[data-id^="mdl-"]').forEach((c) => {
      c.setAttribute('aria-pressed', c === card ? 'true' : 'false');
    });

    const id = card.getAttribute('data-id');

    // Dispatch the standardized selection event with category 'model' for main.js to handle
    document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, category: 'model' } }));
  });
}

export function restoreFromState(state) {
  try {
    const modelId = state && state.selections && state.selections.model;
    if (!modelId) return;
    const el = document.querySelector(`.option-card[data-id="${modelId}"]`);
    if (el) {
      document.querySelectorAll('.option-card[data-id^="mdl-"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', 'true');
    }
  } catch (e) {
    // fail silently
    log.warn('restoreFromState failed', e);
  }
}

export default { init, restoreFromState };
