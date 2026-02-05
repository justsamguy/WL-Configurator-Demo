import { createLogger } from '../logger.js';

const log = createLogger('Designs');

// Designs stage module
// Single responsibility: load designs filtered by selected model, wire design option-card interactions,
// and restore visual selections from state.
// Exports:
// - init(): attaches event handlers for design selection, dispatches standardized events
// - restoreFromState(state): restores visual ARIA state for the selected design

export function init() {
  // Delegate clicks on design option-cards. Dispatch 'option-selected' event with category 'design'
  // for main.js to handle global state mutation and price updates.
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('#designs-stage-section .option-card[data-category="design"], #designs-stage-section .option-card[data-id^="des-"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;

    // Set visual pressed state
    document.querySelectorAll('#designs-stage-section .option-card[data-category="design"], #designs-stage-section .option-card[data-id^="des-"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    card.setAttribute('aria-pressed', 'true');

    const id = card.getAttribute('data-design-id') || card.getAttribute('data-id');
    const presetId = card.getAttribute('data-preset-id') || null;

    // Dispatch the standardized selection event with category 'design' for main.js to handle
    document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, category: 'design', presetId } }));
  });
}

export function restoreFromState(state) {
  try {
    const designId = state && state.selections && state.selections.design;
    if (!designId) return;
    const el = document.querySelector(`#design-layout-options .option-card[data-id="${designId}"]`) ||
      document.querySelector(`#designs-stage-section .option-card[data-id="${designId}"]:not([data-preset-id])`);
    if (el) {
      document.querySelectorAll('#designs-stage-section .option-card[data-category="design"], #designs-stage-section .option-card[data-id^="des-"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', 'true');
    }
  } catch (e) {
    // fail silently
    log.warn('restoreFromState failed', e);
  }
}

export default { init, restoreFromState };
