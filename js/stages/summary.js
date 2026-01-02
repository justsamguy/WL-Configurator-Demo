import { state } from '../state.js';
import { loadData } from '../dataLoader.js';
import { computePrice } from '../pricing.js';

// html2canvas and jsPDF are available globally via CDN in index.html
const hasHtml2Canvas = typeof html2canvas !== 'undefined';
const hasJsPDF = typeof window.jsPDF !== 'undefined';

let summaryDataCache = null;

function buildIdMap(list) {
  const map = new Map();
  if (!Array.isArray(list)) return map;
  list.forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  return map;
}

function buildAddonMap(addons) {
  const map = new Map();
  if (!Array.isArray(addons)) return map;
  addons.forEach((group) => {
    if (Array.isArray(group.options)) {
      group.options.forEach((option) => {
        if (!option || !option.id) return;
        map.set(option.id, { title: option.title, price: option.price, group: group.title });
      });
    }
    if (Array.isArray(group.subsections)) {
      group.subsections.forEach((subsection) => {
        if (!Array.isArray(subsection.options)) return;
        subsection.options.forEach((option) => {
          if (!option || !option.id) return;
          map.set(option.id, {
            title: option.title,
            price: option.price,
            group: group.title,
            subsection: subsection.title
          });
        });
      });
    }
  });
  return map;
}

async function loadSummaryData() {
  if (summaryDataCache) return summaryDataCache;
  const [models, designs, materials, colors, finish, dimensions, legs, tubeSizes, legFinishes, addons] = await Promise.all([
    loadData('data/models.json'),
    loadData('data/designs.json'),
    loadData('data/materials.json'),
    loadData('data/colors.json'),
    loadData('data/finish.json'),
    loadData('data/dimensions.json'),
    loadData('data/legs.json'),
    loadData('data/tube-sizes.json'),
    loadData('data/leg-finish.json'),
    loadData('data/addons.json')
  ]);

  summaryDataCache = {
    models: buildIdMap(models),
    designs: buildIdMap(designs),
    materials: buildIdMap(materials),
    colors: buildIdMap(colors),
    finishCoatings: buildIdMap(finish && finish.coatings),
    finishSheens: buildIdMap(finish && finish.sheens),
    finishTints: buildIdMap(finish && finish.tints),
    dimensions: buildIdMap(dimensions && dimensions.presets),
    legs: buildIdMap(legs),
    tubeSizes: buildIdMap(tubeSizes),
    legFinishes: buildIdMap(legFinishes),
    addons: buildAddonMap(addons)
  };

  return summaryDataCache;
}

function isQuotedLabel(value) {
  return typeof value === 'string' && value.trim() && Number.isNaN(Number(value));
}

function formatPriceLabel(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return `+$${value.toLocaleString()}`;
}

function resolvePriceLabel(dataPrice, priceValue) {
  if (isQuotedLabel(dataPrice)) return dataPrice.trim();
  if (typeof priceValue === 'number' && !Number.isNaN(priceValue)) return formatPriceLabel(priceValue);
  const parsed = typeof dataPrice === 'string' ? Number(dataPrice) : dataPrice;
  if (typeof parsed === 'number' && !Number.isNaN(parsed)) return formatPriceLabel(parsed);
  return '';
}

function formatDimensionsDetail(detail) {
  if (!detail || typeof detail !== 'object') return '';
  const sizeParts = [];
  if (typeof detail.length === 'number') sizeParts.push(`${detail.length} in`);
  if (typeof detail.width === 'number') sizeParts.push(`${detail.width} in`);
  let sizeText = '';
  if (sizeParts.length === 2) sizeText = `${sizeParts[0]} x ${sizeParts[1]}`;
  else if (sizeParts.length === 1) sizeText = sizeParts[0];
  let heightText = '';
  if (detail.height === 'standard') heightText = 'standard height';
  else if (detail.height === 'bar') heightText = 'bar height';
  else if (detail.height === 'custom') {
    if (typeof detail.heightCustom === 'number') heightText = `custom height ${detail.heightCustom} in`;
    else heightText = 'custom height';
  }
  if (heightText) sizeText = sizeText ? `${sizeText}, ${heightText}` : heightText;
  return sizeText;
}

function formatAddonValue(entry, fallbackId) {
  if (!entry) return fallbackId;
  if (entry.subsection) return `${entry.subsection}: ${entry.title}`;
  if (entry.group && entry.title && entry.title !== entry.group) return `${entry.group}: ${entry.title}`;
  return entry.title || entry.group || fallbackId;
}

function createSummaryRow({ label, value, priceLabel, isLast }) {
  const row = document.createElement('div');
  row.className = 'flex justify-between items-start py-1 text-sm';
  if (!isLast) row.classList.add('border-b');

  const left = document.createElement('span');
  left.className = 'text-gray-800';
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  left.appendChild(strong);
  left.appendChild(document.createTextNode(' '));
  const valueSpan = document.createElement('span');
  valueSpan.textContent = value;
  left.appendChild(valueSpan);

  const priceSpan = document.createElement('span');
  priceSpan.className = 'text-gray-600 text-right ml-4';
  priceSpan.textContent = priceLabel || '';

  row.appendChild(left);
  row.appendChild(priceSpan);
  return row;
}

export async function populateSummaryPanel() {
  const modelName = document.getElementById('summary-model-name');
  const designName = document.getElementById('summary-design-name');
  const modelPrice = document.getElementById('summary-model-price');
  const customOptions = document.getElementById('summary-custom-options');
  const total = document.getElementById('summary-total-price');
  if (!modelName || !modelPrice || !customOptions || !total) return;

  const s = state;
  const selections = s.selections || {};
  let priceData = null;
  try {
    priceData = await computePrice(s);
  } catch (e) {
    console.warn('Summary pricing failed', e);
  }

  const baseValue = priceData && typeof priceData.base === 'number'
    ? priceData.base
    : (s.pricing && typeof s.pricing.base === 'number' ? s.pricing.base : 0);
  const totalValue = priceData && typeof priceData.total === 'number'
    ? priceData.total
    : (s.pricing && typeof s.pricing.total === 'number' ? s.pricing.total : 0);

  modelPrice.textContent = formatCurrency(baseValue);
  total.textContent = formatCurrency(totalValue);

  let summaryData = null;
  try {
    summaryData = await loadSummaryData();
  } catch (e) {
    console.warn('Summary data load failed', e);
  }

  const modelId = selections.model;
  const modelEntry = summaryData && modelId ? summaryData.models.get(modelId) : null;
  modelName.textContent = modelEntry && modelEntry.title ? modelEntry.title : (modelId || 'none');

  if (designName) {
    const designId = selections.design;
    const designEntry = summaryData && designId ? summaryData.designs.get(designId) : null;
    designName.textContent = designEntry && designEntry.title ? designEntry.title : (designId || 'none');
  }

  const priceLookup = new Map();
  if (priceData && Array.isArray(priceData.breakdown)) {
    priceData.breakdown.forEach((item) => {
      if (!item || !item.type || !item.id) return;
      priceLookup.set(`${item.type}:${item.id}`, item.price);
    });
  }

  const opts = selections.options || {};
  const items = [];

  const addOption = (label, type, id, entry) => {
    if (!id) return;
    const value = entry && entry.title ? entry.title : id;
    const priceValue = priceLookup.get(`${type}:${id}`);
    const priceLabel = resolvePriceLabel(entry ? entry.price : null, priceValue);
    items.push({ label, value, priceLabel });
  };

  addOption('Material', 'material', opts.material, summaryData && opts.material ? summaryData.materials.get(opts.material) : null);
  addOption('Color', 'color', opts.color, summaryData && opts.color ? summaryData.colors.get(opts.color) : null);

  const customColorNote = typeof opts.customColorNote === 'string' ? opts.customColorNote.trim() : '';
  if (customColorNote) items.push({ label: 'Custom Color Note', value: customColorNote, priceLabel: '' });

  addOption('Finish Coating', 'finish-coating', opts['finish-coating'], summaryData && opts['finish-coating'] ? summaryData.finishCoatings.get(opts['finish-coating']) : null);
  addOption('Finish Sheen', 'finish-sheen', opts['finish-sheen'], summaryData && opts['finish-sheen'] ? summaryData.finishSheens.get(opts['finish-sheen']) : null);
  addOption('Finish Tint', 'finish-tint', opts['finish-tint'], summaryData && opts['finish-tint'] ? summaryData.finishTints.get(opts['finish-tint']) : null);

  const dimensionValue = formatDimensionsDetail(selections.dimensionsDetail);
  if (opts.dimensions || dimensionValue) {
    const priceValue = priceLookup.get(`dimensions:${opts.dimensions}`);
    const priceLabel = resolvePriceLabel(null, priceValue);
    const fallbackDimension = opts.dimensions === 'dimensions-custom' ? 'Custom dimensions' : opts.dimensions;
    items.push({ label: 'Dimensions', value: dimensionValue || fallbackDimension, priceLabel });
  }

  addOption('Legs', 'legs', opts.legs, summaryData && opts.legs ? summaryData.legs.get(opts.legs) : null);
  addOption('Tube Size', 'tube-size', opts['tube-size'], summaryData && opts['tube-size'] ? summaryData.tubeSizes.get(opts['tube-size']) : null);
  addOption('Leg Finish', 'leg-finish', opts['leg-finish'], summaryData && opts['leg-finish'] ? summaryData.legFinishes.get(opts['leg-finish']) : null);

  const addons = Array.isArray(opts.addon) ? opts.addon : [];
  if (addons.length) {
    addons.forEach((addonId) => {
      if (!addonId) return;
      const entry = summaryData ? summaryData.addons.get(addonId) : null;
      const value = formatAddonValue(entry, addonId);
      const priceValue = priceLookup.get(`addon:${addonId}`);
      const priceLabel = resolvePriceLabel(entry ? entry.price : null, priceValue);
      items.push({ label: 'Add-on', value, priceLabel });
    });
  }

  customOptions.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'text-gray-600 text-sm';
    empty.textContent = 'No options selected';
    customOptions.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const row = createSummaryRow({ ...item, isLast: index === items.length - 1 });
    customOptions.appendChild(row);
  });
}

export default { populateSummaryPanel, init, initSummaryActions, restoreFromState };

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
  // Ensure snapshot is captured before exporting
  if (!hasJsPDF || !hasHtml2Canvas) {
    console.warn('jsPDF or html2canvas not available');
    return;
  }
  
  // Check if snapshot needs to be captured first
  const imgEl = document.getElementById('snapshot-img');
  const placeholder = document.getElementById('snapshot-placeholder');
  if (!imgEl || imgEl.style.display === 'none' || !imgEl.src) {
    // Auto-capture if not already done
    await captureSnapshot();
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
  // Do not mutate global state here. Request a restart and let main.js handle
  // the canonical state reset and stage navigation.
  document.dispatchEvent(new CustomEvent('request-restart'));
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
