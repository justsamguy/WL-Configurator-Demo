import { state } from '../state.js';

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
