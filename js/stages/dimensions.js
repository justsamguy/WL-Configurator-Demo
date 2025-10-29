// Dimensions stage module
// Handles single-choice dimension options
export function init() {
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-category="dimensions"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    // Visual toggle
    document.querySelectorAll('.option-card[data-category="dimensions"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    card.setAttribute('aria-pressed', 'true');
    const id = card.getAttribute('data-id');
    const price = Number(card.getAttribute('data-price')) || 0;
    document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: 'dimensions' } }));
  });
}

export function restoreFromState(state) {
  try {
    const id = state && state.selections && state.selections.options && state.selections.options.dimensions;
    if (!id) return;
    const el = document.querySelector(`.option-card[data-id="${id}"]`);
    if (el) {
      document.querySelectorAll('.option-card[data-category="dimensions"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', 'true');
    }
  } catch (e) { /* ignore */ }
}

export default { init, restoreFromState };
