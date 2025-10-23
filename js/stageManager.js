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
import { state as appState } from './state.js';
// helper from placeholders to recompute finish constraints when selections are set programmatically
import { recomputeFinishConstraints } from './ui/placeholders.js';
import { applyFinishDefaults } from './stages/finish.js';
import { computePrice } from './pricing.js';
import { showBanner } from './ui/banner.js';
import { init as initModelStage } from './stages/model.js';
import materialsStage, { init as initMaterialsStage } from './stages/materials.js';
import finishStage, { init as initFinishStage } from './stages/finish.js';
import dimensionsStage from './stages/dimensions.js';
import legsStage from './stages/legs.js';
import addonsStage from './stages/addons.js';
import summaryStage from './stages/summary.js';

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

async function updateLivePrice() {
  // Primary price container: sidebar #price-bar. Keep fallback to legacy header #live-price
  const sidebarPrice = document.getElementById('price-bar');
  if (sidebarPrice) {
    // compute authoritative price using shared state where possible
    try {
      const p = await computePrice(appState);
      sidebarPrice.textContent = formatPrice(p.total || (managerState.config.price || 0));
      return;
    } catch (e) {
      // fallback
      sidebarPrice.textContent = formatPrice(managerState.config.price || 0);
      return;
    }
    return;
  }
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
      // keep at current, optionally show a small banner
      showBanner('Please select a model before proceeding.');
      return;
    }
    // If attempting to move to the Finish stage (index 2), require both a wood
    // (material) and a color selection. We check the shared app state which is
    // updated by main.js when option-selected events occur.
    try {
      if (index >= 2) {
        const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
        const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
        if (!hasMaterial || !hasColor) {
          showBanner('Please choose both a wood and a color before proceeding to Finish.');
          return;
        }
        // Ensure Finish stage has sensible defaults: select 2K Poly coating and Satin sheen if
        // they are not already selected. This updates the shared app state and triggers UI restoration.
        try {
          // delegate finish defaults to dedicated module
          applyFinishDefaults(appState, setAppState);
        } catch (e) {
          console.warn('Failed to apply finish defaults via module:', e);
        }
      }
    } catch (e) {
      // if anything goes wrong reading appState, be conservative and block advance
      showBanner('Please complete required selections before proceeding.');
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
  // Special case: Select Model stage should be full-width and not show the sidebar.
  // Use CSS (body.show-model-tiles) to reflow layout instead of moving DOM nodes.
  const sidebar = document.getElementById('app-sidebar');
  const viewer = document.getElementById('viewer');
  const viewerControls = document.getElementById('viewer-controls-container');
  if (managerState.current === 0) {
    // hide sidebar and viewer chrome; CSS will make the stage panel span full width
    if (sidebar) sidebar.style.display = 'none';
    if (viewer) viewer.style.display = 'none';
    if (viewerControls) viewerControls.style.display = 'none';
    // Move the Select Model panel out of the sidebar and into the main flow so
    // it can span the full viewport. We restore it to its original container
    // when leaving stage 0. This is a minimal, explicit reparent to avoid
    // relying solely on timing-sensitive body class toggles.
    try {
      const panel = document.getElementById('stage-panel-0');
      const root = document.getElementById('stage-panels-root');
      const header = document.getElementById('app-header');
      if (panel && root && header) {
        // remember that we moved it
        if (!panel.dataset.wlOrigParent) panel.dataset.wlOrigParent = 'stage-panels-root';
        // insert after header so CSS selectors like #app-header + #stage-panel-0 apply
        document.body.insertBefore(panel, header.nextSibling);
      }
      // ensure the ModelSelection component is loaded into the in-place panel placeholder
      await loadComponent('stage-0-placeholder', 'components/ModelSelection.html');
      // Restore visual selections when entering model selection stage
      setTimeout(() => {
        try {
          import('./ui/placeholders.js').then(({ initPlaceholderInteractions }) => {
            // Call restore function if already initialized, otherwise it will be called during init
            if (document.querySelector('.option-card[data-id^="mdl-"]')) {
              // Trigger a statechange-like restoration
              document.dispatchEvent(new CustomEvent('statechange', { detail: { state: appState } }));
            }
          });
        } catch (e) {
          console.warn('Failed to restore selections on stage change:', e);
        }
      }, 100); // Small delay to ensure DOM is ready
    } catch (e) {
      // ignore load errors
    }
      // Restore model stage UI from app state
      try { import('./stages/model.js').then(mod => mod.restoreFromState && mod.restoreFromState(appState)); } catch (e) {}
  } else {
    // restore sidebar and viewer/chrome visibility
    if (sidebar) sidebar.style.display = '';
    if (viewer) viewer.style.display = '';
    if (viewerControls) viewerControls.style.display = '';
    // Clean up the stage-0 placeholder to avoid duplicates (the component remains in-place)
    try {
      const ph = document.getElementById('stage-0-placeholder');
      if (ph) ph.innerHTML = '';
      // If we previously moved #stage-panel-0 out of the sidebar, put it back
      const panel = document.getElementById('stage-panel-0');
      const root = document.getElementById('stage-panels-root');
      if (panel && root && panel.dataset.wlOrigParent === 'stage-panels-root') {
        root.appendChild(panel);
        delete panel.dataset.wlOrigParent;
      }
    } catch (e) {}
      // Restore UI for non-model stages
      try {
        const s = appState;
        if (managerState.current === 1) materialsStage.restoreFromState && materialsStage.restoreFromState(s);
        if (managerState.current === 2) finishStage.restoreFromState && finishStage.restoreFromState(s);
        if (managerState.current === 3) dimensionsStage.restoreFromState && dimensionsStage.restoreFromState(s);
        if (managerState.current === 4) legsStage.restoreFromState && legsStage.restoreFromState(s);
        if (managerState.current === 5) addonsStage.restoreFromState && addonsStage.restoreFromState(s);
        if (managerState.current === 6) summaryStage.restoreFromState && summaryStage.restoreFromState(s);
      } catch (e) { /* ignore */ }
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

// Model-stage interactions are handled by `js/stages/model.js`.
// The module dispatches 'stage-model-selected' when a model is picked.

export function initStageManager() {
  // initial wiring
  wireStageButtons();
  // Initialize model stage module which wires option-card clicks for models
  try {
    initModelStage();
  } catch (e) {
    console.warn('Failed to initialize model stage module', e);
  }
  // Initialize remaining stage modules
  try { initMaterialsStage(); } catch (e) { console.warn('Failed to init materials stage', e); }
  try { initFinishStage(); } catch (e) { console.warn('Failed to init finish stage', e); }
  try { dimensionsStage.init && dimensionsStage.init(); } catch (e) { /* ignore */ }
  try { legsStage.init && legsStage.init(); } catch (e) { /* ignore */ }
  try { addonsStage.init && addonsStage.init(); } catch (e) { /* ignore */ }
  try { summaryStage.init && summaryStage.init(); } catch (e) { /* ignore */ }
  // Listen for a model selection event from the model stage module to update managerState
  document.addEventListener('stage-model-selected', (ev) => {
    const { id, price } = ev.detail || {};
    if (!id) return;
    managerState.config.model = id;
    managerState.config.price = Number(price) || 0;
    markCompleted(0, true);
    updateLivePrice();
    // enable material stage button
    const materialBtn = document.querySelector(`#stage-bar .stage-btn[data-stage-index='1']`);
    if (materialBtn) materialBtn.disabled = false;
  });
  updateLivePrice();
  // Mark current stage completed when options are selected elsewhere in the app
  document.addEventListener('option-selected', (ev) => {
    // For the Materials stage (index 1) require both material and color to
    // consider the stage complete. For other stages, marking on selection is fine.
    if (managerState.current === 1) {
      const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
      const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
      markCompleted(1, !!(hasMaterial && hasColor));
    } else if (managerState.current === 2) {
      // For Finish stage, require both a coating and a sheen to consider the stage complete.
      const hasCoating = !!(appState.selections && appState.selections.options && (appState.selections.options['finish-coating'] || appState.selections.options.coating));
      const hasSheen = !!(appState.selections && appState.selections.options && (appState.selections.options['finish-sheen'] || appState.selections.options.sheen));
      markCompleted(2, !!(hasCoating && hasSheen));
    } else {
      // mark the active stage complete so Next becomes enabled
      markCompleted(managerState.current, true);
    }
    // run a UI update to refresh Next/Prev/button states
    setStage(managerState.current);
  });

  setStage(0);
}

// Use shared showBanner from ui/banner.js for consistent styling and accessibility.

// expose for debugging
window.__wlStage = { state: managerState, setStage, nextStage, prevStage, initStageManager };

export default { initStageManager, state: managerState, setStage };
