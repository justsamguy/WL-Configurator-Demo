// Finish stage specific logic: constraints and defaults
export function recomputeFinishConstraints() {
  try {
    const selectedCoatingEl = document.querySelector('.option-card[data-category="finish-coating"][aria-pressed="true"]');
    const selectedCoatingId = selectedCoatingEl && selectedCoatingEl.getAttribute('data-id');
    const selectedSheenEl = document.querySelector('.option-card[data-category="finish-sheen"][aria-pressed="true"]');
    const selectedSheenId = selectedSheenEl && selectedSheenEl.getAttribute('data-id');

    function _getDisabledByList(el) {
      const raw = el.getAttribute('data-disabled-by') || '';
      return raw ? raw.split('||').filter(Boolean) : [];
    }
    function addDisabledBy(el, sourceTitle) {
      if (!el) return;
      const title = (sourceTitle || '').trim();
      if (!title) return;
      const list = _getDisabledByList(el);
      if (!list.includes(title)) list.push(title);
      el.setAttribute('data-disabled-by', list.join('||'));
      el.setAttribute('disabled', 'true');
      el.setAttribute('data-tooltip', `Incompatible with ${list.join(', ')}`);
    }
    function clearAllDisabledBy(el) {
      if (!el) return;
      el.removeAttribute('data-disabled-by');
      el.removeAttribute('data-tooltip');
      el.removeAttribute('disabled');
    }

    // clear relevant previous flags
    ['fin-coat-02', 'fin-sheen-02', 'fin-sheen-03'].forEach((oid) => {
      const el = document.querySelector(`.option-card[data-id="${oid}"]`);
      if (el) clearAllDisabledBy(el);
    });

    if (selectedCoatingId === 'fin-coat-02') {
      const polyTitle = (selectedCoatingEl && selectedCoatingEl.querySelector('.title') && selectedCoatingEl.querySelector('.title').textContent.trim()) || '2K Poly';
      ['fin-sheen-02', 'fin-sheen-03'].forEach((sheenId) => {
        const el = document.querySelector(`.option-card[data-id="${sheenId}"]`);
        if (el) addDisabledBy(el, polyTitle);
      });
    } else if (selectedSheenId === 'fin-sheen-02' || selectedSheenId === 'fin-sheen-03') {
      const sheenTitle = (selectedSheenEl && selectedSheenEl.querySelector('.title') && selectedSheenEl.querySelector('.title').textContent.trim()) || 'selected sheen';
      const poly = document.querySelector(`.option-card[data-id="fin-coat-02"]`);
      if (poly) addDisabledBy(poly, sheenTitle);
    }
  } catch (e) {
    console.warn('Failed to recompute finish constraints:', e);
  }
}

// applyFinishDefaults: ensure sensible defaults for the Finish stage.
// IMPORTANT: This function must NOT mutate global app state directly. It
// dispatches `option-selected` events for defaults; `js/main.js` is the
// canonical mutator and will update shared state when those events are received.
export function applyFinishDefaults(appState) {
  try {
    const coatingSel = appState.selections.options && appState.selections.options['finish-coating'];
    const sheenSel = appState.selections.options && appState.selections.options['finish-sheen'];
    const updates = {};
    if (!coatingSel) {
      updates['finish-coating'] = 'fin-coat-02';
      const el = document.querySelector('.option-card[data-id="fin-coat-02"]');
      if (el) el.setAttribute('aria-pressed', 'true');
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id: 'fin-coat-02', price: Number(el ? el.getAttribute('data-price') : 0), category: 'finish-coating' } }));
    }
    if (!sheenSel) {
      updates['finish-sheen'] = 'fin-sheen-01';
      const el2 = document.querySelector('.option-card[data-id="fin-sheen-01"]');
      if (el2) el2.setAttribute('aria-pressed', 'true');
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id: 'fin-sheen-01', price: Number(el2 ? el2.getAttribute('data-price') : 0), category: 'finish-sheen' } }));
    }
    if (Object.keys(updates).length) {
      // Do not mutate app state here. dispatches above will be handled by main.js
      try { recomputeFinishConstraints(); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.warn('applyFinishDefaults failed', e);
  }
}

export function init() {
  // Wire clicks for coatings and sheens to emit option-selected events (placeholders.js handles generic logic too)
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-category="finish-coating"], .option-card[data-category="finish-sheen"]');
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

export function restoreFromState(state) {
  try {
    const opts = state && state.selections && state.selections.options ? state.selections.options : {};
    ['finish-coating', 'finish-sheen'].forEach(cat => {
      const id = opts[cat];
      if (!id) return;
      const el = document.querySelector(`.option-card[data-id="${id}"]`);
      if (el) {
        document.querySelectorAll(`.option-card[data-category="${cat}"]`).forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    });
    try { recomputeFinishConstraints(); } catch (e) { /* ignore constraint update */ }
  } catch (e) { /* ignore */ }
}

export default { recomputeFinishConstraints, applyFinishDefaults, init, restoreFromState };
