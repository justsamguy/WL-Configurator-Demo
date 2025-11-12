// WoodLab Configurator - main.js
// WoodLab Configurator - main.js
// App bootstrap and global state management

// WoodLab Configurator - main.js
// App bootstrap and global state management

import { loadComponent } from './app.js';
import { loadIcon } from './ui/icon.js';
import { initPlaceholderInteractions } from './ui/placeholders.js';
import { initViewer, initViewerControls, resizeViewer } from './viewer.js'; // Import viewer functions
import { state, setState } from './state.js';
import { computePrice } from './pricing.js';
import { populateSummaryPanel } from './stages/summary.js';

// Listen for state changes to update UI
document.addEventListener('statechange', (ev) => {
  // main orchestrator can react to state changes here if needed.
  // ev.detail.state contains the latest state object.
  // If the summary page is active, refresh its contents
  try {
    const summaryRoot = document.getElementById('summary-model-name');
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
  el.textContent = `$${total.toLocaleString()} `;
  const usd = document.createElement('span');
  usd.className = 'text-xs font-normal';
  usd.textContent = 'USD';
  el.appendChild(usd);
}

// Listen for placeholder selection events dispatched by placeholders.js
document.addEventListener('option-selected', async (ev) => {
  const { id, price } = ev.detail || { id: null, price: 0 };
  // option-selected is used for single-choice selections (model, material, finish, legs, dimensions)
  const category = ev.detail && ev.detail.category ? ev.detail.category : null;
  // update selections: place under selections.options[category] when category provided, otherwise assume model
  if (category) {
    const newOptions = { ...state.selections.options, [category]: id };
    // update selections first and then recompute price via computePrice
    setState({ selections: { ...state.selections, options: newOptions } });
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
  } else {
    // assume model selection - set base price to model price
    setState({ selections: { ...state.selections, model: id }, pricing: { ...state.pricing, base: price } });
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 420, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, base: price, extras: p.extras, total: p.total } });
  }
});

// Handle addon toggles (multi-select). Expect detail: { id, price, checked }
document.addEventListener('addon-toggled', async (ev) => {
  const { id, price, checked } = ev.detail || { id: null, price: 0, checked: false };
  const selectedAddons = new Set((state.selections.options.addon && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : []);
  if (checked) selectedAddons.add(id);
  else selectedAddons.delete(id);
  const addonsArray = Array.from(selectedAddons);
  // persist selections then compute price via pricing module
  setState({ selections: { ...state.selections, options: { ...state.selections.options, addon: addonsArray } } });
  const p = await computePrice(state);
  setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
  const from = state.pricing.total || state.pricing.base;
  animatePrice(from, p.total, 320, (val) => updatePriceUI(val));
});

// Request-based restart: stage modules should dispatch 'request-restart' and
// main.js (the canonical mutator) will reset the shared state and navigate to
// the first stage.
document.addEventListener('request-restart', (ev) => {
  try {
    setState({ selections: { model: null, options: {} }, pricing: { base: 0, extras: 0, total: 0 } });
    const stageManager = window.stageManager || null;
    if (stageManager && typeof stageManager.setStage === 'function') {
      stageManager.setStage(0);
    } else {
      const ev2 = new CustomEvent('request-stage-change', { detail: { index: 0 } });
      document.dispatchEvent(ev2);
    }
  } catch (e) { /* ignore */ }
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

  // Initialize summary tooltip (after sidebar/header components exist)
  try {
    const { initSummaryTooltip } = await import('./ui/summaryTooltip.js');
    const sb = document.getElementById('summary-btn');
    if (sb) initSummaryTooltip(sb);
  } catch (e) {
    console.warn('Failed to initialize summary tooltip', e);
  }

  // Render model and materials option cards from data files (if placeholders exist)
  try {
    const { loadData } = await import('./dataLoader.js');
    const { renderOptionCards } = await import('./stageRenderer.js');
    const modelsRoot = document.getElementById('stage-0-placeholder');
    if (modelsRoot) {
      const models = await loadData('data/models.json');
      // The ModelSelection component expects a deeper container; try to find model-row-grid(s)
      const modelGrids = document.querySelectorAll('.model-row-grid');
      if (modelGrids && modelGrids.length && models) {
        // distribute models across the first grid for simplicity
        renderOptionCards(modelGrids[0], models, { category: null });
      } else if (modelsRoot && models) {
        renderOptionCards(modelsRoot, models, { category: null });
      }
    }

    const materialsOptionsRoot = document.getElementById('materials-options');
    if (materialsOptionsRoot) {
      const mats = await loadData('data/materials.json');
      if (mats) renderOptionCards(materialsOptionsRoot, mats, { category: 'material' });
    }

    // Render color swatches for the Materials stage from data/colors.json
    const colorOptionsRoot = document.getElementById('color-options');
    if (colorOptionsRoot) {
      const colors = await loadData('data/colors.json');
      if (colors) renderOptionCards(colorOptionsRoot, colors, { category: 'color' });
    }

    // Render finish stage (coatings + sheens)
    const finishCoatingRoot = document.getElementById('finish-coating-options');
    const finishSheenRoot = document.getElementById('finish-sheen-options');
    if (finishCoatingRoot || finishSheenRoot) {
  const finish = await loadData('data/finish.json');
      if (finish) {
        if (finish.coatings && finishCoatingRoot) renderOptionCards(finishCoatingRoot, finish.coatings, { category: 'finish-coating' });
        if (finish.sheens && finishSheenRoot) renderOptionCards(finishSheenRoot, finish.sheens, { category: 'finish-sheen' });
      }
    }

    // Render dimensions, legs, addons
    // Note: Dimensions stage uses a custom UI panel (DimensionsPanel.html) instead of option cards,
    // so we skip rendering here. The dimensions panel is loaded dynamically by stageManager.
    
    const legsRoot = document.getElementById('legs-options');
    if (legsRoot) {
  const legs = await loadData('data/legs.json');
      if (legs) renderOptionCards(legsRoot, legs, { category: 'legs' });
    }

    const addonsRoot = document.getElementById('addons-options');
    if (addonsRoot) {
  const addons = await loadData('data/addons.json');
      if (addons) renderOptionCards(addonsRoot, addons, { category: 'addon', multi: true });
    }
  } catch (e) {
    console.warn('Failed to render stage data from JSON files', e);
  }

  // Initial state update to render the first stage (use setState to dispatch standardized event)
  setState({});

  // Initialize stage manager after header/sidebar components exist
  try {
    const { default: stageManager } = await import('./stageManager.js');
    stageManager.initStageManager();
  // expose for other modules (summary/restart) to programmatically change stage
  window.stageManager = stageManager;
    console.log('Stage manager initialized from main.js');
    // header height may change when stage changes sticky/static; recalc on next frame
    setTimeout(setHeaderVars, 0);
  } catch (err) {
    console.warn('Failed to initialize stage manager from main.js', err);
  }

  // If we loaded the Summary page markup, populate its panel now
  try {
    const hasSummary = document.getElementById('summary-model-name');
    if (hasSummary) populateSummaryPanel();
  } catch (e) { /* ignore */ }

  // Initialize summary action handlers (capture/export/restart) if present
  try {
    const { initSummaryActions } = await import('./stages/summary.js');
    if (document.getElementById('summary-model-name')) initSummaryActions();
  } catch (e) { /* ignore */ }

  // Initialize placeholder interactions (click handlers, price animation, skeleton)
  try { initPlaceholderInteractions(); } catch (e) { console.warn('Failed to init placeholder interactions', e); }

  // Log successful app load with timestamp
  console.log('%c✓ WoodLab Configurator loaded successfully', 'color: #10b981; font-weight: bold; font-size: 12px;');
  console.log('Last updated: 2025-11-12 15:45');
});
