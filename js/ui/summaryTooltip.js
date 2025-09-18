// Summary tooltip module
// Shows a small tooltip/dialog listing current selections and price total.
import { state } from '../state.js';

function createTooltip() {
  let t = document.getElementById('summary-tooltip');
  if (t) return t;
  t = document.createElement('div');
  t.id = 'summary-tooltip';
  t.setAttribute('role', 'dialog');
  t.setAttribute('aria-modal', 'false');
  t.className = 'summary-tooltip hidden';
  t.innerHTML = `
    <div class="tooltip-inner">
      <div class="tooltip-header text-sm font-semibold">Current selections</div>
      <div id="summary-tooltip-content" class="tooltip-content text-sm text-gray-700" aria-live="polite"></div>
      <div class="tooltip-footer text-sm font-medium text-right mt-2">Total: <span id="summary-tooltip-total"></span></div>
    </div>
  `;
  document.body.appendChild(t);
  return t;
}

function formatCurrency(n) {
  return `$${(n || 0).toLocaleString()} USD`;
}

function renderTooltip() {
  const tip = createTooltip();
  const content = document.getElementById('summary-tooltip-content');
  const total = document.getElementById('summary-tooltip-total');
  if (!content || !total) return;
  // Build lines for model and each option (including 0-cost items)
  const lines = [];
  const s = state;
  if (s.selections && s.selections.model) lines.push(`<div><strong>Model:</strong> ${s.selections.model}</div>`);
  const opts = s.selections && s.selections.options ? s.selections.options : {};
  // ensure ordering: material, finish, dimensions, legs, addon
  const keys = Object.keys(opts);
  if (keys.length === 0) {
    lines.push('<div class="text-gray-600">No options selected</div>');
  } else {
    keys.forEach(k => {
      const v = opts[k];
      if (Array.isArray(v)) {
        if (v.length === 0) lines.push(`<div><strong>${k}:</strong> none</div>`);
        else lines.push(`<div><strong>${k}:</strong> ${v.join(', ')}</div>`);
      } else {
        lines.push(`<div><strong>${k}:</strong> ${v || 'none'}</div>`);
      }
    });
  }
  content.innerHTML = lines.join('');
  total.textContent = formatCurrency(s.pricing && s.pricing.total ? s.pricing.total : s.pricing.base);
}

let anchorButton = null;

function positionTooltip() {
  const tip = document.getElementById('summary-tooltip');
  if (!tip || !anchorButton) return;
  const rect = anchorButton.getBoundingClientRect();
  // place tooltip relative to the viewport (fixed positioning)
  // default: below the button with a small offset, aligned so the tooltip's right edge
  // matches the button's right edge. Clamp to viewport so it isn't pushed off-screen.
  const offset = 8;
  const top = rect.bottom + offset; // viewport coordinates
  let left = rect.right - tip.offsetWidth;
  // clamp left within viewport with an 8px margin
  left = Math.max(8, Math.min(left, window.innerWidth - tip.offsetWidth - 8));
  // if there's not enough space below (near bottom of viewport) place above
  const willOverflowBottom = top + tip.offsetHeight > window.innerHeight - 8;
  tip.style.top = `${willOverflowBottom ? Math.max(8, rect.top - tip.offsetHeight - offset) : top}px`;
  tip.style.left = `${left}px`;
}

function showTooltip() {
  renderTooltip();
  const tip = createTooltip();
  tip.classList.remove('hidden');
  tip.classList.add('visible');
  document.getElementById('summary-btn')?.setAttribute('aria-expanded', 'true');
  positionTooltip();
}

function hideTooltip() {
  const tip = document.getElementById('summary-tooltip');
  if (!tip) return;
  tip.classList.remove('visible');
  tip.classList.add('hidden');
  document.getElementById('summary-btn')?.setAttribute('aria-expanded', 'false');
}

export function initSummaryTooltip(buttonEl) {
  anchorButton = buttonEl;
  if (!anchorButton) return;
  // Click toggles tooltip
  anchorButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const tip = document.getElementById('summary-tooltip');
    if (tip && tip.classList.contains('visible')) hideTooltip();
    else showTooltip();
  });
  // Close on outside click
  document.addEventListener('click', (e) => {
    const tip = document.getElementById('summary-tooltip');
    if (!tip || tip.classList.contains('hidden')) return;
    if (e.target === anchorButton || anchorButton.contains(e.target)) return;
    if (tip.contains(e.target)) return;
    hideTooltip();
  });
  // Reposition on resize/scroll
  window.addEventListener('resize', positionTooltip);
  window.addEventListener('scroll', positionTooltip, true);
  // Update contents when state changes (listeners rely on global state events)
  document.addEventListener('statechange', () => renderTooltip());
}

// export helper to allow manual render or show
export default { initSummaryTooltip, showTooltip, hideTooltip, renderTooltip };
