import { createLogger } from '../logger.js';

const log = createLogger('Finish');

// Finish stage specific logic: constraints and defaults
let lastKnownModel = null; // Track the model to detect changes

export function recomputeFinishConstraints() {
  // No constraints between coating and sheen - all combinations allowed
  // This function is kept for compatibility but no longer does anything
}

// applyFinishDefaults: ensure sensible defaults for the Finish stage.
// IMPORTANT: This function must NOT mutate global app state directly. It
// dispatches `option-selected` events for defaults; `js/main.js` is the
// canonical mutator and will update shared state when those events are received.
export function applyFinishDefaults(appState) {
  try {
    const coatingSel = appState.selections.options && appState.selections.options['finish-coating'];
    const sheenSel = appState.selections.options && appState.selections.options['finish-sheen'];
    const tintSel = appState.selections.options && appState.selections.options['finish-tint'];
    const updates = {};
    if (!coatingSel) {
      updates['finish-coating'] = 'fin-coat-02';
      const el = document.querySelector('.option-card[data-id="fin-coat-02"]');
      if (el) el.setAttribute('aria-pressed', 'true');
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id: 'fin-coat-02', price: Number(el ? el.getAttribute('data-price') : 0), category: 'finish-coating' } }));
    }
    if (!sheenSel) {
      updates['finish-sheen'] = 'fin-sheen-02';
      // No visual element to set for slider, just dispatch the event
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id: 'fin-sheen-02', price: 0, category: 'finish-sheen' } }));
    }
    if (!tintSel) {
      updates['finish-tint'] = 'fin-tint-01';
      const el3 = document.querySelector('.option-card[data-id="fin-tint-01"]');
      if (el3) el3.setAttribute('aria-pressed', 'true');
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id: 'fin-tint-01', price: Number(el3 ? el3.getAttribute('data-price') : 0), category: 'finish-tint' } }));
    }
    if (Object.keys(updates).length) {
      // Do not mutate app state here. dispatches above will be handled by main.js
      try { recomputeFinishConstraints(); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    log.warn('applyFinishDefaults failed', e);
  }
}

export function init() {
  // Wire clicks for coatings, sheens, and tints to emit option-selected events (placeholders.js handles generic logic too)
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-category="finish-coating"], .option-card[data-category="finish-sheen"], .option-card[data-category="finish-tint"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    const category = card.getAttribute('data-category');
    const id = card.getAttribute('data-id');
    const price = Number(card.getAttribute('data-price')) || 0;
    // set visual pressed
    if (category) {
      document.querySelectorAll(`.option-card[data-category="${category}"]`).forEach(c => c.setAttribute('aria-pressed', 'false'));
      card.setAttribute('aria-pressed', 'true');
    }
    document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category } }));
    try { recomputeFinishConstraints(); } catch (e) { /* ignore */ }
  });
}

export function restoreFromState(appState) {
  try {
    const opts = appState && appState.selections && appState.selections.options ? appState.selections.options : {};
    
    // Restore coating and tint selections (option cards)
    ['finish-coating', 'finish-tint'].forEach(cat => {
      const id = opts[cat];
      if (!id) return;
      const el = document.querySelector(`.option-card[data-id="${id}"]`);
      if (el) {
        document.querySelectorAll(`.option-card[data-category="${cat}"]`).forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    });

    // Handle sheen tiles
    const sheenId = opts['finish-sheen'];
    if (sheenId) {
      const tiles = document.querySelectorAll('.sheen-tile');
      const sheenRoot = document.getElementById('finish-sheen-slider');

      const sheenMap = {
        'fin-sheen-01': 0, // Matte
        'fin-sheen-02': 1, // Satin
        'fin-sheen-03': 2  // Gloss
      };

      const value = sheenMap[sheenId];
      if (value !== undefined) {
        const sheenSetter = sheenRoot && sheenRoot.__setSheenIndex;
        if (sheenSetter) {
          sheenSetter(value, { dispatch: false });
        } else {
          tiles.forEach((tile, index) => {
            const isSelected = index === value;
            tile.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            tile.classList.toggle('selected', isSelected);
          });
        }
      }
    }
  } catch (e) { /* ignore */ }
}

export default { recomputeFinishConstraints, applyFinishDefaults, init, restoreFromState };
