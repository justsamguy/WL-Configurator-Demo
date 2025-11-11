// Renders option-card buttons from a data array into a container element.
// data: array of { id, title, price, image, description, disabled, tooltip }
export function renderOptionCards(container, data = [], opts = {}) {
  if (!container) return;
  container.innerHTML = '';
  data.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'option-card';
    btn.setAttribute('data-id', item.id);
    if (opts.category) btn.setAttribute('data-category', opts.category);
    if (typeof item.price !== 'undefined') btn.setAttribute('data-price', String(item.price));
    btn.setAttribute('aria-pressed', 'false');
    if (item.disabled) {
      btn.setAttribute('disabled', 'true');
      if (item.tooltip) btn.setAttribute('data-tooltip', item.tooltip);
    }

    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.alt || item.title || 'placeholder';
      img.className = 'viewer-placeholder-img';
      btn.appendChild(img);
    }

    const titleRow = document.createElement('div');
    titleRow.className = 'title-price-row';
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = item.title || item.id;
    const p = document.createElement('div');
    p.className = 'price-delta';
    p.textContent = item.price ? `+$${item.price}` : '+$0';
    titleRow.appendChild(t);
    titleRow.appendChild(p);
    btn.appendChild(titleRow);

    if (item.description) {
      const d = document.createElement('div');
      d.className = 'description';
      d.textContent = item.description;
      btn.appendChild(d);
    }

    container.appendChild(btn);
  });
}

/**
 * Format price for display. Returns "+$X" for positive prices, "+$0" for zero, "TBD" for null/undefined.
 */
export function formatPrice(price) {
  if (price === null || price === undefined) return 'TBD';
  if (typeof price !== 'number') price = Number(price);
  return `+$${price}`;
}

/**
 * Update UI state for an option card (select/deselect visual state and aria).
 * @param {string} id - Data ID of the option card
 * @param {string} category - Data category (e.g., 'material', 'finish-coating', 'legs')
 * @param {boolean} selected - Whether to mark as selected
 */
export function updateOptionUI(id, category, selected) {
  const sel = `.option-card[data-id="${id}"][data-category="${category}"]`;
  const el = document.querySelector(sel);
  if (!el) return;
  el.setAttribute('aria-pressed', selected ? 'true' : 'false');
  el.classList.toggle('selected', selected);
  if (selected && el.getAttribute('role') === 'checkbox') {
    el.setAttribute('aria-checked', 'true');
  } else if (!selected && el.getAttribute('role') === 'checkbox') {
    el.setAttribute('aria-checked', 'false');
  }
}

/**
 * Setup delegated click handler on #stage-panels-root for all option-card clicks.
 * Dispatches 'option-selected' or 'addon-toggled' depending on role.
 */
export function initDelegatedClickHandler() {
  const root = document.getElementById('stage-panels-root');
  if (!root) return;

  root.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;

    const id = card.getAttribute('data-id');
    const category = card.getAttribute('data-category');
    const price = Number(card.getAttribute('data-price')) || 0;
    const isCheckbox = card.getAttribute('role') === 'checkbox';

    if (isCheckbox) {
      // addon toggle
      const was = card.getAttribute('aria-checked') === 'true';
      const now = !was;
      card.setAttribute('aria-checked', now ? 'true' : 'false');
      card.classList.toggle('selected', now);
      document.dispatchEvent(new CustomEvent('addon-toggled', { detail: { id, price, checked: now } }));
    } else {
      // single-choice option
      const catSelector = category ? `.option-card[data-category="${category}"]` : '.option-card[data-category="model"], .option-card:not([data-category])';
      document.querySelectorAll(catSelector).forEach(c => c.setAttribute('aria-pressed', 'false'));
      card.setAttribute('aria-pressed', 'true');
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: category || null } }));
    }
  });
}

/**
 * Restore focus to an element by data-id after re-render.
 * Useful for preserving keyboard navigation during re-renders.
 */
export function restoreFocus(container, dataId) {
  if (!container || !dataId) return;
  const el = container.querySelector(`[data-id="${dataId}"]`);
  if (el && typeof el.focus === 'function') {
    setTimeout(() => el.focus(), 0);
  }
}

export default { renderOptionCards, formatPrice, updateOptionUI, initDelegatedClickHandler, restoreFocus };
