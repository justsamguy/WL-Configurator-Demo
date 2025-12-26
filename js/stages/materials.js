// Materials stage logic: validation and utilities
let lastKnownModel = null; // Track the model to detect changes

export function isMaterialsComplete(appState) {
  try {
    const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
    const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
    return !!(hasMaterial && hasColor);
  } catch (e) {
    return false;
  }
}

// Initialize materials stage interactions. This wires option-selected events for
// single-choice material/color option-cards under the materials panel.
export function init() {
  // Delegate click handling for material and color option-cards
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-category="material"], .option-card[data-category="color"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    // Visual pressed state for category
    const category = card.getAttribute('data-category');
    if (category) {
      document.querySelectorAll(`.option-card[data-category="${category}"]`).forEach(c => c.setAttribute('aria-pressed', 'false'));
      card.setAttribute('aria-pressed', 'true');
      const id = card.getAttribute('data-id');
      const price = Number(card.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category } }));
    }
  });
}

export function restoreFromState(appState) {
  try {
    // Check if model has changed and clear selections if needed
    const currentModel = appState && appState.selections && appState.selections.model;
    if (currentModel !== lastKnownModel) {
      console.log('[Materials] Model changed from', lastKnownModel, 'to', currentModel, '- clearing visual selections');
      // Clear visual state for material and color cards when model changes
      document.querySelectorAll('.option-card[data-category="material"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      document.querySelectorAll('.option-card[data-category="color"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      lastKnownModel = currentModel;
    }
    
    const opts = appState && appState.selections && appState.selections.options ? appState.selections.options : {};
    ['material', 'color'].forEach(cat => {
      const id = opts[cat];
      if (!id) return;
      const el = document.querySelector(`.option-card[data-id="${id}"]`);
      if (el) {
        document.querySelectorAll(`.option-card[data-category="${cat}"]`).forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    });
  } catch (e) { /* ignore */ }
}

export default { isMaterialsComplete, init, restoreFromState };
