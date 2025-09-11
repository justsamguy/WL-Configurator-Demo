// Minimal stage manager for WL Configurator
// Responsibilities:
// - Track current stage index
// - Enable/disable stage buttons
// - Prev/Next navigation with simple gating rules
// - React to model selection events to set price and mark stage complete

const STAGES = [
  'Select Model',
  'Materials',
  'Finish',
  'Dimensions',
  'Legs',
  'Add-ons',
  'Summary & Export'
];

import { loadComponent } from './app.js';
import { state as appState, setState as setAppState } from './state.js';

const managerState = {
  current: 0,
  completed: new Array(STAGES.length).fill(false),
  config: {
    model: null,
    material: null,
    finish: null,
    dimensions: {},
    legs: null,
    addons: [],
    price: 0
  }
};

// Stages that are optional (no selection required to advance)
const OPTIONAL_STAGES = [5]; // index 5 = 'Add-ons'

function $(sel) {
  return document.querySelector(sel);
}

function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function formatPrice(centsOrUnits) {
  // Input is USD in whole units in this repo; keep simple formatting
  return `$${Number(centsOrUnits).toLocaleString()}`;
}

function updateLivePrice() {
  const elAmount = $('#live-price .price-amount');
  if (!elAmount) return;
  elAmount.textContent = formatPrice(managerState.config.price || 0);
}

async function setStage(index, options = {}) {
  // options: { allowSkip: boolean }
  if (index < 0 || index >= STAGES.length) return;
  // gating: normally prevent jumping forward past first incomplete required stage (model required)
  // but callers can pass { allowSkip: true } to bypass the gating (used by Next button)
  if (index > managerState.current && !options.allowSkip) {
    // require model selected to advance beyond 0
    if (!managerState.config.model) {
      // keep at current, optionally show a small banner (omitted here)
      return;
    }
  }
  managerState.current = index;
  // treat optional stages as implicitly completed for gating decisions
  const currentCompleted = !!managerState.completed[managerState.current] || OPTIONAL_STAGES.includes(managerState.current);
  // update buttons
  $all('#stage-bar .stage-btn').forEach(btn => {
    const idx = Number(btn.getAttribute('data-stage-index'));
    if (idx === managerState.current) {
      btn.setAttribute('aria-current', 'step');
      btn.disabled = false;
    } else {
      btn.removeAttribute('aria-current');
      // allow revisiting previous stages
      if (idx < managerState.current) {
        btn.disabled = false;
      } else {
        // For future stages (idx > current):
        // - allow if that future stage is already completed (user previously finished it),
        // - or allow only the immediate next stage when the current stage is completed.
        if (managerState.completed[idx]) {
          btn.disabled = false;
        } else if (idx === managerState.current + 1 && currentCompleted) {
          btn.disabled = false;
        } else {
          btn.disabled = true;
        }
      }
    }
  });

  // Prev/Next
  const prev = $('#prev-stage');
  const next = $('#next-stage');
  if (prev) {
    prev.disabled = managerState.current === 0;
    prev.classList.toggle('opacity-40', prev.disabled);
  }
  if (next) {
  // disable Next unless we're not at the last stage AND the current stage is completed
  const atLast = managerState.current === STAGES.length - 1;
  // currentCompleted was computed above and already includes optional-stage handling
  const canAdvanceFromCurrent = currentCompleted;
  next.disabled = atLast || !canAdvanceFromCurrent;
  next.classList.toggle('opacity-40', next.disabled);
  // hide Next entirely on the final Summary & Export stage
  next.style.display = atLast ? 'none' : '';
  }

  // show/hide stage content panels if present (convention: panels use id stage-panel-<index>)
  $all('[id^="stage-panel-"]').forEach(panel => {
    const idx = Number(panel.id.replace('stage-panel-', ''));
    panel.style.display = idx === managerState.current ? '' : 'none';
  });

  // Sidebar no longer contains a model selection placeholder; model tiles are loaded
  // directly into the main stage panel when stage 0 is active.

  // Add a body-level class so CSS can easily show/hide model tiles across the app.
  // When not on the Select Model stage, model tiles are hidden by default.
  try {
    document.body.classList.toggle('show-model-tiles', managerState.current === 0);
  } catch (e) {
    // document.body might not be available in some test contexts; ignore.
  }

  // Recompute and set accurate header height so main content doesn't tuck under it.
  try {
    const header = document.getElementById('app-header');
    if (header) {
      const h = header.offsetHeight || 0;
      document.documentElement.style.setProperty('--header-height', `${h}px`);
    }
  } catch (e) {
    // ignore
  }

  // Show only the sidebar info section that corresponds to the active stage (if present)
  try {
    const infos = document.querySelectorAll('#sidebar-info-root .sidebar-info');
    infos.forEach(sec => { sec.style.display = 'none'; });
    const active = document.getElementById(`info-stage-${managerState.current}`);
    if (active) active.style.display = '';
  } catch (e) {
    // ignore if sidebar info root not present
  }

  // Special case: Select Model stage should be full-width and not show the sidebar.
  // Move the stage-panel-0 into the main area and hide the sidebar while on stage 0.
  const sidebar = document.getElementById('app-sidebar');
  const main = document.getElementById('app-main');
  const panel0 = document.getElementById('stage-panel-0');
  if (managerState.current === 0) {
    if (sidebar) sidebar.style.display = 'none';
    if (panel0 && main) {
      // remember original parent so we can restore later
      if (!panel0.__originalParent) panel0.__originalParent = panel0.parentElement;
      // move the panel into main if it's not already there
      // insert the panel after the top-stepper (if present) so it appears below
      // the stage bar/heading and spans the full grid; fall back to inserting
      // after the header if the stepper isn't present.
      const header = document.getElementById('app-header');
      const stepper = document.getElementById('top-stepper');
      const insertionParent = header && header.parentElement;
      if (panel0.parentElement !== insertionParent && insertionParent) {
        panel0.style.display = '';
        if (stepper && stepper.parentElement === insertionParent) {
          // insert after the stepper element
          insertionParent.insertBefore(panel0, stepper.nextSibling);
        } else {
          // fallback: insert directly after header
          insertionParent.insertBefore(panel0, header.nextSibling);
        }
        // add fullwidth hook class to allow different styling
  panel0.classList.add('fullwidth-model-stage');
        // hide the viewer and viewer controls while selecting model
        const viewer = document.getElementById('viewer');
        if (viewer) viewer.style.display = 'none';
        const viewerControls = document.getElementById('viewer-controls-container');
        if (viewerControls) viewerControls.style.display = 'none';
      }
    }
    // ensure the ModelSelection component is loaded into the panel's placeholder
    try {
      await loadComponent('stage-0-placeholder', 'components/ModelSelection.html');
    } catch (e) {
      // ignore load errors
    }
  } else {
    // restore sidebar and ensure panel0 is back in its original place
    if (sidebar) sidebar.style.display = '';
    if (panel0 && panel0.__originalParent && panel0.parentElement !== panel0.__originalParent) {
      panel0.style.display = 'none';
  // remove fullwidth styling
  panel0.classList.remove('fullwidth-model-stage');
  // restore viewer and viewer controls display
  const viewer = document.getElementById('viewer');
  if (viewer) viewer.style.display = '';
  const viewerControls = document.getElementById('viewer-controls-container');
  if (viewerControls) viewerControls.style.display = '';
      panel0.__originalParent.appendChild(panel0);
      // remove model selection content from the panel placeholder to avoid duplicate model tiles
      try {
        const ph = document.getElementById('stage-0-placeholder');
        if (ph) ph.innerHTML = '';
      } catch (e) {}
    }
  }
}

function nextStage() {
  // If current stage isn't completed, show banner and block advancing
  if (!managerState.completed[managerState.current]) {
    showBanner('Please select an option before proceeding.');
    return;
  }
  setStage(Math.min(managerState.current + 1, STAGES.length - 1));
}

function prevStage() {
  setStage(Math.max(managerState.current - 1, 0));
}

function markCompleted(index, completed = true) {
  if (index < 0 || index >= STAGES.length) return;
  managerState.completed[index] = completed;
  // enable next stage if current completed
  const nextIdx = index + 1;
  const nextBtn = document.querySelector(`#stage-bar .stage-btn[data-stage-index='${nextIdx}']`);
  if (nextBtn) nextBtn.disabled = !completed;
}

function wireStageButtons() {
  $all('#stage-bar .stage-btn').forEach(btn => {
    const idx = Number(btn.getAttribute('data-stage-index'));
    btn.addEventListener('click', () => setStage(idx));
  });
  const prev = $('#prev-stage');
  const next = $('#next-stage');
  if (prev) prev.addEventListener('click', prevStage);
  if (next) next.addEventListener('click', nextStage);
}

function wireModelSelection() {
  // Use event delegation so dynamically-inserted model option-cards are handled.
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-id^="mdl-"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    // mark selected state (only for model cards)
    $all('.option-card[data-id^="mdl-"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    card.setAttribute('aria-pressed', 'true');
  const id = card.getAttribute('data-id');
  const price = Number(card.getAttribute('data-price')) || 0;
  managerState.config.model = id;
  managerState.config.price = price;
  // Synchronize shared app state so viewer and other modules update from the canonical source
  try { setAppState({ selections: { ...appState.selections, model: id }, pricing: { ...appState.pricing, extras: appState.pricing.extras || 0, total: (appState.pricing.base || 0) + (appState.pricing.extras || 0) + price } }); } catch (e) {}
    markCompleted(0, true);
    updateLivePrice();
    // enable material stage button
    const materialBtn = document.querySelector(`#stage-bar .stage-btn[data-stage-index='1']`);
    if (materialBtn) materialBtn.disabled = false;
  // Do not automatically advance to the next stage when a model is selected.
  // Selection should only mark the stage completed and enable the Next button;
  // advancing should happen only when the user clicks Next or a stage button.
    // If a viewer API exists, call it to load model
    // viewer.js listens for 'statechange' and will update the displayed model accordingly
  });
}

export function initStageManager() {
  // initial wiring
  wireStageButtons();
  wireModelSelection();
  updateLivePrice();
  // Mark current stage completed when options are selected elsewhere in the app
  document.addEventListener('option-selected', (ev) => {
    // mark the active stage complete so Next becomes enabled
    markCompleted(managerState.current, true);
    // run a UI update to refresh Next/Prev/button states
    setStage(managerState.current);
  });

  setStage(0);
}

function showBanner(message, timeout = 2500) {
  const container = document.getElementById('banner-container') || document.body;
  const banner = document.createElement('div');
  banner.className = 'banner bg-gray-800 text-white px-4 py-2 rounded shadow-md mt-2';
  banner.textContent = message;
  container.appendChild(banner);
  setTimeout(() => {
    banner.classList.add('opacity-0');
    setTimeout(() => banner.remove(), 300);
  }, timeout);
}

// expose for debugging
window.__wlStage = { state: managerState, setStage, nextStage, prevStage, initStageManager };

export default { initStageManager, state: managerState, setStage };
