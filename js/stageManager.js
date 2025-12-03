// Minimal stage manager for WL Configurator
// Responsibilities:
// - Track current stage index
// - Enable/disable stage buttons
// - Prev/Next navigation with simple gating rules
// - React to model selection events to set price and mark stage complete

const STAGES = [
  'Models',
  'Designs',
  'Materials',
  'Finish',
  'Dimensions',
  'Legs',
  'Add-ons',
  'Summary & Export'
];

import { loadComponent } from './app.js';
import { state as appState, setState } from './state.js';
// helper from placeholders to recompute finish constraints when selections are set programmatically
import { recomputeFinishConstraints } from './ui/placeholders.js';
import { applyFinishDefaults } from './stages/finish.js';
import { computePrice } from './pricing.js';
import { showBanner } from './ui/banner.js';
import { init as initModelsStage } from './stages/models.js';
import { init as initDesignsStage } from './stages/designs.js';
import materialsStage, { init as initMaterialsStage } from './stages/materials.js';
import finishStage, { init as initFinishStage } from './stages/finish.js';
import dimensionsStage from './stages/dimensions.js';
import legsStage from './stages/legs.js';
import addonsStage from './stages/addons.js';
import summaryStage from './stages/summary.js';
import modelsStageModule from './stages/models.js';
import designsStageModule from './stages/designs.js';

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
const OPTIONAL_STAGES = [7]; // index 7 = 'Add-ons'

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

function showConfirmDialog(message, cancelText = 'Cancel', confirmText = 'Confirm') {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50';
    dialog.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6 max-w-sm">
        <p class="text-gray-800 mb-6">${message}</p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded" id="confirm-cancel">${cancelText}</button>
          <button class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded" id="confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    
    const onCancel = () => {
      dialog.remove();
      resolve(false);
    };
    const onConfirm = () => {
      dialog.remove();
      resolve(true);
    };
    
    dialog.querySelector('#confirm-cancel').addEventListener('click', onCancel);
    dialog.querySelector('#confirm-ok').addEventListener('click', onConfirm);
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onCancel();
    });
  });
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
  // options: { allowSkip: boolean, skipConfirm: boolean }
  if (index < 0 || index >= STAGES.length) return;
  
  // Special handling: if navigating back to Models (index 0) and design is already selected,
  // show confirmation dialog unless skipConfirm is true
  if (index === 0 && appState.selections.design && !options.skipConfirm) {
    const confirmed = await showConfirmDialog(
      'Changing models will clear your design selection. Continue?',
      'Cancel',
      'Change Model'
    );
    if (!confirmed) return;
    // User confirmed, proceed with clear design
    setState({ selections: { ...appState.selections, design: null } });
  }
  
  // gating: normally prevent jumping forward past first incomplete required stage
  // but callers can pass { allowSkip: true } to bypass the gating (used by Next button)
  if (index > managerState.current && !options.allowSkip) {
    // require model selected to advance beyond stage 0 (Models)
    if (!appState.selections.model) {
      showBanner('Please select a model before proceeding.');
      return;
    }
    // require design selected to advance beyond stage 1 (Designs)
    if (index > 1 && !appState.selections.design) {
      showBanner('Please select a design before proceeding.');
      return;
    }
    // If attempting to move to the Materials stage (index 2), validate as before
    try {
      if (index >= 3) {
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
          applyFinishDefaults(appState);
        } catch (e) {
          console.warn('Failed to apply finish defaults via module:', e);
        }
      }
      // If attempting to move past Legs or beyond (index > 5), require legs, tube-size, and leg-finish
      if (index > 5) {
        const hasLegs = !!(appState.selections && appState.selections.options && appState.selections.options.legs);
        const hasTubeSize = !!(appState.selections && appState.selections.options && appState.selections.options['tube-size']);
        const hasLegFinish = !!(appState.selections && appState.selections.options && appState.selections.options['leg-finish']);
        if (!hasLegs || !hasTubeSize || !hasLegFinish) {
          showBanner('Please complete all leg selections (style, tube size, and finish) before proceeding.');
          return;
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

  // Also hide/show the MaterialsPanel (containing materials-options and color-options containers)
  // only visible on stage 2 (Materials stage, now shifted due to Models/Designs)
  try {
    const materialsPanel = document.getElementById('materials-panel');
    if (materialsPanel) {
      materialsPanel.style.display = managerState.current === 2 ? '' : 'none';
    }
  } catch (e) {
    // ignore if materials panel not present
  }

  // Add a body-level class so CSS can easily show/hide model tiles across the app.
  // When not on the Models stage (now index 0), model tiles are hidden by default.
  try {
    document.body.classList.toggle('show-model-tiles', managerState.current === 0 || managerState.current === 1);
    // Add stage-specific classes for CSS visibility control
    for (let i = 0; i < STAGES.length; i++) {
      document.body.classList.toggle(`stage-${i}`, managerState.current === i);
    }
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
    const infos = document.querySelectorAll('#stage-info-root .sidebar-info');
    infos.forEach(sec => { sec.style.display = 'none'; });
    const active = document.getElementById(`info-stage-${managerState.current}`);
    if (active) active.style.display = '';
  } catch (e) {
    // ignore if stage info root not present
  }

  // Special case: Models and Designs stages should be full-width and not show the sidebar.
  // Use CSS (body.show-model-tiles) to reflow layout instead of moving DOM nodes.
  const sidebar = document.getElementById('app-sidebar');
  const viewer = document.getElementById('viewer');
  const viewerControls = document.getElementById('viewer-controls-container');
  if (managerState.current === 0 || managerState.current === 1) {
    // hide sidebar and viewer chrome; CSS will make the stage panel span full width
    if (sidebar) sidebar.style.display = 'none';
    if (viewer) viewer.style.display = 'none';
    if (viewerControls) viewerControls.style.display = 'none';
    // Move the Models/Designs panel out of the sidebar and into the main flow so
    // it can span the full viewport. We restore it to its original container
    // when leaving these stages.
    try {
      const panelId = `stage-panel-${managerState.current}`;
      const panel = document.getElementById(panelId);
      const root = document.getElementById('stage-panels-root');
      const header = document.getElementById('app-header');
      if (panel && root && header) {
        // remember that we moved it
        if (!panel.dataset.wlOrigParent) panel.dataset.wlOrigParent = 'stage-panels-root';
        // insert after header so CSS selectors like #app-header + #stage-panel-0 apply
        document.body.insertBefore(panel, header.nextSibling);
      }
      const componentPath = managerState.current === 0 ? 'components/ModelSelection.html' : 'components/ModelSelection.html'; // Both use same component, filtered by data
      await loadComponent(`stage-${managerState.current}-placeholder`, componentPath);
      // Restore visual selections when entering model/design selection stage
      setTimeout(() => {
        try {
          if (managerState.current === 0) {
            modelsStageModule.restoreFromState && modelsStageModule.restoreFromState(appState);
          } else if (managerState.current === 1) {
            designsStageModule.restoreFromState && designsStageModule.restoreFromState(appState);
          }
        } catch (e) {
          console.warn('Failed to restore selections on stage change:', e);
        }
      }, 100); // Small delay to ensure DOM is ready
    } catch (e) {
      // ignore load errors
    }
  } else {
    // restore sidebar and viewer/chrome visibility
    if (sidebar) sidebar.style.display = '';
    if (viewer) viewer.style.display = '';
    if (viewerControls) viewerControls.style.display = '';
    // Clean up the stage placeholders to avoid duplicates
    try {
      for (let i = 0; i <= 1; i++) {
        const ph = document.getElementById(`stage-${i}-placeholder`);
        if (ph) ph.innerHTML = '';
        // If we previously moved stage panel out of the sidebar, put it back
        const panel = document.getElementById(`stage-panel-${i}`);
        const root = document.getElementById('stage-panels-root');
        if (panel && root && panel.dataset.wlOrigParent === 'stage-panels-root') {
          root.appendChild(panel);
          delete panel.dataset.wlOrigParent;
        }
      }
    } catch (e) {}
    // Restore UI for non-model stages
    try {
      const s = appState;
      if (managerState.current === 2) materialsStage.restoreFromState && materialsStage.restoreFromState(s);
      if (managerState.current === 3) finishStage.restoreFromState && finishStage.restoreFromState(s);
      if (managerState.current === 4) {
        // Load dimensions panel component if not already loaded
        const dimPh = document.getElementById('dimensions-panel-placeholder');
        if (dimPh && dimPh.innerHTML === '') {
          await loadComponent('dimensions-panel-placeholder', 'components/DimensionsPanel.html');
          // Initialize dimensions stage now that the panel is loaded
          if (dimensionsStage.init) await dimensionsStage.init();
        }
        dimensionsStage.restoreFromState && dimensionsStage.restoreFromState(s);
      }
      if (managerState.current === 5) legsStage.restoreFromState && legsStage.restoreFromState(s);
      if (managerState.current === 6) addonsStage.restoreFromState && addonsStage.restoreFromState(s);
      if (managerState.current === 7) summaryStage.restoreFromState && summaryStage.restoreFromState(s);
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

export function initStageManager() {
  // initial wiring
  wireStageButtons();
  // Initialize models and designs stage modules which wire option-card clicks
  try {
    initModelsStage();
  } catch (e) {
    console.warn('Failed to initialize models stage module', e);
  }
  try {
    initDesignsStage();
  } catch (e) {
    console.warn('Failed to initialize designs stage module', e);
  }
  // Initialize remaining stage modules
  try { initMaterialsStage(); } catch (e) { console.warn('Failed to init materials stage', e); }
  try { initFinishStage(); } catch (e) { console.warn('Failed to init finish stage', e); }
  try { dimensionsStage.init && dimensionsStage.init(); } catch (e) { /* ignore */ }
  try { legsStage.init && legsStage.init(); } catch (e) { /* ignore */ }
  try { addonsStage.init && addonsStage.init(); } catch (e) { /* ignore */ }
  try { summaryStage.init && summaryStage.init(); } catch (e) { /* ignore */ }
  // Mark Models stage completed when a model is selected
  document.addEventListener('option-selected', (ev) => {
    const { category } = ev.detail || {};
    // Models stage (index 0): mark complete when model is selected
    if (category === 'model') {
      markCompleted(0, true);
      // enable designs stage button
      const designBtn = document.querySelector(`#stage-bar .stage-btn[data-stage-index='1']`);
      if (designBtn) designBtn.disabled = false;
    }
    // Designs stage (index 1): mark complete when design is selected
    if (category === 'design') {
      markCompleted(1, true);
      // enable materials stage button
      const materialsBtn = document.querySelector(`#stage-bar .stage-btn[data-stage-index='2']`);
      if (materialsBtn) materialsBtn.disabled = false;
    }
    // For the Materials stage (index 2) require both material and color to
    // consider the stage complete. For other stages, marking on selection is fine.
    if (managerState.current === 2) {
      const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
      const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
      markCompleted(2, !!(hasMaterial && hasColor));
    } else if (managerState.current === 3) {
      // For Finish stage, require both a coating and a sheen to consider the stage complete.
      const hasCoating = !!(appState.selections && appState.selections.options && (appState.selections.options['finish-coating'] || appState.selections.options.coating));
      const hasSheen = !!(appState.selections && appState.selections.options && (appState.selections.options['finish-sheen'] || appState.selections.options.sheen));
      markCompleted(3, !!(hasCoating && hasSheen));
    } else if (managerState.current > 1 && category !== 'model' && category !== 'design') {
      // mark the active stage complete so Next becomes enabled (skip for model/design selections)
      markCompleted(managerState.current, true);
    }
    // run a UI update to refresh Next/Prev/button states
    setStage(managerState.current);
  });

  updateLivePrice();
  setStage(0);
}

// Use shared showBanner from ui/banner.js for consistent styling and accessibility.

// expose for debugging
window.__wlStage = { state: managerState, setStage, nextStage, prevStage, initStageManager };

export default { initStageManager, state: managerState, setStage };
