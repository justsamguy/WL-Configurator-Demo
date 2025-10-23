// Model stage module
// Single responsibility: wire model option-card interactions and restore visual selections from state.
// Exports:
// - init(): attaches event handlers for model selection, dispatches standardized events
// - restoreFromState(state): restores visual ARIA state for the selected model

export function init() {
  // Delegate clicks on model option-cards. Dispatch two events:
  // - 'option-selected' (detail: { id, price }) to follow existing app convention (main.js will mutate state)
  // - 'stage-model-selected' (detail: { id, price }) for stageManager to update its internal manager state
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-id^="mdl-"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    // Set visual pressed state
    document.querySelectorAll('.option-card[data-id^="mdl-"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    card.setAttribute('aria-pressed', 'true');

    const id = card.getAttribute('data-id');
    const price = Number(card.getAttribute('data-price')) || 0;

    // Dispatch the standardized selection event for main.js to handle global state mutation
    document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price } }));
    // Notify stage manager (internal navigation state) about the model selection
    document.dispatchEvent(new CustomEvent('stage-model-selected', { detail: { id, price } }));
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
    console.warn('model.restoreFromState failed', e);
  }
}

export default { init, restoreFromState };
