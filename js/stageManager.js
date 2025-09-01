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

function setStage(index) {
  if (index < 0 || index >= STAGES.length) return;
  // gating: cannot jump forward past first incomplete required stage (model required)
  if (index > state.current) {
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
    next.disabled = state.current === STAGES.length - 1;
    next.classList.toggle('opacity-40', next.disabled);
  }

  // show/hide stage content panels if present (convention: panels use id stage-panel-<index>)
  $all('[id^="stage-panel-"]').forEach(panel => {
    const idx = Number(panel.id.replace('stage-panel-', ''));
    panel.style.display = idx === state.current ? '' : 'none';
  });
}

function nextStage() {
  setStage(Math.min(state.current + 1, STAGES.length - 1));
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
  // model option cards have class .option-card and data-id and data-price
  $all('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      // mark selected state
      $all('.option-card').forEach(c => c.setAttribute('aria-pressed', 'false'));
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
      // If a viewer API exists, call it to load model (viewer.js should expose window.viewerLoadModel)
      if (window.viewerLoadModel) {
        window.viewerLoadModel(id).catch?.(err => console.warn('viewerLoadModel failed', err));
      }
    });
  });
}

export function initStageManager() {
  // initial wiring
  wireStageButtons();
  wireModelSelection();
  updateLivePrice();
  setStage(0);
}

// expose for debugging
window.__wlStage = { state, setStage, nextStage, prevStage, initStageManager };

export default { initStageManager, state, setStage };
