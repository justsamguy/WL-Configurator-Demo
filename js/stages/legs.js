// Legs stage module
// Handles single-choice legs options, tube size, and leg finish (color)
export function init() {
  document.addEventListener('click', (ev) => {
    const legCard = ev.target.closest && ev.target.closest('.option-card[data-category="legs"]');
    const tubeSizeCard = ev.target.closest && ev.target.closest('.option-card[data-category="tube-size"]');
    const legFinishCard = ev.target.closest && ev.target.closest('.option-card[data-category="leg-finish"]');

    if (legCard && !legCard.hasAttribute('disabled')) {
      document.querySelectorAll('.option-card[data-category="legs"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      legCard.setAttribute('aria-pressed', 'true');
      const id = legCard.getAttribute('data-id');
      const price = Number(legCard.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: 'legs' } }));
    } else if (tubeSizeCard && !tubeSizeCard.hasAttribute('disabled')) {
      document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      tubeSizeCard.setAttribute('aria-pressed', 'true');
      const id = tubeSizeCard.getAttribute('data-id');
      const price = Number(tubeSizeCard.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: 'tube-size' } }));
    } else if (legFinishCard && !legFinishCard.hasAttribute('disabled')) {
      document.querySelectorAll('.option-card[data-category="leg-finish"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      legFinishCard.setAttribute('aria-pressed', 'true');
      const id = legFinishCard.getAttribute('data-id');
      const price = Number(legFinishCard.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: 'leg-finish' } }));
    }
  });
}

export function restoreFromState(state) {
  try {
    const legId = state && state.selections && state.selections.options && state.selections.options.legs;
    if (legId) {
      const el = document.querySelector(`.option-card[data-id="${legId}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="legs"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    }

    const tubeSizeId = state && state.selections && state.selections.options && state.selections.options['tube-size'];
    if (tubeSizeId) {
      const el = document.querySelector(`.option-card[data-id="${tubeSizeId}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    }

    const legFinishId = state && state.selections && state.selections.options && state.selections.options['leg-finish'];
    if (legFinishId) {
      const el = document.querySelector(`.option-card[data-id="${legFinishId}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="leg-finish"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    }
  } catch (e) { /* ignore */ }
}

export default { init, restoreFromState };
