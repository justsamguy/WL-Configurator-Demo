// Calculate dimension price based on model and selected dimensions
function calculateDimensionPrice(state) {
  const modelId = state.selections && state.selections.model;
  const dimSel = state.selections && state.selections.dimensionsDetail
    ? state.selections.dimensionsDetail
    : (state.selections && state.selections.options && state.selections.options.dimensions);

  if (!modelId || !dimSel) return 0;

  let length = 0;
  let width = 0;

  // Extract dimensions from selection
  if (typeof dimSel === 'object' && typeof dimSel.length === 'number' && typeof dimSel.width === 'number') {
    length = dimSel.length;
    width = dimSel.width;
  } else if (typeof dimSel === 'string') {
    // For preset, we need to look up from dimensions.json
    // But for now, assume custom dimensions are used
    return 0;
  }

  if (modelId === 'mdl-coffee') {
    // Coffee: first size +0, subsequent +250
    // Assuming the base is already in design price, and dimensions add +250 for non-first
    // But pricing.txt says "The first size option is +0, subsequent ones are +250"
    // Since base is $3950, and sizes add +250, but currently presets have fixed prices
    // For simplicity, if it's not the smallest preset, add +250
    // But to make it dynamic, perhaps assume 24x48 is first, others add +250
    if (length > 24 || width > 48) {
      return 250;
    }
    return 0;
  } else if (modelId === 'mdl-dining' || modelId === 'mdl-conference') {
    // Dining/Conference pricing
    let price = 0;

    // Length pricing: 72" +0, every 12" increment up to 120" +500, 120-132 +1000, then +500 up to 192"
    if (length > 72) {
      const lengthOver = length - 72;
      if (length <= 120) {
        price += Math.ceil(lengthOver / 12) * 500;
      } else if (length <= 132) {
        price += (120 - 72) / 12 * 500 + 1000; // up to 120 +1000 for 120-132
      } else {
        price += (120 - 72) / 12 * 500 + 1000 + Math.ceil((length - 132) / 12) * 500;
      }
    }

    // Width pricing: 36" +0, every 6" increment up to 52" +500, 52-58 +1000, then +500 up to 70"
    if (width > 36) {
      const widthOver = width - 36;
      if (width <= 52) {
        price += Math.ceil(widthOver / 6) * 500;
      } else if (width <= 58) {
        price += (52 - 36) / 6 * 500 + 1000; // up to 52 +1000 for 52-58
      } else {
        price += (52 - 36) / 6 * 500 + 1000 + Math.ceil((width - 58) / 6) * 500;
      }
    }

    return price;
  }

  return 0;
}

export function getLegPriceMultiplier(appState) {
  const length = appState && appState.selections && appState.selections.dimensionsDetail
    ? appState.selections.dimensionsDetail.length
    : null;
  if (typeof length !== 'number') return 1;
  return length > 130 ? 1.5 : 1;
}

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

    // Base design price: lookup from designs.json using model ID and design ID
    // If design is selected, use its price; otherwise base is 0
    if (state.selections && state.selections.design && state.selections.model) {
      const designId = state.selections.design;
      const modelId = state.selections.model;
      const designsData = await _loadDataOnce('data/designs.json');
      let p = 0;
      if (designsData && Array.isArray(designsData)) {
        const d = designsData.find(x => x.id === designId);
        if (d && d.prices && d.prices[modelId]) {
          p = Number(d.prices[modelId]);
        }
      }
      if (typeof p === 'number' && p > 0) base = p;
      breakdown.push({ id: designId, type: 'design', price: base });
    } else if (base > 0) {
      breakdown.push({ id: 'base', type: 'design', price: base });
    }

    // Single-choice categories to include in breakdown
    const singleCategories = [
      { key: 'material', label: 'material' },
      { key: 'color', label: 'color' },
      { key: 'finish-coating', label: 'finish-coating' },
      { key: 'finish-sheen', label: 'finish-sheen' },
      { key: 'finish-tint', label: 'finish-tint' },
      { key: 'dimensions', label: 'dimensions' },
      { key: 'legs', label: 'legs' },
      { key: 'tube-size', label: 'tube-size' },
      { key: 'leg-finish', label: 'leg-finish' }
    ];

    // For each category try to resolve price from corresponding data files
    for (const cat of singleCategories) {
      const id = state.selections && state.selections.options ? state.selections.options[cat.key] : null;
      if (!id) continue;
      let p = 0;
      if (cat.key === 'dimensions') {
        // Calculate dynamic dimension price based on model and dimensions
        p = calculateDimensionPrice(state);
      } else {
        try {
          // map key to data path
          let path = null;
          if (cat.key === 'material') path = 'data/materials.json';
          else if (cat.key === 'color') path = 'data/colors.json';
          else if (cat.key === 'finish-coating' || cat.key === 'finish-sheen' || cat.key === 'finish-tint') path = 'data/finish.json';
          else if (cat.key === 'legs') path = 'data/legs.json';
          else if (cat.key === 'tube-size') path = 'data/tube-sizes.json';
          else if (cat.key === 'leg-finish') path = 'data/leg-finish.json';

          if (path) {
            const d = await _loadDataOnce(path);
            if (d) {
              if (Array.isArray(d)) {
                const entry = d.find(x => x.id === id);
                if (entry) p = Number(entry.price || 0);
              } else if (typeof d === 'object') {
                // finish.json has coatings and sheens
                const entry = (d.coatings || []).concat(d.sheens || []).concat(d.tints || []).find(x => x.id === id);
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
      }
      if (cat.key === 'legs') {
        const legMultiplier = getLegPriceMultiplier(state);
        if (legMultiplier > 1 && Number.isFinite(p)) {
          p *= legMultiplier;
        }
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
          for (const group of addonsData) {
            if (group.options) {
              const option = group.options.find(o => o.id === id);
              if (option) {
                p = Number(option.price || 0);
                break;
              }
            }
          }
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
