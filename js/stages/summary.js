import { state } from '../state.js';
import { setState } from '../state.js';

// html2canvas and jsPDF are available globally via CDN in index.html
const hasHtml2Canvas = typeof html2canvas !== 'undefined';
const hasJsPDF = typeof window.jspdf !== 'undefined' || typeof window.jspdf !== 'undefined';

export function populateSummaryPanel() {
  const modelName = document.getElementById('summary-model-name');
  const modelPrice = document.getElementById('summary-model-price');
  const customOptions = document.getElementById('summary-custom-options');
  const total = document.getElementById('summary-total-price');
  if (!modelName || !modelPrice || !customOptions || !total) return;
  const s = state;
  modelName.textContent = s.selections && s.selections.model ? s.selections.model : 'none';
  modelPrice.textContent = s.pricing && typeof s.pricing.base === 'number' ? `$${s.pricing.base}` : '$0';
  // Build options list
  const opts = s.selections && s.selections.options ? s.selections.options : {};
  const keys = Object.keys(opts).filter(k => k && k.toLowerCase() !== 'model');
  if (!keys.length) customOptions.innerHTML = '<div class="text-gray-600">No options selected</div>';
  else {
    const lines = keys.map(k => {
      const v = opts[k];
      if (Array.isArray(v)) {
        const labels = v.join(', ');
        return `<div class="flex justify-between items-center"><span><strong>${k}:</strong> ${labels}</span></div>`;
      }
      return `<div class="flex justify-between items-center"><span><strong>${k}:</strong> ${v}</span></div>`;
    });
    customOptions.innerHTML = lines.join('');
  }
  total.textContent = s.pricing && s.pricing.total ? `$${s.pricing.total}` : '$0';
}

export default { populateSummaryPanel };

function formatCurrency(val) {
  if (typeof val !== 'number') return '$0';
  return `$${val.toLocaleString()}`;
}

async function captureSnapshot() {
  const container = document.getElementById('snapshot-container');
  const imgEl = document.getElementById('snapshot-img');
  const placeholder = document.getElementById('snapshot-placeholder');
  if (!container || !imgEl || !hasHtml2Canvas) return null;
  try {
    const canvas = await html2canvas(container, { backgroundColor: null, scale: 1 });
    const dataUrl = canvas.toDataURL('image/png');
    imgEl.src = dataUrl;
    imgEl.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
    return dataUrl;
  } catch (e) {
    console.warn('Snapshot failed', e);
    return null;
  }
}

async function exportPdf() {
  // Capture snapshot first then write a simple pdf with image + summary text
  if (!hasJsPDF || !hasHtml2Canvas) {
    console.warn('jsPDF or html2canvas not available');
    return;
  }
  const dataUrl = await captureSnapshot();
  if (!dataUrl) return;
  try {
    const { jsPDF } = window.jspdf || window.jspdf || {};
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    // Add image (fit to page width)
    const imgProps = doc.getImageProperties(dataUrl);
    const pageWidth = doc.internal.pageSize.getWidth();
    const ratio = imgProps.width / imgProps.height;
    const imgWidth = pageWidth - 80;
    const imgHeight = imgWidth / ratio;
    doc.addImage(dataUrl, 'PNG', 40, 40, imgWidth, imgHeight);
    // Add brief summary text below
    const total = state.pricing && state.pricing.total ? formatCurrency(state.pricing.total) : '$0';
    doc.setFontSize(12);
    doc.text(`Total: ${total}`, 40, 60 + imgHeight);
    doc.save('woodlab-summary.pdf');
  } catch (e) {
    console.warn('Failed to export PDF', e);
  }
}

function restartConfig() {
  // Reset selections/pricing to initial shape and dispatch state change
  setState({ selections: { model: null, options: {} }, pricing: { base: 0, extras: 0, total: 0 } });
  // If a stage manager exists, try to navigate to stage 0
  try {
    const stageManager = window.stageManager || null;
    if (stageManager && typeof stageManager.setStage === 'function') {
      stageManager.setStage(0);
    } else {
      // Fallback: try to dispatch a custom event listeners (stageManager.initStageManager sets this up)
      const ev = new CustomEvent('request-stage-change', { detail: { index: 0 } });
      document.dispatchEvent(ev);
    }
  } catch (e) { /* ignore */ }
}

export function initSummaryActions() {
  const cap = document.getElementById('capture-snapshot');
  const exp = document.getElementById('export-pdf');
  const rst = document.getElementById('restart-config');
  if (cap) cap.addEventListener('click', async (ev) => { ev.preventDefault(); await captureSnapshot(); });
  if (exp) exp.addEventListener('click', async (ev) => { ev.preventDefault(); await exportPdf(); });
  if (rst) rst.addEventListener('click', (ev) => { ev.preventDefault(); restartConfig(); });
}

export function init() {
  // Hook up summary actions
  initSummaryActions();
}

export function restoreFromState(state) {
  try {
    populateSummaryPanel();
  } catch (e) { /* ignore */ }
}
