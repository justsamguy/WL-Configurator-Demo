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

const state = {
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
  elAmount.textContent = formatPrice(state.config.price || 0);
}

async function setStage(index, options = {}) {
  // options: { allowSkip: boolean }
  if (index < 0 || index >= STAGES.length) return;
  // gating: normally prevent jumping forward past first incomplete required stage (model required)
  // but callers can pass { allowSkip: true } to bypass the gating (used by Next button)
  if (index > state.current && !options.allowSkip) {
    // require model selected to advance beyond 0
    if (!state.config.model) {
      // keep at current, optionally show a small banner (omitted here)
      return;
    }
  }

  state.current = index;
  // update buttons
  $all('#stage-bar .stage-btn').forEach(btn => {
    const idx = Number(btn.getAttribute('data-stage-index'));
    if (idx === state.current) {
      btn.setAttribute('aria-current', 'step');
      btn.disabled = false;
    } else {
      btn.removeAttribute('aria-current');
      // keep buttons enabled if they've been completed, otherwise follow gating
      btn.disabled = !(state.completed[idx] || idx <= state.current + 1);
    }
  });

  // Prev/Next
  const prev = $('#prev-stage');
  const next = $('#next-stage');
  if (prev) {
    prev.disabled = state.current === 0;
    prev.classList.toggle('opacity-40', prev.disabled);
  }
  if (next) {
    // Only disable Next when we're at the last stage. Allow the right-side Next button
    // to navigate forward even if the current stage hasn't been marked completed.
    const atLast = state.current === STAGES.length - 1;
    next.disabled = atLast;
    next.classList.toggle('opacity-40', next.disabled);
  }

  // show/hide stage content panels if present (convention: panels use id stage-panel-<index>)
  $all('[id^="stage-panel-"]').forEach(panel => {
    const idx = Number(panel.id.replace('stage-panel-', ''));
    panel.style.display = idx === state.current ? '' : 'none';
  });

  // Sidebar no longer contains a model selection placeholder; model tiles are loaded
  // directly into the main stage panel when stage 0 is active.

  // Add a body-level class so CSS can easily show/hide model tiles across the app.
  // When not on the Select Model stage, model tiles are hidden by default.
  try {
    document.body.classList.toggle('show-model-tiles', state.current === 0);
  } catch (e) {
    // document.body might not be available in some test contexts; ignore.
  }

  // Show only the sidebar info section that corresponds to the active stage (if present)
  try {
    const infos = document.querySelectorAll('#sidebar-info-root .sidebar-info');
    infos.forEach(sec => { sec.style.display = 'none'; });
    const active = document.getElementById(`info-stage-${state.current}`);
    if (active) active.style.display = '';
  } catch (e) {
    // ignore if sidebar info root not present
  }

  // Special case: Select Model stage should be full-width and not show the sidebar.
  // Move the stage-panel-0 into the main area and hide the sidebar while on stage 0.
  const sidebar = document.getElementById('app-sidebar');
  const main = document.getElementById('app-main');
  const panel0 = document.getElementById('stage-panel-0');
  if (state.current === 0) {
    if (sidebar) sidebar.style.display = 'none';
    if (panel0 && main) {
      // remember original parent so we can restore later
      if (!panel0.__originalParent) panel0.__originalParent = panel0.parentElement;
      // move the panel into main if it's not already there
      if (panel0.parentElement !== main) {
        panel0.style.display = '';
        main.insertBefore(panel0, main.firstChild);
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
  // Advance to the next stage. Use allowSkip so the button can navigate forward even
  // if the current stage hasn't been marked completed. This provides the expected
  // "Next" navigation behavior while keeping click-to-stage gating intact.
  setStage(Math.min(state.current + 1, STAGES.length - 1), { allowSkip: true });
}

function prevStage() {
  setStage(Math.max(state.current - 1, 0));
}

function markCompleted(index, completed = true) {
  if (index < 0 || index >= STAGES.length) return;
  state.completed[index] = completed;
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
    state.config.model = id;
    state.config.price = price;
    markCompleted(0, true);
    updateLivePrice();
    // enable material stage button
    const materialBtn = document.querySelector(`#stage-bar .stage-btn[data-stage-index='1']`);
    if (materialBtn) materialBtn.disabled = false;
    // automatically advance one stage for a smoother flow
    setTimeout(() => setStage(1), 220);
    // If a viewer API exists, call it to load model
    if (window.viewerLoadModel) {
      window.viewerLoadModel(id).catch?.(err => console.warn('viewerLoadModel failed', err));
    }
  });
}

export function initStageManager() {
  // initial wiring
  wireStageButtons();
  wireModelSelection();
  updateLivePrice();
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
window.__wlStage = { state, setStage, nextStage, prevStage, initStageManager };

export default { initStageManager, state, setStage };
