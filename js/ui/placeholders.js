// UI helpers for placeholder option cards: click handlers, price animation, and loading skeleton
// No imports here to avoid circular module dependency with main.js

// Simple price animation helper: counts to target in duration ms
function animatePrice(from, to, duration = 400, onUpdate) {
  const start = performance.now();
  const delta = to - from;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad-like
    const value = Math.round(from + delta * eased);
    onUpdate(value);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

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

    // Restore other single-choice selections
    Object.entries(state.selections.options || {}).forEach(([category, id]) => {
      if (category !== 'addon' && id) {
        // Clear previous selections in this category
        document.querySelectorAll(`.option-card[data-id^="${category === 'material' ? 'mat-' :
                                                         category === 'finish' ? 'fin-' :
                                                         category === 'dimensions' ? 'dim-' :
                                                         category === 'legs' ? 'leg-' : ''}"]`).forEach((el) => {
          el.setAttribute('aria-pressed', 'false');
        });
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
    const category = btn.getAttribute('data-category') || null;

    // For single-choice categories (default), clear previous selection in the same category
    if (category && category !== 'addon') {
      document.querySelectorAll(`.option-card[data-category="${category}"]`).forEach((el) => {
        el.setAttribute('aria-pressed', 'false');
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
      // Determine the implicit category based on the data-id prefix
      let implicitCategory = '';
      if (id) {
        if (id.startsWith('mdl-')) {
          implicitCategory = 'model';
        } else if (id.startsWith('mat-')) {
          implicitCategory = 'material';
        } else if (id.startsWith('fin-')) {
          implicitCategory = 'finish';
        } else if (id.startsWith('dim-')) {
          implicitCategory = 'dimensions';
        } else if (id.startsWith('leg-')) {
          implicitCategory = 'legs';
        }
      }

      // Clear previous selections in the same implicit category, but preserve model selection
      if (implicitCategory) {
        document.querySelectorAll(`.option-card[data-id^="${implicitCategory === 'model' ? 'mdl-' :
                                                   implicitCategory === 'material' ? 'mat-' :
                                                   implicitCategory === 'finish' ? 'fin-' :
                                                   implicitCategory === 'dimensions' ? 'dim-' :
                                                   implicitCategory === 'legs' ? 'leg-' : ''}"]`).forEach((el) => {
          if (el !== btn) { // Don't clear the button we're clicking
            el.setAttribute('aria-pressed', 'false');
          }
        });
      } else {
        // Fallback: clear all non-model selections if we can't determine the category
        document.querySelectorAll('.option-card[aria-pressed="true"]:not([data-id^="mdl-"])').forEach((el) => {
          el.setAttribute('aria-pressed', 'false');
        });
      }

      btn.setAttribute('aria-pressed', 'true');
      // Dispatch a selection event that main.js will handle (update state, price)
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category } }));
    }

    // show skeleton to mimic viewer re-render
    showSkeleton(700);
  });
}
