// Central pricing helper
// computePrice reads the canonical state and DOM (as a fallback) to produce a stable
// pricing breakdown { base, extras, total, breakdown }

export function computePrice(state) {
  // Read base model price from state.pricing.base if available, otherwise try DOM
  let base = (state.pricing && typeof state.pricing.base === 'number') ? state.pricing.base : 0;
  const breakdown = [];
  let extras = 0;

  try {
    // Base model
    if (state.selections && state.selections.model) {
      const modelId = state.selections.model;
      const el = document.querySelector(`.option-card[data-id="${modelId}"]`);
      const p = el ? parseInt(el.getAttribute('data-price') || '0', 10) : 0;
      if (typeof p === 'number' && p > 0) base = p;
      breakdown.push({ id: modelId, type: 'model', price: base });
    } else if (base > 0) {
      breakdown.push({ id: 'base', type: 'model', price: base });
    }

    // Single-choice categories to include in breakdown
    const singleCategories = [
      { key: 'material', label: 'material' },
      { key: 'finish-coating', label: 'finish-coating' },
      { key: 'finish-sheen', label: 'finish-sheen' },
      { key: 'dimensions', label: 'dimensions' },
      { key: 'legs', label: 'legs' }
    ];

    singleCategories.forEach(cat => {
      const id = state.selections && state.selections.options ? state.selections.options[cat.key] : null;
      if (id) {
        const el = document.querySelector(`.option-card[data-id="${id}"]`);
        const p = el ? parseInt(el.getAttribute('data-price') || '0', 10) : 0;
        if (p) extras += p;
        breakdown.push({ id, type: cat.label, price: p });
      }
    });

    // Addons (multi-select)
    const addons = (state.selections && state.selections.options && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : [];
    if (addons.length) {
      addons.forEach(id => {
        const el = document.querySelector(`.option-card[data-id="${id}"]`);
        const p = el ? parseInt(el.getAttribute('data-price') || '0', 10) : 0;
        extras += p;
        breakdown.push({ id, type: 'addon', price: p });
      });
    }
  } catch (e) {
    console.warn('computePrice: failed to compute from DOM/state', e);
  }

  const total = base + extras;
  return { base, extras, total, breakdown };
}

export default { computePrice };
