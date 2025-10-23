// Legs stage module
// Handles single-choice legs options
export function init() {
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-category="legs"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    document.querySelectorAll('.option-card[data-category="legs"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    card.setAttribute('aria-pressed', 'true');
    const id = card.getAttribute('data-id');
    const price = Number(card.getAttribute('data-price')) || 0;
    document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: 'legs' } }));
  });
}

export function restoreFromState(state) {
  try {
    const id = state && state.selections && state.selections.options && state.selections.options.legs;
    if (!id) return;
    const el = document.querySelector(`.option-card[data-id="${id}"]`);
    if (el) {
      document.querySelectorAll('.option-card[data-category="legs"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', 'true');
    }
  } catch (e) { /* ignore */ }
}

export default { init, restoreFromState };
