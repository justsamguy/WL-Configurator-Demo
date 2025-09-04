// WoodLab Configurator - main.js
// WoodLab Configurator - main.js
// App bootstrap and global state management

// WoodLab Configurator - main.js
// App bootstrap and global state management

import { loadComponent } from './app.js';
import { loadIcon } from './ui/icon.js';
import { initPlaceholderInteractions } from './ui/placeholders.js';
import { initViewer, initViewerControls, resizeViewer } from './viewer.js'; // Import viewer functions

export const state = {
  stage: 1, // 1: Model, 2: Customize, 3: Summary
  selections: { model: null, options: {} },
  pricing: { base: 12480, extras: 0, total: 12480 }
};

// Dispatch a custom event when state changes
export function setState(newState) {
  Object.assign(state, newState);
  document.dispatchEvent(new Event("statechange"));
}

// Listen for state changes to update UI
document.addEventListener("statechange", () => {
  // This is where main.js would orchestrate updates across other modules
  // For now, app.js still handles the direct UI updates based on state.
  // In a more complex app, main.js might call functions from app.js, viewer.js, etc.
  // to trigger their respective updates.
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
document.addEventListener('option-selected', (ev) => {
  const { id, price } = ev.detail || { id: null, price: 0 };
  // option-selected is used for single-choice selections (model, material, finish, legs, dimensions)
  const category = ev.detail && ev.detail.category ? ev.detail.category : null;
  // update selections: place under selections.options[category] when category provided, otherwise assume model
  if (category) {
    const newOptions = { ...state.selections.options, [category]: id };
    // extras should not be fully replaced by single-choice option price; it's sum of addon prices only
    const newPricing = { ...state.pricing };
    // Recompute total from base + extras
    newPricing.total = newPricing.base + newPricing.extras;
    setState({ selections: { ...state.selections, options: newOptions }, pricing: newPricing });
    // animate price (no change expected unless addons changed)
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, newPricing.total, 300, (val) => updatePriceUI(val));
  } else {
    // assume model selection
    const newExtras = state.pricing.extras || 0;
    const newTotal = state.pricing.base + newExtras + (price || 0);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, newTotal, 420, (val) => updatePriceUI(val));
    setState({ selections: { ...state.selections, model: id }, pricing: { ...state.pricing, extras: newExtras, total: newTotal } });
  }
});

// Handle addon toggles (multi-select). Expect detail: { id, price, checked }
document.addEventListener('addon-toggled', (ev) => {
  const { id, price, checked } = ev.detail || { id: null, price: 0, checked: false };
  const selectedAddons = new Set((state.selections.options.addon && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : []);
  if (checked) selectedAddons.add(id);
  else selectedAddons.delete(id);
  const addonsArray = Array.from(selectedAddons);
  // recompute extras as sum of addon prices plus any non-addon extras (should be zero here)
  // We only have addon extras in this simplified app, so extras = sum(addon prices)
  let extras = 0;
  // try to find buttons in DOM to read prices for each selected addon
  addonsArray.forEach(aid => {
    const el = document.querySelector(`.option-card[data-id="${aid}"]`);
    const p = el ? parseInt(el.getAttribute('data-price') || '0', 10) : 0;
    extras += p;
  });
  const newPricing = { ...state.pricing, extras, total: state.pricing.base + extras };
  setState({ selections: { ...state.selections, options: { ...state.selections.options, addon: addonsArray } }, pricing: newPricing });
  // animate price change
  const from = state.pricing.total || state.pricing.base;
  animatePrice(from, newPricing.total, 320, (val) => updatePriceUI(val));
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

  // Initial state update to render the first stage
  document.dispatchEvent(new Event("statechange"));

  // Initialize stage manager after header/sidebar components exist
  try {
    const { default: stageManager } = await import('./stageManager.js');
    stageManager.initStageManager();
    console.log('Stage manager initialized from main.js');
    // header height may change when stage changes sticky/static; recalc on next frame
    setTimeout(setHeaderVars, 0);
  } catch (err) {
    console.warn('Failed to initialize stage manager from main.js', err);
  }

  // Initialize placeholder interactions (click handlers, price animation, skeleton)
  try { initPlaceholderInteractions(); } catch (e) { console.warn('Failed to init placeholder interactions', e); }
});
