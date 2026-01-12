// Summary tooltip module
// Shows a small tooltip/dialog listing current selections and price total.
import { state } from '../state.js';
import { computePrice } from '../pricing.js';

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
      <div class="tooltip-header">Selections affecting your price:</div>
      <div id="summary-tooltip-content" class="tooltip-content" aria-live="polite" aria-atomic="true"></div>
      <div class="tooltip-footer"><span>Total:</span><span id="summary-tooltip-total" class="summary-tooltip-total"></span></div>
    </div>
  `;
  document.body.appendChild(t);
  return t;
}

function formatCurrency(n) {
  return `$${(n || 0).toLocaleString()} USD`;
}

function formatCurrencyShort(n) {
  return `$${(n || 0).toLocaleString()}`;
}

function formatSigned(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '+';
  return `(${sign} ${formatCurrencyShort(Math.abs(v))})`;
}

function formatTypeLabel(type) {
  if (!type) return 'Item';
  return String(type)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function renderTooltip() {
  const tip = createTooltip();
  const content = document.getElementById('summary-tooltip-content');
  const total = document.getElementById('summary-tooltip-total');
  if (!content || !total) return;
  const s = state;

  // Use the centralized pricing module to compute an authoritative breakdown and total.
  let priceData;
  try {
    priceData = await computePrice(s);
  } catch (e) {
    console.warn('summaryTooltip: computePrice failed', e);
    priceData = { base: (s.pricing && s.pricing.base) || 0, extras: (s.pricing && s.pricing.extras) || 0, total: (s.pricing && s.pricing.total) || 0, breakdown: [] };
  }

  const rows = [];
  if (priceData.breakdown && priceData.breakdown.length) {
    priceData.breakdown.forEach(item => {
      const label = item.label || item.id || item.type || 'item';
      const price = Number(item.price) || 0;
      const hasPriceLabel = typeof item.priceLabel === 'string' && item.priceLabel.trim();
      if (!hasPriceLabel && price === 0) return;
      const priceText = hasPriceLabel ? item.priceLabel : formatSigned(price);
      // Show the base/design price as an absolute value, other items as signed additions.
      if (item.isBase || item.type === 'design') {
        const baseLabel = label || 'Base design';
        const baseText = hasPriceLabel ? item.priceLabel : formatCurrencyShort(price);
        rows.push(`
          <div class="summary-tooltip-row is-base">
            <span class="summary-tooltip-label"><span class="summary-tooltip-type">Base design:</span> ${baseLabel}</span>
            <span class="summary-tooltip-price">${baseText}</span>
          </div>
        `);
      } else {
        const typeLabel = formatTypeLabel(item.type);
        rows.push(`
          <div class="summary-tooltip-row">
            <span class="summary-tooltip-label"><span class="summary-tooltip-type">${typeLabel}:</span> ${label}</span>
            <span class="summary-tooltip-price">${priceText}</span>
          </div>
        `);
      }
    });
  }

  if (!rows.length) {
    content.innerHTML = '<div class="summary-tooltip-empty">No options selected</div>';
  } else {
    content.innerHTML = `<div class="summary-tooltip-lines">${rows.join('')}</div>`;
  }
  total.textContent = formatCurrency(priceData.total || 0);
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
