// Addons stage module
// Addons are multi-select; dispatch 'addon-toggled' events with { id, price, checked }
export function init() {
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-category="addon"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    const id = card.getAttribute('data-id');
    const price = Number(card.getAttribute('data-price')) || 0;
    // toggle checked state
    const was = card.getAttribute('aria-checked') === 'true';
    const now = !was;
    card.setAttribute('aria-checked', now ? 'true' : 'false');
    card.classList.toggle('selected', now);
    document.dispatchEvent(new CustomEvent('addon-toggled', { detail: { id, price, checked: now } }));
  });
}

export function restoreFromState(state) {
  try {
    const arr = state && state.selections && state.selections.options && Array.isArray(state.selections.options.addon) ? state.selections.options.addon : [];
    document.querySelectorAll('.option-card[data-category="addon"]').forEach(c => {
      const id = c.getAttribute('data-id');
      const checked = arr.includes(id);
      c.setAttribute('aria-checked', checked ? 'true' : 'false');
      c.setAttribute('aria-pressed', checked ? 'true' : 'false');
      c.classList.toggle('selected', checked);
    });
  } catch (e) { /* ignore */ }
}

export default { init, restoreFromState };
