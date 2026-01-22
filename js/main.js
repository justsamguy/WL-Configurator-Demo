// WoodLab Configurator - main.js
// App bootstrap and global state management

import { loadComponent } from './app.js';
import { loadIcon } from './ui/icon.js';
import { initPlaceholderInteractions } from './ui/placeholders.js';
import { initViewer, initViewerControls, resizeViewer } from './viewer.js'; // Import viewer functions
import { state, setState } from './state.js';
import { computePrice, getLegPriceMultiplier, getWaterfallEdgeCount } from './pricing.js';
import * as dataLoader from './dataLoader.js';
import { buildExportJSON } from './export.js';
import { createLogger } from './logger.js';

const log = createLogger('Main');
const addonsLog = createLogger('Addons');

if (typeof window !== 'undefined') {
  window.exportConfig = async () => {
    try {
      const payload = await buildExportJSON(state, dataLoader);
      console.log('Configuration exported. Copy the JSON below and paste into your LLM:');
      console.log(JSON.stringify(payload, null, 2));
      return payload;
    } catch (e) {
      log.warn('Export config failed', e);
      console.warn('Configuration export failed. See log for details.');
      return null;
    }
  };
}

/**
 * Filter designs by model compatibility
 *
 * This function determines which designs are available for a given model by checking
 * the "prices" object in each design's data (from data/designs.json).
 *
 * Design Availability Rules:
 * - A design is available for a model if it has a price entry for that model's ID
 * - Example: { "prices": { "mdl-coffee": 10800, "mdl-dining": 13200 } }
 *   This design is available for Coffee and Dining tables, but NOT Conference tables
 *
 * To Configure Design Availability:
 * 1. Open data/designs.json
 * 2. For each design, add/remove model IDs in the "prices" object
 * 3. Model IDs: "mdl-coffee", "mdl-dining", "mdl-conference"
 *
 * Examples:
 * - Universal design (all models): { "prices": { "mdl-coffee": X, "mdl-dining": Y, "mdl-conference": Z } }
 * - Exclusive design (one model): { "prices": { "mdl-coffee": X } }
 * - Partial availability: { "prices": { "mdl-coffee": X, "mdl-dining": Y } }
 *
 * @param {Array} designs - Array of design objects from data/designs.json
 * @param {string} modelId - The selected model ID (e.g., "mdl-coffee")
 * @returns {Array} Filtered array of designs compatible with the selected model
 */
function filterDesignsByModel(designs, modelId) {
  if (!modelId) return designs; // Show all designs if no model selected

  return designs.filter(design => {
    // Check if this design has pricing for the selected model
    return design.prices && design.prices[modelId];
  });
}

/**
 * Filter materials by design compatibility
 *
 * This function determines which materials are available for a given design by checking
 * the "designs" array in each material's data (from data/materials.json).
 *
 * Material Availability Rules:
 * - A material is available for all designs if it has no "designs" property
 * - A material is available for specific designs if it has a "designs" array containing the design ID
 * - Example: { "designs": ["des-cookie"] } means only available for Cookie design
 *
 * To Configure Material Availability:
 * 1. Open data/materials.json
 * 2. For each material, add a "designs" array with design IDs to restrict availability
 * 3. Omit "designs" property for universal materials
 *
 * Examples:
 * - Universal material (all designs): no "designs" property
 * - Exclusive material (one design): { "designs": ["des-cookie"] }
 * - Partial availability: { "designs": ["des-river", "des-slab"] }
 *
 * @param {Array} materials - Array of material objects from data/materials.json
 * @param {string} designId - The selected design ID (e.g., "des-cookie")
 * @returns {Array} Filtered array of materials compatible with the selected design
 */
function filterMaterialsByDesign(materials, designId) {
  if (!designId) return materials; // Show all materials if no design selected

  return materials.filter(material => {
    // If material has no designs restriction, it's available for all designs
    if (!material.designs) return true;
    // If material has designs restriction, check if current design is included
    return Array.isArray(material.designs) && material.designs.includes(designId);
  });
}
import { populateSummaryPanel } from './stages/summary.js';
import { updateAllIndicators } from './stages/addons.js';
import { getVisibleLegs, getAvailableTubeSizes } from './stages/legCompatibility.js';
import { recomputeTubeSizeConstraints } from './stages/legs.js';

// Listen for state changes to update UI
document.addEventListener('statechange', (ev) => {
  log.debug('State changed', ev.detail.state.selections);
  // main orchestrator can react to state changes here if needed.
  // ev.detail.state contains the latest state object.
  // If the summary page is active, refresh its contents
  try {
    const summaryRoot = document.getElementById('summary-panel');
    if (summaryRoot) populateSummaryPanel();
  } catch (e) {
    // ignore
  }
});

// Price animation helper used by the UI when updating the price display
function animatePrice(from, to, duration = 400, onUpdate) {
  const start = performance.now();
  const delta = to - from;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut-like
    const value = Math.round(from + delta * eased);
    onUpdate(value);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updatePriceUI(total) {
  const el = document.getElementById('price-bar');
  if (!el) return;
  el.innerHTML = `$${total.toLocaleString()} <span class="text-xs font-normal">USD</span>`;
}

function isQuotedLabel(value) {
  return typeof value === 'string' && value.trim() && Number.isNaN(Number(value));
}

function formatLegPriceLabel(value) {
  if (isQuotedLabel(value)) return value.trim();
  const numeric = Number(value);
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  return `+$${safeNumber.toLocaleString()}`;
}

function applyLegPriceMultiplier(legs, multiplier) {
  if (!Array.isArray(legs)) return [];
  if (multiplier === 1) return legs;
  return legs.map(leg => {
    if (typeof leg.price === 'number' && Number.isFinite(leg.price)) {
      return { ...leg, price: leg.price * multiplier };
    }
    return leg;
  });
}

function updateLegPricingUI(appState = state, baseLegs = window._allLegsData) {
  const multiplier = getLegPriceMultiplier(appState);
  const banner = document.getElementById('legs-price-banner');
  if (banner) {
    const length = appState && appState.selections && appState.selections.dimensionsDetail
      ? appState.selections.dimensionsDetail.length
      : null;
    const lengthMultiplier = (typeof length === 'number' && length > 130) ? 1.5 : 1;
    const waterfallCount = getWaterfallEdgeCount(appState);
    const messages = [];
    if (lengthMultiplier > 1) {
      messages.push('Leg prices updated automatically because we require 3 legs on tables over 130" long.');
    }
    if (waterfallCount === 1) {
      messages.push('Single waterfall halves leg pricing.');
    } else if (waterfallCount >= 2) {
      messages.push('Two waterfalls replace legs; leg pricing set to $0.');
    }
    banner.classList.toggle('hidden', messages.length === 0);
    if (messages.length) banner.textContent = messages.join(' ');
  }
  if (!Array.isArray(baseLegs) || !baseLegs.length) return;

  const basePriceMap = new Map(baseLegs.map(leg => [leg.id, leg.price]));
  document.querySelectorAll('.option-card[data-category="legs"]').forEach(card => {
    const id = card.getAttribute('data-id');
    if (!id || !basePriceMap.has(id)) return;
    const basePrice = basePriceMap.get(id);
    let adjustedPrice = basePrice;

    if (typeof basePrice === 'number' && Number.isFinite(basePrice)) {
      adjustedPrice = basePrice * multiplier;
      card.setAttribute('data-price', String(adjustedPrice));
    } else if (typeof basePrice === 'string') {
      card.setAttribute('data-price', basePrice);
    }

    const priceEl = card.querySelector('.price-delta');
    if (priceEl) priceEl.textContent = formatLegPriceLabel(adjustedPrice);
  });
}

function updateWaterfallAddonAvailability(appState = state) {
  const root = document.getElementById('addons-options');
  if (!root) return;
  const addons = appState && appState.selections && appState.selections.options
    ? appState.selections.options.addon
    : [];
  const hasSingle = Array.isArray(addons) && addons.includes('addon-waterfall-single');
  const shouldDisableSecond = !hasSingle;
  const checkbox = root.querySelector('.addons-dropdown-option-checkbox[data-addon-id="addon-waterfall-second"]');
  const option = root.querySelector('.addons-dropdown-option[data-addon-id="addon-waterfall-second"]');
  if (!checkbox) return;

  const disabledBy = checkbox.getAttribute('data-disabled-by') || '';
  if (shouldDisableSecond) {
    checkbox.disabled = true;
    checkbox.checked = false;
    checkbox.setAttribute('data-tooltip', 'Select Single Waterfall to enable');
    checkbox.setAttribute('data-disabled-by', 'waterfall');
    if (option) {
      option.classList.add('disabled');
      option.classList.remove('selected');
      option.setAttribute('aria-disabled', 'true');
      option.setAttribute('data-tooltip', 'Select Single Waterfall to enable');
    }
  } else if (disabledBy === 'waterfall') {
    checkbox.disabled = false;
    checkbox.removeAttribute('data-tooltip');
    checkbox.removeAttribute('data-disabled-by');
    if (option) {
      option.classList.remove('disabled');
      option.removeAttribute('aria-disabled');
      if (option.getAttribute('data-disabled-by') === 'waterfall') {
        option.removeAttribute('data-disabled-by');
      }
      if (option.getAttribute('data-tooltip') === 'Select Single Waterfall to enable') {
        option.removeAttribute('data-tooltip');
      }
    }
  }

  updateAllIndicators();
}

const EDGE_PROFILE_ADDONS = ['addon-chamfered-edges', 'addon-rounded-corners', 'addon-angled-corners', 'addon-squoval'];
const EDGE_PROFILE_TOOLTIP = 'Not compatible with selected edge profile';

function getEdgeProfileBaseIncompatibility(addonId, currentDesign, currentAddons) {
  if (addonId === 'addon-rounded-corners') {
    const incompatible = currentDesign === 'des-cookie' || currentDesign === 'des-round';
    return { incompatible, tooltip: incompatible ? 'Not compatible with Cookie or Round designs' : '' };
  }
  if (addonId === 'addon-angled-corners') {
    const incompatible = currentDesign === 'des-cookie' || currentDesign === 'des-round';
    return { incompatible, tooltip: incompatible ? 'Not compatible with Cookie or Round designs' : '' };
  }
  if (addonId === 'addon-chamfered-edges') {
    const incompatible = currentDesign === 'des-cookie' || currentDesign === 'des-round' || currentAddons.includes('addon-live-edge');
    return { incompatible, tooltip: incompatible ? 'Not compatible with Cookie or Round designs, Rounded Corners, Squoval, or Live Edge' : '' };
  }
  return { incompatible: false, tooltip: '' };
}

function updateEdgeProfileAddonAvailability(appState = state) {
  const root = document.getElementById('addons-options');
  if (!root) return;
  const addons = appState && appState.selections && appState.selections.options
    ? appState.selections.options.addon
    : [];
  const currentAddons = Array.isArray(addons) ? addons : [];
  const currentDesign = appState && appState.selections ? appState.selections.design : null;
  const selectedEdge = EDGE_PROFILE_ADDONS.find(id => currentAddons.includes(id)) || '';

  EDGE_PROFILE_ADDONS.forEach((addonId) => {
    const checkbox = root.querySelector(`.addons-dropdown-option-checkbox[data-addon-id="${addonId}"]`);
    const option = root.querySelector(`.addons-dropdown-option[data-addon-id="${addonId}"]`);
    if (!checkbox || !option) return;

    const base = getEdgeProfileBaseIncompatibility(addonId, currentDesign, currentAddons);
    const disableBySelection = selectedEdge && addonId !== selectedEdge;
    const shouldDisable = base.incompatible || disableBySelection;

    if (shouldDisable) {
      checkbox.disabled = true;
      if (disableBySelection) {
        checkbox.checked = false;
      }
      const tooltip = base.incompatible ? base.tooltip : EDGE_PROFILE_TOOLTIP;
      if (tooltip) {
        checkbox.setAttribute('data-tooltip', tooltip);
        option.setAttribute('data-tooltip', tooltip);
      }
      if (disableBySelection) {
        checkbox.setAttribute('data-disabled-by', 'edge-profile');
        option.setAttribute('data-disabled-by', 'edge-profile');
      }
      option.classList.add('disabled');
      option.classList.remove('selected');
      option.setAttribute('aria-disabled', 'true');
      return;
    }

    const disabledBy = checkbox.getAttribute('data-disabled-by') || '';
    if (disabledBy === 'edge-profile') {
      checkbox.disabled = false;
      checkbox.removeAttribute('data-disabled-by');
      if (checkbox.getAttribute('data-tooltip') === EDGE_PROFILE_TOOLTIP) {
        checkbox.removeAttribute('data-tooltip');
      }
      option.classList.remove('disabled');
      option.removeAttribute('aria-disabled');
      if (option.getAttribute('data-disabled-by') === 'edge-profile') {
        option.removeAttribute('data-disabled-by');
      }
      if (option.getAttribute('data-tooltip') === EDGE_PROFILE_TOOLTIP) {
        option.removeAttribute('data-tooltip');
      }
    }
  });

  updateAllIndicators();
}

/**
 * Update legs and tube size options based on selected model and design
 * Filters legs to only show those compatible with the model and design
 * Filters tube sizes to only show those used by visible legs and compatible with model
 */
async function updateLegsOptionsForModel(modelId, allLegs, allTubeSizes, designId = null) {
  if (!modelId) return;

  const { renderOptionCards } = await import('./stageRenderer.js');
  const legMultiplier = getLegPriceMultiplier(state);

  // Filter legs: only show designs compatible with this model and design (and not hidden)
  const visibleLegs = getVisibleLegs(modelId, allLegs, designId);
  const pricedLegs = applyLegPriceMultiplier(visibleLegs, legMultiplier);

  // Render filtered legs
  const legsRoot = document.getElementById('legs-options');
  if (legsRoot) {
    renderOptionCards(legsRoot, pricedLegs, { category: 'legs' });
  }

  // Filter tube sizes: only show if at least one visible leg uses it AND it's compatible with the model
  const availableTubeSizes = getAvailableTubeSizes(modelId, visibleLegs, allTubeSizes);

  // Render filtered tube sizes
  const tubeSizesRoot = document.getElementById('tube-size-options');
  if (tubeSizesRoot) {
    renderOptionCards(tubeSizesRoot, availableTubeSizes, { category: 'tube-size', showPrice: false });
  }

  // Recompute tube size constraints based on current leg selection
  try {
    recomputeTubeSizeConstraints();
  } catch (e) {
    log.warn('Failed to recompute constraints', e);
  }
  updateLegPricingUI(state, allLegs);
}

// Listen for placeholder selection events dispatched by placeholders.js and stage modules
document.addEventListener('option-selected', async (ev) => {
  const { id, category, price } = ev.detail || { id: null, category: null, price: 0 };
  log.debug('option-selected event', { id, category, price, selections: state.selections });
  
  // Ignore events with null or undefined category (malformed events)
  if (!category) {
    log.warn('Ignoring malformed option-selected event with null/undefined category');
    return;
  }
  
  // Handle model selection (category: 'model')
  if (category === 'model') {
    const stageManager = window.stageManager || null;
    const originStage = stageManager && stageManager.getCurrentStage ? stageManager.getCurrentStage() : null;
    // When model changes, clear ALL selections (design and all options)
    setState({ 
      selections: { 
        model: id, 
        design: null, 
        options: {},
        dimensionsDetail: null
      }, 
      pricing: { base: 0, extras: 0, total: 0 } 
    });
    
    // Clear visual state for design tiles
    document.querySelectorAll('.option-card[data-id^="des-"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    
    // Clear visual state for all option cards to reset UI
    document.querySelectorAll('.option-card[data-category]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 420, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, base: p.base, extras: p.extras, total: p.total } });

    // Update legs and tube size options based on the selected model
    try {
      const allLegs = window._allLegsData || [];
      const allTubeSizes = window._allTubeSizesData || [];
      if (allLegs.length > 0 && allTubeSizes.length > 0) {
        updateLegsOptionsForModel(id, allLegs, allTubeSizes);
      }
    } catch (e) {
      log.warn('Failed to update legs options', e);
    }

    // Re-render designs filtered by the newly selected model
    try {
      const designsSection = document.getElementById('designs-stage-section');
      if (designsSection) {
        const { loadData } = await import('./dataLoader.js');
        const { renderOptionCards, renderAddonsDropdown } = await import('./stageRenderer.js');
        const designs = await loadData('data/designs.json');
        if (designs) {
          const designGrids = designsSection.querySelectorAll('.stage-options-grid');
          if (designGrids && designGrids.length) {
            const filteredDesigns = filterDesignsByModel(designs, id);
            // Add price field for rendering
            const designsWithPrice = filteredDesigns.map(design => ({
              ...design,
              price: id && design.prices ? design.prices[id] : 0
            }));
            renderOptionCards(designGrids[0], designsWithPrice, { category: null });
          }
        }
      }
    } catch (e) {
      log.warn('Failed to re-render designs after model change', e);
    }

    // If user selected a model from a stage beyond Designs, navigate back to Models stage
    try {
      if (stageManager && typeof stageManager.setStage === 'function' && originStage !== null && originStage > 1) {
        log.debug('Model selected from stage, navigating to stage 0', { originStage });
        await stageManager.setStage(0, { skipConfirm: true });
      }
    } catch (e) {
      log.warn('Failed to navigate back to Models stage', e);
    }
  }
  // Handle design selection (category: 'design')
  else if (category === 'design') {
    // Check if addons need to be disabled due to design incompatibility
    const currentAddons = state.selections.options.addon || [];
    // (Addons will be shown as disabled in the UI based on stageRenderer incompatibility checks)

    setState({
      selections: {
        ...state.selections,
        design: id,
        options: {
          ...state.selections.options,
          addon: currentAddons
        }
      }
    });
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, base: p.base, extras: p.extras, total: p.total } });

    // Update legs options based on the selected design
    try {
      const allLegs = window._allLegsData || [];
      const allTubeSizes = window._allTubeSizesData || [];
      if (allLegs.length > 0 && allTubeSizes.length > 0) {
        updateLegsOptionsForModel(state.selections.model, allLegs, allTubeSizes, id);
      }
    } catch (e) {
      log.warn('Failed to update legs options after design change', e);
    }

    // Update addon compatibility based on the selected design
    try {
      const addonsRoot = document.getElementById('addons-options');
      if (addonsRoot) {
        const { loadData } = await import('./dataLoader.js');
        const { renderAddonsDropdown } = await import('./stageRenderer.js');
        const addons = await loadData('data/addons.json');
        if (addons) renderAddonsDropdown(addonsRoot, addons, state);
        updateWaterfallAddonAvailability(state);
      }
    } catch (e) {
      log.warn('Failed to update addon compatibility after design change', e);
    }

    // Update materials based on the selected design
    try {
      const materialsOptionsRoot = document.getElementById('materials-options');
      if (materialsOptionsRoot) {
        const { loadData } = await import('./dataLoader.js');
        const { renderOptionCards } = await import('./stageRenderer.js');
        const mats = await loadData('data/materials.json');
        if (mats) {
          const filteredMaterials = filterMaterialsByDesign(mats, id);
          renderOptionCards(materialsOptionsRoot, filteredMaterials, { category: 'material' });
        }
      }
    } catch (e) {
      log.warn('Failed to update materials after design change', e);
    }
  }
  // Handle other category selections (material, finish, legs, color, etc.)
  else if (category === 'dimensions') {
    const newOptions = { ...state.selections.options, [category]: id };
    const nextSelections = { ...state.selections, options: newOptions };
    if (ev.detail && ev.detail.payload) nextSelections.dimensionsDetail = ev.detail.payload;
    else nextSelections.dimensionsDetail = null;
    setState({ selections: nextSelections });
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
    updateLegPricingUI(state);
  }
  else if (category) {
    const newOptions = { ...state.selections.options, [category]: id };
    // update selections first and then recompute price via computePrice
    setState({ selections: { ...state.selections, options: newOptions } });
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
  }
});

document.addEventListener('custom-color-note-updated', (ev) => {
  const value = ev.detail && typeof ev.detail.value === 'string' ? ev.detail.value : '';
  setState({
    selections: {
      ...state.selections,
      options: {
        ...state.selections.options,
        customColorNote: value
      }
    }
  });
});

// Handle "none" leg selection - clear dependent selections without dispatching events with null ids
document.addEventListener('legs-none-selected', async (ev) => {
  try {
    // Clear tube-size and leg-finish selections without triggering price recomputation loops
    setState({ selections: { ...state.selections, options: { ...state.selections.options, 'tube-size': undefined, 'leg-finish': undefined } } });
    const p = await computePrice(state);
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
  } catch (e) {
    log.warn('Failed to handle legs-none-selected', e);
  }
});

// Handle tube size cleared due to incompatibility with newly selected leg
document.addEventListener('tube-size-cleared-due-to-incompatibility', async (ev) => {
  try {
    // Clear the tube-size selection from state and recompute price
    setState({ selections: { ...state.selections, options: { ...state.selections.options, 'tube-size': undefined } } });
    const p = await computePrice(state);
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
  } catch (e) {
    log.warn('Failed to handle tube-size-cleared-due-to-incompatibility', e);
  }
});

// Handle tube size deselected (when optional and clicked again)
document.addEventListener('tube-size-deselected', async (ev) => {
  try {
    // Clear the tube-size selection from state and recompute price
    setState({ selections: { ...state.selections, options: { ...state.selections.options, 'tube-size': undefined } } });
    const p = await computePrice(state);
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
  } catch (e) {
    log.warn('Failed to handle tube-size-deselected', e);
  }
});

// Handle addon toggles (multi-select). Expect detail: { id, price, checked }
document.addEventListener('addon-toggled', async (ev) => {
  const { id, price, checked } = ev.detail || { id: null, price: 0, checked: false };
  addonsLog.debug('addon-toggled event', { id, price, checked });
  const selectedAddons = new Set((state.selections.options.addon && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : []);
  if (checked) selectedAddons.add(id);
  else selectedAddons.delete(id);
  if (checked && EDGE_PROFILE_ADDONS.includes(id)) {
    EDGE_PROFILE_ADDONS.forEach((addonId) => {
      if (addonId !== id) selectedAddons.delete(addonId);
    });
  }
  if (id === 'addon-waterfall-single' && !checked) {
    selectedAddons.delete('addon-waterfall-second');
  }
  const addonsArray = Array.from(selectedAddons);
  // persist selections then compute price via pricing module
  setState({ selections: { ...state.selections, options: { ...state.selections.options, addon: addonsArray } } });
  updateEdgeProfileAddonAvailability(state);
  const p = await computePrice(state);
  setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
  const from = state.pricing.total || state.pricing.base;
  animatePrice(from, p.total, 320, (val) => updatePriceUI(val));
  updateLegPricingUI(state);
  updateWaterfallAddonAvailability(state);
});

// Handle addon selections (single-select per group). Expect detail: { group, id, price }
document.addEventListener('addon-selected', async (ev) => {
  const { group, id, price } = ev.detail || { group: null, id: null, price: 0 };
  addonsLog.debug('addon-selected event', { group, id, price });
  if (!group) return;
  const selectedAddons = new Set((state.selections.options.addon && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : []);
  // Remove any previous selection in this group
  // Assuming group is like "Power Strips", and ids are like "addon-power-none"
  const groupPrefix = group.toLowerCase().replace(/\s+/g, '-');
  selectedAddons.forEach(addonId => {
    if (addonId.startsWith(`addon-${groupPrefix}`)) {
      selectedAddons.delete(addonId);
    }
  });
  // Add the new selection if not "none"
  if (id && !id.includes('-none')) {
    selectedAddons.add(id);
  }
  const addonsArray = Array.from(selectedAddons);
  setState({ selections: { ...state.selections, options: { ...state.selections.options, addon: addonsArray } } });
  const p = await computePrice(state);
  setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
  const from = state.pricing.total || state.pricing.base;
  animatePrice(from, p.total, 320, (val) => updatePriceUI(val));
  updateLegPricingUI(state);
  updateWaterfallAddonAvailability(state);
});

// Handle tech cable length changes
document.addEventListener('tech-cable-length-changed', (ev) => {
  const { cableLength } = ev.detail || { cableLength: null };
  addonsLog.debug('tech-cable-length-changed event', { cableLength });
  setState({ selections: { ...state.selections, techCableLength: cableLength } });
});

// Request-based restart: stage modules should dispatch 'request-restart' and
// main.js (the canonical mutator) will reset the shared state and navigate to
// the first stage.
document.addEventListener('request-restart', (ev) => {
  try {
    const from = state.pricing.total || state.pricing.base || 0;
    setState({ selections: { model: null, design: null, options: {}, dimensionsDetail: null, techCableLength: null }, pricing: { base: 0, extras: 0, total: 0 } });
    animatePrice(from, 0, 320, (val) => updatePriceUI(val));
    const stageManager = window.stageManager || null;
    if (stageManager && typeof stageManager.setStage === 'function') {
      stageManager.setStage(0);
    } else {
      const ev2 = new CustomEvent('request-stage-change', { detail: { index: 0 } });
      document.dispatchEvent(ev2);
    }
  } catch (e) { /* ignore */ }
});

// Allow non-selection state mutations (e.g., stage manager clears) to refresh pricing with animation.
document.addEventListener('request-price-refresh', async (ev) => {
  try {
    const from = state.pricing.total || state.pricing.base || 0;
    const p = await computePrice(state);
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, base: p.base, extras: p.extras, total: p.total } });
  } catch (e) {
    log.warn('Failed to refresh price', e);
  }
});

// Handle stage change requests from UI modules (e.g., Apply & Next buttons)
document.addEventListener('request-stage-change', (ev) => {
  try {
    const stageManager = window.stageManager || null;
    if (!stageManager) return;
    const { direction, index } = ev.detail || {};
    if (typeof index === 'number') {
      stageManager.setStage(index, { allowSkip: true });
    } else if (direction === 'next') {
      stageManager.nextStage && stageManager.nextStage();
    } else if (direction === 'prev') {
      stageManager.prevStage && stageManager.prevStage();
    }
  } catch (e) { /* ignore */ }
});

// initialize displayed price
document.addEventListener('DOMContentLoaded', () => updatePriceUI(state.pricing.total));

// Initialize the application by loading components
document.addEventListener('DOMContentLoaded', async () => {
  // Load main layout components
  await loadComponent('app-header', 'components/Header.html');
  await loadComponent('app-main', 'pages/MainContent.html');
  await loadComponent('app-sidebar', 'components/Sidebar.html');
  // ModelSelection is loaded lazily into the main stage-panel by the stage manager when
  // the Select Model stage becomes active. Do not preload it into the sidebar.
  await loadComponent('app-footer', 'components/Footer.html');

  // Initialize viewer and controls after MainContent is loaded
  await initViewer();
  initViewerControls();
  resizeViewer(); // Ensure viewer is sized correctly on load

  // Compute and set accurate header height so main content doesn't tuck under it
  const setHeaderVars = () => {
    try {
      const header = document.getElementById('app-header');
      if (!header) return;
      const h = header.offsetHeight || 0;
      document.documentElement.style.setProperty('--header-height', `${h}px`);
      // stage bar lives inside header, so avoid double-subtracting
      document.documentElement.style.setProperty('--stage-bar-height', `0px`);
      const stepper = document.getElementById('top-stepper');
      if (stepper) {
        const styles = window.getComputedStyle(stepper);
        const marginBottom = parseFloat(styles.marginBottom || '0') || 0;
        const navOffset = stepper.getBoundingClientRect().bottom + marginBottom;
        document.documentElement.style.setProperty('--nav-offset', `${Math.round(navOffset)}px`);
      } else {
        document.documentElement.style.setProperty('--nav-offset', `${h}px`);
      }
    } catch (e) {
      // ignore
    }
  };
  setHeaderVars();
  window.addEventListener('resize', setHeaderVars);

  // Load icons after all components are in the DOM
  const iconPlaceholders = document.querySelectorAll('.icon-placeholder[data-icon]');
  iconPlaceholders.forEach(async (element) => {
    const iconName = element.getAttribute('data-icon');
    const iconTitle = element.getAttribute('data-icon-title') || '';
    await loadIcon(element, iconName, iconTitle);
  });

  // Initialize summary tooltip (after footer/header components exist)
  try {
    const { initSummaryTooltip } = await import('./ui/summaryTooltip.js');
    const sb = document.getElementById('summary-btn');
    if (sb) initSummaryTooltip(sb);
  } catch (e) {
    log.warn('Failed to initialize summary tooltip', e);
  }

  // Render model and materials option cards from data files (if placeholders exist)
  try {
    const { loadData } = await import('./dataLoader.js');
    const { renderOptionCards, renderAddonsDropdown } = await import('./stageRenderer.js');
    const modelsRoot = document.getElementById('stage-0-placeholder');
    if (modelsRoot) {
      const models = await loadData('data/models.json');
      // The ModelSelection component expects a deeper container; try to find model-row-grid(s)
      const modelGrids = document.querySelectorAll('.model-row-grid');
      if (modelGrids && modelGrids.length && models) {
        // distribute models across the first grid for simplicity
        renderOptionCards(modelGrids[0], models, { category: null, showPrice: false });
      }
    }

    const materialsOptionsRoot = document.getElementById('materials-options');
    if (materialsOptionsRoot) {
      const mats = await loadData('data/materials.json');
      if (mats) {
        // Filter materials based on currently selected design
        const currentDesign = state.selections && state.selections.design;
        const filteredMaterials = filterMaterialsByDesign(mats, currentDesign);
        renderOptionCards(materialsOptionsRoot, filteredMaterials, { category: 'material' });
      }
    }

    // Render color swatches for the Materials stage from data/colors.json
    const colorOptionsRoot = document.getElementById('color-options');
    if (colorOptionsRoot) {
      const colors = await loadData('data/colors.json');
      if (colors) renderOptionCards(colorOptionsRoot, colors, { category: 'color' });
    }

// Render designs stage from data/designs.json
// Try to find design grids in the designs section (supports multiple rows)
const designsSection = document.getElementById('designs-stage-section');
if (designsSection) {
  const designs = await loadData('data/designs.json');
  if (designs) {
    // Clear existing design option cards and render from data
    const designGrids = designsSection.querySelectorAll('.stage-options-grid');
    if (designGrids && designGrids.length) {
      // Filter designs based on currently selected model
      const currentModel = state.selections && state.selections.model;
      const filteredDesigns = filterDesignsByModel(designs, currentModel);
      // Add price field for rendering
      const designsWithPrice = filteredDesigns.map(design => ({
        ...design,
        price: currentModel && design.prices ? design.prices[currentModel] : 0
      }));
      renderOptionCards(designGrids[0], designsWithPrice, { category: null });
    }
  }
}

    // Render finish stage (coatings + sheens + tints)
    const finishCoatingRoot = document.getElementById('finish-coating-options');
    const finishSheenRoot = document.getElementById('finish-sheen-slider');
    const finishTintRoot = document.getElementById('finish-tint-options');
    if (finishCoatingRoot || finishSheenRoot || finishTintRoot) {
  const finish = await loadData('data/finish.json');
      if (finish) {
        if (finish.coatings && finishCoatingRoot) renderOptionCards(finishCoatingRoot, finish.coatings, { category: 'finish-coating' });
        if (finish.sheens && finishSheenRoot) {
          const { renderSheenSlider } = await import('./stageRenderer.js');
          renderSheenSlider(finishSheenRoot, finish.sheens);
        }
        if (finish.tints && finishTintRoot) renderOptionCards(finishTintRoot, finish.tints, { category: 'finish-tint' });
      }
    }

    // Render dimensions, legs, addons
    // Note: Dimensions stage uses a custom UI panel (DimensionsPanel.html) instead of option cards,
    // so we skip rendering here. The dimensions panel is loaded dynamically by stageManager.
    
    // Load and store legs and tube sizes data for filtering
    let allLegs = [];
    let allTubeSizes = [];
    
    const legsRoot = document.getElementById('legs-options');
    if (legsRoot) {
  allLegs = await loadData('data/legs.json');
      if (allLegs) {
        const legMultiplier = getLegPriceMultiplier(state);
        const pricedLegs = applyLegPriceMultiplier(allLegs, legMultiplier);
        renderOptionCards(legsRoot, pricedLegs, { category: 'legs' });
      }
    }

    const tubeSizesRoot = document.getElementById('tube-size-options');
    if (tubeSizesRoot) {
  allTubeSizes = await loadData('data/tube-sizes.json');
      if (allTubeSizes) renderOptionCards(tubeSizesRoot, allTubeSizes, { category: 'tube-size', showPrice: false });
    }
    
    // Store for use in model-change filtering
    window._allLegsData = allLegs;
    window._allTubeSizesData = allTubeSizes;
    updateLegPricingUI(state, allLegs);

    const legFinishRoot = document.getElementById('leg-finish-options');
    if (legFinishRoot) {
  const legFinish = await loadData('data/leg-finish.json');
      if (legFinish) renderOptionCards(legFinishRoot, legFinish, { category: 'leg-finish' });
    }

    const addonsRoot = document.getElementById('addons-options');
    if (addonsRoot) {
  const addons = await loadData('data/addons.json');
      if (addons) renderAddonsDropdown(addonsRoot, addons, state);
      updateWaterfallAddonAvailability(state);
    }
  } catch (e) {
    log.warn('Failed to render stage data from JSON files', e);
  }

  // Initial state update to render the first stage (use setState to dispatch standardized event)
  setState({});

  // Initialize stage manager after header/sidebar components exist
  try {
    const { default: stageManager } = await import('./stageManager.js');
    stageManager.initStageManager();
  // expose for other modules (summary/restart) to programmatically change stage
  window.stageManager = stageManager;
    log.info('Stage manager initialized from main.js');
    // header height may change when stage changes sticky/static; recalc on next frame
    setTimeout(setHeaderVars, 0);
  } catch (err) {
    log.warn('Failed to initialize stage manager from main.js', err);
  }

  // If we loaded the Summary page markup, populate its panel now
  try {
    const hasSummary = document.getElementById('summary-panel');
    if (hasSummary) populateSummaryPanel();
  } catch (e) { /* ignore */ }

  // Initialize summary action handlers (capture/export/restart) if present
  try {
    const { initSummaryActions } = await import('./stages/summary.js');
    if (document.getElementById('summary-panel')) initSummaryActions();
  } catch (e) { /* ignore */ }

  // Initialize placeholder interactions (click handlers, price animation, skeleton)
  try { initPlaceholderInteractions(); } catch (e) { log.warn('Failed to init placeholder interactions', e); }

  const loadingScreen = document.getElementById('app-loading');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    loadingScreen.setAttribute('aria-hidden', 'true');
  }

  // Set up beforeunload warning for unsaved customizations
  window.addEventListener('beforeunload', (event) => {
    const { selections } = state;
    // Check if user has made any customizations beyond the initial empty state
    const hasCustomizations = selections.model || selections.design || 
                              Object.keys(selections.options || {}).length > 0 ||
                              selections.dimensionsDetail;
    if (hasCustomizations) {
      // Set returnValue to trigger browser warning dialog
      event.returnValue = '';
      event.preventDefault();
      return '';
    }
  });

  // Log successful app load with timestamp
  console.log('%c✓ WoodLab Configurator loaded successfully', 'color: #10b981; font-weight: bold; font-size: 12px;');
  console.log('Last updated: 2026-01-22 12:29');
console.log('Edit ver: 475');
  console.log('Config export: run exportConfig() in the console to print JSON for copy/paste.');
});
