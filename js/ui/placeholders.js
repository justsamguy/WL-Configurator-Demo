// UI helpers for placeholder option cards: click handlers, price animation, and loading skeleton
// No imports here to avoid circular module dependency with main.js

// Update the price UI in the sidebar
function updatePriceUI(total) {
  const el = document.getElementById('price-bar');
  if (!el) return;
  el.textContent = `$${total.toLocaleString()} `;
  const usd = document.createElement('span');
  usd.className = 'text-xs font-normal';
  usd.textContent = 'USD';
  el.appendChild(usd);
}

// Create a full-screen loading skeleton over the viewer area
function showSkeleton(timeout = 700) {
  let sk = document.getElementById('viewer-skeleton-overlay');
  if (!sk) {
    sk = document.createElement('div');
    sk.id = 'viewer-skeleton-overlay';
    sk.className = 'viewer-skeleton fixed inset-0 flex items-center justify-center z-40 pointer-events-none';
    sk.innerHTML = `
      <div class="skeleton-card w-[640px] h-[360px] bg-gray-100 rounded shadow-inner animate-pulse"></div>
    `;
    document.body.appendChild(sk);
  }
  sk.style.opacity = '1';
  clearTimeout(sk._hideTimeout);
  sk._hideTimeout = setTimeout(() => {
    sk.style.opacity = '0';
    // remove after transition
    setTimeout(() => sk.remove(), 300);
  }, timeout);
}

// Helpers to manage multiple incompatibility sources per tile.
// We store a simple separator-delimited list in `data-disabled-by` and
// keep a human-readable tooltip in `data-tooltip` for the CSS to show.
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

function removeDisabledBy(el, sourceTitle) {
  if (!el) return;
  const title = (sourceTitle || '').trim();
  if (!title) return;
  const list = _getDisabledByList(el).filter((t) => t !== title);
  if (list.length) {
    el.setAttribute('data-disabled-by', list.join('||'));
    el.setAttribute('data-tooltip', `Incompatible with ${list.join(', ')}`);
    el.setAttribute('disabled', 'true');
  } else {
    el.removeAttribute('data-disabled-by');
    el.removeAttribute('data-tooltip');
    el.removeAttribute('disabled');
  }
}

function clearAllDisabledBy(el) {
  if (!el) return;
  el.removeAttribute('data-disabled-by');
  el.removeAttribute('data-tooltip');
  el.removeAttribute('disabled');
}

// Recompute and apply finish incompatibility constraints deterministically.
// re-export the finish-specific rules from the dedicated stage module so callers
// can import from this UI module for compatibility while the implementation lives
// in `js/stages/finish.js`.
import { recomputeFinishConstraints } from '../stages/finish.js';
export { recomputeFinishConstraints };

// Restore visual selection state from the app state
function restoreVisualSelections() {
  // Import state dynamically to avoid circular dependency
  import('../state.js').then(({ state }) => {
    // Restore model selection
    if (state.selections.model) {
      // Clear all model selections first
      document.querySelectorAll('.option-card[data-id^="mdl-"]').forEach((el) => {
        el.setAttribute('aria-pressed', 'false');
      });
      // Set the selected model
      const selectedModel = document.querySelector(`.option-card[data-id="${state.selections.model}"]`);
      if (selectedModel) {
        selectedModel.setAttribute('aria-pressed', 'true');
      }
    }

    // Restore other single-choice selections. We expect stored keys to map to data-category values
    Object.entries(state.selections.options || {}).forEach(([category, id]) => {
      if (category !== 'addon' && id) {
        // If DOM elements use data-category attributes, prefer clearing by that attribute
        const byCategoryAttr = document.querySelectorAll(`.option-card[data-category="${category}"]`);
        if (byCategoryAttr && byCategoryAttr.length) {
          byCategoryAttr.forEach((el) => el.setAttribute('aria-pressed', 'false'));
        } else {
          // Fallback to matching id prefixes used previously
          document.querySelectorAll(`.option-card[data-id^="${category === 'material' ? 'mat-' :
                                                         category === 'finish' ? 'fin-' :
                                                         category === 'dimensions' ? 'dim-' :
                                                         category === 'legs' ? 'leg-' : ''}"]`).forEach((el) => {
            el.setAttribute('aria-pressed', 'false');
          });
        }
        // Set the selected option
        const selectedOption = document.querySelector(`.option-card[data-id="${id}"]`);
        if (selectedOption) {
          selectedOption.setAttribute('aria-pressed', 'true');
        }
      }
    });

    // Restore addon selections (multi-select)
    const selectedAddons = state.selections.options?.addon || [];
    document.querySelectorAll('.option-card[data-category="addon"]').forEach((el) => {
      const id = el.getAttribute('data-id');
      const isSelected = selectedAddons.includes(id);
      el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      el.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  }).catch((e) => {
    console.warn('Failed to restore visual selections:', e);
  });
}

// Wire click handlers for any .option-card elements
export function initPlaceholderInteractions() {
  // Restore visual selections on initialization
  restoreVisualSelections();

  // Listen for state changes to update visual selections
  document.addEventListener('statechange', () => {
    restoreVisualSelections();
  });

  // Delegate clicks from the document so option-cards in stage panels are also handled
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.option-card');
    if (!btn) return;
    if (btn.hasAttribute('disabled')) return;

    // read price from data-price (fallback to 0)
  const priceAttr = btn.getAttribute('data-price') || '0';
  const price = parseInt(priceAttr, 10) || 0;
  const id = btn.getAttribute('data-id') || null;
  // allow explicit data-category; this project uses more explicit categories for finishes
  let category = btn.getAttribute('data-category') || null;

    // For single-choice categories (default), clear previous selection in the same category
    if (category && category !== 'addon') {
      document.querySelectorAll(`.option-card[data-category="${category}"]`).forEach((el) => {
        if (el !== btn) el.setAttribute('aria-pressed', 'false');
        if (el.hasAttribute('role') && el.getAttribute('role') === 'checkbox') el.setAttribute('aria-checked', 'false');
      });
    }

    // Toggle behavior for addons (multi-select checkboxes)
    if (category === 'addon') {
      const wasPressed = btn.getAttribute('aria-pressed') === 'true';
      const nowPressed = !wasPressed;
      btn.setAttribute('aria-pressed', nowPressed ? 'true' : 'false');
      btn.setAttribute('aria-checked', nowPressed ? 'true' : 'false');
      // Dispatch an addon-toggled event
      document.dispatchEvent(new CustomEvent('addon-toggled', { detail: { id, price, checked: nowPressed } }));
    } else {
      // Default: single-select behavior - only clear selections within the same implicit category
      // Determine implicit category from id prefix if explicit category wasn't provided
      let implicitCategory = '';
      if (!category && id) {
        if (id.startsWith('mdl-')) implicitCategory = 'model';
        else if (id.startsWith('mat-')) implicitCategory = 'material';
        else if (id.startsWith('fin-coat-')) implicitCategory = 'finish-coating';
        else if (id.startsWith('fin-sheen-')) implicitCategory = 'finish-sheen';
        else if (id.startsWith('dim-')) implicitCategory = 'dimensions';
        else if (id.startsWith('leg-')) implicitCategory = 'legs';
      }

      const categoryToClear = category || implicitCategory || null;
      if (categoryToClear) {
        document.querySelectorAll(`.option-card[data-category="${categoryToClear}"]`).forEach((el) => {
          if (el !== btn) el.setAttribute('aria-pressed', 'false');
        });
      } else {
        // Fallback: clear all non-model selections if we can't determine the category
        document.querySelectorAll('.option-card[aria-pressed="true"]:not([data-id^="mdl-"])').forEach((el) => {
          el.setAttribute('aria-pressed', 'false');
        });
      }

      btn.setAttribute('aria-pressed', 'true');
      // If no explicit data-category was provided, use the inferred implicitCategory
      const dispatchCategory = category || implicitCategory || null;

      // Recompute finish incompatibility state deterministically (shared helper).
      try { recomputeFinishConstraints(); } catch (e) { /* ignore */ }

      // Dispatch a selection event that main.js will handle (update state, price)
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: dispatchCategory } }));
    }

    // show skeleton to mimic viewer re-render
    showSkeleton(700);
  });

  // Create a single floating tooltip element for disabled tiles to avoid clipping
  let _floatingTooltip = document.getElementById('inline-disabled-tooltip');
  if (!_floatingTooltip) {
    _floatingTooltip = document.createElement('div');
    _floatingTooltip.id = 'inline-disabled-tooltip';
    _floatingTooltip.className = 'inline-disabled-tooltip';
    document.body.appendChild(_floatingTooltip);
  }

  // Helper to position and show the floating tooltip above an element
  function showFloatingTooltipFor(el) {
    if (!el) return;
    const tip = _floatingTooltip;
    const txt = el.getAttribute('data-tooltip') || el.getAttribute('data-disabled-by') || '';
    if (!txt) return;
    tip.textContent = txt;
    const rect = el.getBoundingClientRect();
    // position centered horizontally above the element
    const left = rect.left + rect.width / 2;
    const top = rect.top - 8; // small gap
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.transform = 'translate(-50%, -100%)';
    tip.classList.add('visible');
  }

  function hideFloatingTooltip() {
    _floatingTooltip.classList.remove('visible');
  }

  // Use event delegation to show tooltips for disabled option-cards on pointerenter/leave
  document.addEventListener('pointerenter', (ev) => {
    const el = ev.target.closest && ev.target.closest('.option-card');
    if (!el) return;
    if (!el.hasAttribute('disabled')) return;
    // prefer human-friendly data-tooltip; fallback to data-disabled-by which contains the list
    const tooltipText = el.getAttribute('data-tooltip') || (el.getAttribute('data-disabled-by') || '').split('||').join(', ');
    if (!tooltipText) return;
    // set content and show
    _floatingTooltip.textContent = tooltipText;
    const rect = el.getBoundingClientRect();
    const left = rect.left + rect.width / 2;
    const top = rect.top - 8;
    _floatingTooltip.style.left = `${left}px`;
    _floatingTooltip.style.top = `${top}px`;
    _floatingTooltip.style.transform = 'translate(-50%, -100%)';
    _floatingTooltip.classList.add('visible');
  }, true);

  document.addEventListener('pointerleave', (ev) => {
    const el = ev.target.closest && ev.target.closest('.option-card');
    if (!el) return;
    if (!el.hasAttribute('disabled')) return;
    hideFloatingTooltip();
  }, true);
}
