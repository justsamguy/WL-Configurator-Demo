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

// Wire click handlers for any .option-card elements
export function initPlaceholderInteractions() {
  // Delegate clicks from the sidebar container
  const sidebar = document.getElementById('app-sidebar') || document.body;
  sidebar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.option-card');
    if (!btn) return;
    if (btn.hasAttribute('disabled')) return;

    // read price from data-price (fallback to 0)
    const priceAttr = btn.getAttribute('data-price') || '0';
    const price = parseInt(priceAttr, 10) || 0;
    const id = btn.getAttribute('data-id') || null;

  // Dispatch a selection event that main.js will handle (update state, price)
  document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price } }));

    // visually mark selected
    document.querySelectorAll('.option-card[aria-pressed="true"]').forEach((el) => el.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');

  // show skeleton to mimic viewer re-render
  showSkeleton(700);
  });
}
