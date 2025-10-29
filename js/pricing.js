// Central pricing helper
// computePrice reads the canonical state and DOM (as a fallback) to produce a stable
// pricing breakdown { base, extras, total, breakdown }

export async function computePrice(state) {
  // Read base model price from state.pricing.base if available, otherwise try DOM
  let base = (state.pricing && typeof state.pricing.base === 'number') ? state.pricing.base : 0;
  const breakdown = [];
  let extras = 0;

  try {
    // Load cached data helper
    if (!window.__wl_stage_data_cache) window.__wl_stage_data_cache = {};
    async function _loadDataOnce(path) {
      if (window.__wl_stage_data_cache[path]) return window.__wl_stage_data_cache[path];
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
        const j = await res.json();
        window.__wl_stage_data_cache[path] = j;
        return j;
      } catch (e) {
        window.__wl_stage_data_cache[path] = null;
        return null;
      }
    }

    // Base model (try data file, then DOM)
    if (state.selections && state.selections.model) {
      const modelId = state.selections.model;
      const modelsData = await _loadDataOnce('data/models.json');
      let p = 0;
      if (modelsData && Array.isArray(modelsData)) {
        const m = modelsData.find(x => x.id === modelId);
        if (m) p = Number(m.price || 0);
      }
      if (!p) {
        const el = document.querySelector(`.option-card[data-id="${modelId}"]`);
        p = el ? parseInt(el.getAttribute('data-price') || '0', 10) : 0;
      }
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

    // For each category try to resolve price from corresponding data files
    for (const cat of singleCategories) {
      const id = state.selections && state.selections.options ? state.selections.options[cat.key] : null;
      if (!id) continue;
      let p = 0;
      try {
        // map key to data path
        let path = null;
        if (cat.key === 'material') path = 'data/materials.json';
        else if (cat.key === 'finish-coating' || cat.key === 'finish-sheen') path = 'data/finish.json';
        else if (cat.key === 'dimensions') path = 'data/dimensions.json';
        else if (cat.key === 'legs') path = 'data/legs.json';

        if (path) {
          const d = await _loadDataOnce(path);
          if (d) {
            if (Array.isArray(d)) {
              const entry = d.find(x => x.id === id);
              if (entry) p = Number(entry.price || 0);
            } else if (typeof d === 'object') {
              // finish.json has coatings and sheens
              const entry = (d.coatings || []).concat(d.sheens || []).find(x => x.id === id);
              if (entry) p = Number(entry.price || 0);
            }
          }
        }
      } catch (e) {
        // ignore and fallback to DOM
      }
      if (!p) {
        const el = document.querySelector(`.option-card[data-id="${id}"]`);
        p = el ? parseInt(el.getAttribute('data-price') || '0', 10) : 0;
      }
      if (p) extras += p;
      breakdown.push({ id, type: cat.label, price: p });
    }

    // Addons (multi-select)
    const addons = (state.selections && state.selections.options && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : [];
    if (addons.length) {
      const addonsData = await _loadDataOnce('data/addons.json');
      addons.forEach(id => {
        let p = 0;
        if (addonsData && Array.isArray(addonsData)) {
          const a = addonsData.find(x => x.id === id);
          if (a) p = Number(a.price || 0);
        }
        if (!p) {
          const el = document.querySelector(`.option-card[data-id="${id}"]`);
          p = el ? parseInt(el.getAttribute('data-price') || '0', 10) : 0;
        }
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
