import { createLogger } from './logger.js';

const log = createLogger('Pricing');

function shouldLogPricing() {
  return typeof window !== 'undefined' && window.__wl_price_debug;
}

function isQuotedLabel(value) {
  return typeof value === 'string' && value.trim() && Number.isNaN(Number(value));
}

function normalizeNumericPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getHeightPriceForSelection(height) {
  if (height === 'bar') return 120;
  if (height === 'custom') return 250;
  return 0;
}

function formatDimensionLabel(detail, preset) {
  if (detail && typeof detail === 'object') {
    const sizeParts = [];
    if (typeof detail.length === 'number') sizeParts.push(`${detail.length} in`);
    if (typeof detail.width === 'number') sizeParts.push(`${detail.width} in`);
    let sizeText = '';
    if (sizeParts.length === 2) sizeText = `${sizeParts[0]} x ${sizeParts[1]}`;
    else if (sizeParts.length === 1) sizeText = sizeParts[0];
    let heightText = '';
    if (detail.height === 'standard') heightText = 'standard height';
    else if (detail.height === 'bar') heightText = 'bar height';
    else if (detail.height === 'custom') {
      if (typeof detail.heightCustom === 'number') heightText = `custom height ${detail.heightCustom} in`;
      else heightText = 'custom height';
    }
    if (heightText) sizeText = sizeText ? `${sizeText}, ${heightText}` : heightText;
    if (sizeText) return sizeText;
  }
  if (preset && preset.title) return preset.title;
  return '';
}

function resolveDimensionPricing(state, dimensionsData) {
  const modelId = state.selections && state.selections.model;
  const dimSel = state.selections && state.selections.dimensionsDetail
    ? state.selections.dimensionsDetail
    : (state.selections && state.selections.options && state.selections.options.dimensions);

  if (!modelId || !dimSel) return { price: 0, label: '' };

  const detail = typeof dimSel === 'object' ? dimSel : null;
  const presetId = detail && detail.presetId && detail.presetId !== 'custom'
    ? detail.presetId
    : (typeof dimSel === 'string' && dimSel !== 'dimensions-custom' ? dimSel : null);
  const presets = dimensionsData && Array.isArray(dimensionsData.presets) ? dimensionsData.presets : [];
  let matchedPreset = null;

  if (presetId) {
    matchedPreset = presets.find(p => p.id === presetId) || null;
  }
  if (!matchedPreset && detail && typeof detail.length === 'number' && typeof detail.width === 'number') {
    matchedPreset = presets.find(p => p.length === detail.length && p.width === detail.width) || null;
  }

  const heightSelection = (detail && detail.height) || (matchedPreset && matchedPreset.height) || 'standard';
  const heightPrice = getHeightPriceForSelection(heightSelection);
  let basePrice = 0;

  if (matchedPreset) {
    basePrice = normalizeNumericPrice(matchedPreset.price);
  } else if (detail && typeof detail.length === 'number' && typeof detail.width === 'number') {
    const length = detail.length;
    const width = detail.width;

    if (modelId === 'mdl-coffee') {
      if (length > 24 || width > 48) basePrice = 250;
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

      basePrice = price;
    }
  }

  const total = basePrice + heightPrice;
  if (shouldLogPricing()) {
    log.debug('dimensions', { modelId, presetId, basePrice, heightPrice, total, detail });
  }

  return { price: total, label: formatDimensionLabel(detail, matchedPreset) };
}

// Calculate dimension price based on model and selected dimensions
function calculateDimensionPrice(state, dimensionsData) {
  return resolveDimensionPricing(state, dimensionsData).price;
}

const WATERFALL_EDGE_ADDONS = ['addon-waterfall-single', 'addon-waterfall-second'];

export function getWaterfallEdgeCount(appState) {
  const addons = appState && appState.selections && appState.selections.options
    ? appState.selections.options.addon
    : null;
  if (!Array.isArray(addons)) return 0;
  return WATERFALL_EDGE_ADDONS.filter(id => addons.includes(id)).length;
}

export function getLegPriceMultiplier(appState) {
  const length = appState && appState.selections && appState.selections.dimensionsDetail
    ? appState.selections.dimensionsDetail.length
    : null;
  const lengthMultiplier = (typeof length === 'number' && length > 130) ? 1.5 : 1;
  const waterfallCount = getWaterfallEdgeCount(appState);
  if (waterfallCount >= 2) return 0;
  if (waterfallCount === 1) return lengthMultiplier * 0.5;
  return lengthMultiplier;
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

    const dimensionsData = await _loadDataOnce('data/dimensions.json');

    // Base design price: lookup from designs.json using model ID and design ID
    // If design is selected, use its price; otherwise base is 0
    if (state.selections && state.selections.design && state.selections.model) {
      const designId = state.selections.design;
      const modelId = state.selections.model;
      const designsData = await _loadDataOnce('data/designs.json');
      let p = 0;
      let designLabel = designId;
      if (designsData && Array.isArray(designsData)) {
        const d = designsData.find(x => x.id === designId);
        if (d && d.prices && d.prices[modelId]) {
          p = normalizeNumericPrice(d.prices[modelId]);
        }
        if (d && d.title) designLabel = d.title;
      }
      if (typeof p === 'number' && p > 0) base = p;
      breakdown.push({ id: designId, type: 'design', price: base, label: designLabel, isBase: true });
    } else if (base > 0) {
      breakdown.push({ id: 'base', type: 'design', price: base, label: 'Base design', isBase: true });
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
      let label = id;
      let priceLabel = '';
      if (cat.key === 'dimensions') {
        // Calculate dynamic dimension price based on model and dimensions
        const dimensionInfo = resolveDimensionPricing(state, dimensionsData);
        p = dimensionInfo.price;
        label = dimensionInfo.label || label;
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
                if (entry) {
                  label = entry.title || label;
                  if (isQuotedLabel(entry.price)) priceLabel = entry.price.trim();
                  p = normalizeNumericPrice(entry.price);
                }
              } else if (typeof d === 'object') {
                // finish.json has coatings and sheens
                const entry = (d.coatings || []).concat(d.sheens || []).concat(d.tints || []).find(x => x.id === id);
                if (entry) {
                  label = entry.title || label;
                  if (isQuotedLabel(entry.price)) priceLabel = entry.price.trim();
                  p = normalizeNumericPrice(entry.price);
                }
              }
            }
          }
        } catch (e) {
          // ignore and fallback to DOM
        }
        if (!p && !priceLabel) {
          const el = document.querySelector(`.option-card[data-id="${id}"]`);
          const priceAttr = el ? el.getAttribute('data-price') : null;
          if (isQuotedLabel(priceAttr)) priceLabel = priceAttr.trim();
          p = normalizeNumericPrice(priceAttr);
        }
      }
      if (cat.key === 'legs') {
        const legMultiplier = getLegPriceMultiplier(state);
        if (legMultiplier === 0) {
          p = 0;
          priceLabel = '';
        } else if (legMultiplier !== 1 && Number.isFinite(p)) {
          p *= legMultiplier;
        }
      }
      if (Number.isFinite(p) && p !== 0) extras += p;
      breakdown.push({ id, type: cat.label, price: p, label, priceLabel });
    }

    // Addons (multi-select)
    const addons = (state.selections && state.selections.options && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : [];
    if (addons.length) {
      const addonsData = await _loadDataOnce('data/addons.json');
      addons.forEach(id => {
        let p = 0;
        let label = id;
        let priceLabel = '';
        let foundAddon = false;
        if (addonsData && Array.isArray(addonsData)) {
          for (const group of addonsData) {
            if (group.options) {
              const option = group.options.find(o => o.id === id);
              if (option) {
                if (option.title && group.title) label = `${group.title}: ${option.title}`;
                else if (option.title) label = option.title;
                if (isQuotedLabel(option.price)) priceLabel = option.price.trim();
                p = normalizeNumericPrice(option.price);
                foundAddon = true;
                break;
              }
            }
            if (Array.isArray(group.subsections)) {
              for (const subsection of group.subsections) {
                if (!Array.isArray(subsection.options)) continue;
                const option = subsection.options.find(o => o.id === id);
                if (option) {
                  if (option.title && subsection.title && group.title) {
                    label = `${group.title}: ${subsection.title} - ${option.title}`;
                  } else if (option.title && group.title) {
                    label = `${group.title}: ${option.title}`;
                  } else if (option.title) {
                    label = option.title;
                  }
                  if (isQuotedLabel(option.price)) priceLabel = option.price.trim();
                  p = normalizeNumericPrice(option.price);
                  foundAddon = true;
                  break;
                }
              }
              if (foundAddon) break;
            }
            if (foundAddon) break;
          }
        }
        if (!p && !priceLabel) {
          const el = document.querySelector(`.option-card[data-id="${id}"]`);
          const priceAttr = el ? el.getAttribute('data-price') : null;
          if (isQuotedLabel(priceAttr)) priceLabel = priceAttr.trim();
          p = normalizeNumericPrice(priceAttr);
        }
        if (Number.isFinite(p) && p !== 0) extras += p;
        breakdown.push({ id, type: 'addon', price: p, label, priceLabel });
      });
    }
  } catch (e) {
    log.warn('computePrice: failed to compute from DOM/state', e);
  }

  const total = base + extras;
  if (shouldLogPricing()) {
    log.debug('total', { base, extras, total, breakdown });
  }
  return { base, extras, total, breakdown };
}

export default { computePrice };
