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

const BREAKDOWN_LABELS = {
  design: 'Design',
  material: 'Material',
  color: 'Color',
  'finish-coating': 'Finish Coating',
  'finish-sheen': 'Finish Sheen',
  'finish-tint': 'Finish Tint',
  dimensions: 'Dimensions',
  legs: 'Legs',
  'tube-size': 'Tube Size',
  'leg-finish': 'Leg Finish',
  addon: 'Add-on'
};

function formatCurrency(val) {
  if (typeof val !== 'number') return '$0';
  return `$${val.toLocaleString()}`;
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
  if (entry.subsection && entry.group) return `${entry.group}: ${entry.subsection} - ${entry.title}`;
  if (entry.subsection) return `${entry.subsection}: ${entry.title}`;
  if (entry.group && entry.title && entry.title !== entry.group) return `${entry.group}: ${entry.title}`;
  return entry.title || entry.group || fallbackId;
}

function getEntryTitle(entry, fallbackId) {
  if (entry && entry.title) return entry.title;
  return fallbackId || '';
}

function addOptionItem(list, label, id, entry) {
  if (!id) return;
  list.push({ label, value: getEntryTitle(entry, id) });
}

function buildOptionGroups(selections, summaryData) {
  const groups = [];
  const opts = selections.options || {};

  const modelId = selections.model;
  if (modelId) {
    const modelEntry = summaryData && summaryData.models ? summaryData.models.get(modelId) : null;
    groups.push({
      title: 'Model',
      items: [{ label: 'Model', value: getEntryTitle(modelEntry, modelId) }]
    });
  }

  const designId = selections.design;
  if (designId) {
    const designEntry = summaryData && summaryData.designs ? summaryData.designs.get(designId) : null;
    groups.push({
      title: 'Design',
      items: [{ label: 'Design', value: getEntryTitle(designEntry, designId) }]
    });
  }

  const materialItems = [];
  addOptionItem(materialItems, 'Material', opts.material, summaryData && opts.material ? summaryData.materials.get(opts.material) : null);
  addOptionItem(materialItems, 'Color', opts.color, summaryData && opts.color ? summaryData.colors.get(opts.color) : null);
  const customColorNote = typeof opts.customColorNote === 'string' ? opts.customColorNote.trim() : '';
  if (customColorNote) materialItems.push({ label: 'Custom Color Note', value: customColorNote });
  if (materialItems.length) groups.push({ title: 'Materials', items: materialItems });

  const finishItems = [];
  addOptionItem(finishItems, 'Finish Coating', opts['finish-coating'], summaryData && opts['finish-coating'] ? summaryData.finishCoatings.get(opts['finish-coating']) : null);
  addOptionItem(finishItems, 'Finish Sheen', opts['finish-sheen'], summaryData && opts['finish-sheen'] ? summaryData.finishSheens.get(opts['finish-sheen']) : null);
  addOptionItem(finishItems, 'Finish Tint', opts['finish-tint'], summaryData && opts['finish-tint'] ? summaryData.finishTints.get(opts['finish-tint']) : null);
  if (finishItems.length) groups.push({ title: 'Finish', items: finishItems });

  const dimensionValue = formatDimensionsDetail(selections.dimensionsDetail);
  if (opts.dimensions || dimensionValue) {
    const dimensionEntry = summaryData && opts.dimensions ? summaryData.dimensions.get(opts.dimensions) : null;
    const fallbackDimension = opts.dimensions === 'dimensions-custom' ? 'Custom dimensions' : opts.dimensions;
    const dimensionLabel = dimensionValue || getEntryTitle(dimensionEntry, fallbackDimension || 'Custom dimensions');
    groups.push({ title: 'Dimensions', items: [{ label: 'Dimensions', value: dimensionLabel }] });
  }

  const legsItems = [];
  addOptionItem(legsItems, 'Legs', opts.legs, summaryData && opts.legs ? summaryData.legs.get(opts.legs) : null);
  addOptionItem(legsItems, 'Tube Size', opts['tube-size'], summaryData && opts['tube-size'] ? summaryData.tubeSizes.get(opts['tube-size']) : null);
  addOptionItem(legsItems, 'Leg Finish', opts['leg-finish'], summaryData && opts['leg-finish'] ? summaryData.legFinishes.get(opts['leg-finish']) : null);
  if (legsItems.length) groups.push({ title: 'Legs', items: legsItems });

  const addonItems = [];
  const addons = Array.isArray(opts.addon) ? opts.addon : [];
  addons.forEach((addonId) => {
    if (!addonId) return;
    const entry = summaryData ? summaryData.addons.get(addonId) : null;
    const value = formatAddonValue(entry, addonId);
    if (value) addonItems.push({ label: value });
  });
  if (addonItems.length) groups.push({ title: 'Add-ons', items: addonItems });

  return groups;
}

function createOptionRow(item) {
  const row = document.createElement('div');
  row.className = 'text-sm text-gray-700 flex flex-wrap gap-1';
  const hasValue = item && item.value !== undefined && item.value !== null && String(item.value).trim() !== '';

  const labelSpan = document.createElement('span');
  labelSpan.className = hasValue ? 'font-medium text-gray-700' : 'text-gray-700';
  labelSpan.textContent = hasValue ? `${item.label}:` : item.label;
  row.appendChild(labelSpan);

  if (hasValue) {
    const valueSpan = document.createElement('span');
    valueSpan.className = 'text-gray-600';
    valueSpan.textContent = String(item.value);
    row.appendChild(valueSpan);
  }

  return row;
}

function createOptionGroup(group) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-2';

  const heading = document.createElement('div');
  heading.className = 'text-sm font-semibold text-gray-900';
  heading.textContent = group.title;
  wrapper.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'flex flex-col gap-1 pl-4';
  group.items.forEach(item => list.appendChild(createOptionRow(item)));
  wrapper.appendChild(list);

  return wrapper;
}

function renderOptionGroups(container, groups) {
  container.innerHTML = '';
  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'text-gray-600 text-sm';
    empty.textContent = 'No options selected';
    container.appendChild(empty);
    return;
  }
  groups.forEach(group => container.appendChild(createOptionGroup(group)));
}

function formatBreakdownLabel(item) {
  if (!item) return '';
  const prefix = BREAKDOWN_LABELS[item.type] || item.type || '';
  const label = item.label || item.id || '';
  if (!label) return prefix;
  return prefix ? `${prefix}: ${label}` : label;
}

function formatBreakdownPrice(item) {
  if (!item) return '';
  if (item.priceLabel) return item.priceLabel;
  if (typeof item.price !== 'number' || Number.isNaN(item.price)) return '';
  if (item.isBase || item.type === 'design') return formatCurrency(item.price);
  if (item.price === 0) return '$0';
  return `+${formatCurrency(item.price)}`;
}

function createPriceRow(entry, isLast) {
  const row = document.createElement('div');
  row.className = 'flex justify-between items-start text-sm text-gray-700 py-2';
  if (!isLast) row.classList.add('border-b', 'border-gray-100');

  const left = document.createElement('span');
  left.textContent = entry.label;
  row.appendChild(left);

  const right = document.createElement('span');
  right.className = 'text-gray-600 text-right ml-4';
  right.textContent = entry.price || '';
  row.appendChild(right);

  return row;
}

function renderPriceBreakdown(container, entries) {
  container.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'text-gray-600 text-sm';
    empty.textContent = 'Pricing details unavailable';
    container.appendChild(empty);
    return;
  }
  entries.forEach((entry, index) => {
    container.appendChild(createPriceRow(entry, index === entries.length - 1));
  });
}

function buildPriceBreakdown(priceData) {
  if (!priceData || !Array.isArray(priceData.breakdown)) return [];
  return priceData.breakdown
    .map(item => ({
      label: formatBreakdownLabel(item),
      price: formatBreakdownPrice(item)
    }))
    .filter(entry => entry.label);
}

export async function populateSummaryPanel() {
  const optionsRoot = document.getElementById('summary-options-groups');
  const priceRoot = document.getElementById('summary-price-items');
  const total = document.getElementById('summary-total-price');
  if (!optionsRoot || !priceRoot || !total) return;

  const s = state;
  const selections = s.selections || {};

  let summaryData = null;
  try {
    summaryData = await loadSummaryData();
  } catch (e) {
    console.warn('Summary data load failed', e);
  }

  const groups = buildOptionGroups(selections, summaryData);
  renderOptionGroups(optionsRoot, groups);

  let priceData = null;
  try {
    priceData = await computePrice(s);
  } catch (e) {
    console.warn('Summary pricing failed', e);
  }

  const totalValue = priceData && typeof priceData.total === 'number'
    ? priceData.total
    : (s.pricing && typeof s.pricing.total === 'number' ? s.pricing.total : 0);
  total.textContent = formatCurrency(totalValue);

  const breakdownEntries = buildPriceBreakdown(priceData);
  renderPriceBreakdown(priceRoot, breakdownEntries);
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

function initShippingControls() {
  const section = document.getElementById('summary-shipping-section');
  if (!section || section.dataset.wlBound === 'true') return;
  section.dataset.wlBound = 'true';

  const quote = document.getElementById('shipping-quote-separately');
  const international = document.getElementById('shipping-international');
  const zip = document.getElementById('shipping-zip');
  const region = document.getElementById('shipping-region');
  const fields = document.getElementById('summary-shipping-fields');
  const estimate = document.getElementById('shipping-estimate');

  const updateState = () => {
    const disabled = !!((quote && quote.checked) || (international && international.checked));
    if (fields) {
      fields.classList.toggle('opacity-50', disabled);
      fields.classList.toggle('pointer-events-none', disabled);
      fields.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
    if (zip) zip.disabled = disabled;
    if (region) region.disabled = disabled;
    if (estimate) {
      estimate.classList.toggle('text-gray-400', disabled);
      estimate.classList.toggle('text-gray-700', !disabled);
    }
  };

  if (quote) quote.addEventListener('change', updateState);
  if (international) international.addEventListener('change', updateState);
  updateState();
}

export function initSummaryActions() {
  const cap = document.getElementById('capture-snapshot');
  const exp = document.getElementById('export-pdf');
  const rst = document.getElementById('restart-config');
  if (cap && cap.dataset.wlBound !== 'true') {
    cap.dataset.wlBound = 'true';
    cap.addEventListener('click', async (ev) => { ev.preventDefault(); await captureSnapshot(); });
  }
  if (exp && exp.dataset.wlBound !== 'true') {
    exp.dataset.wlBound = 'true';
    exp.addEventListener('click', async (ev) => { ev.preventDefault(); await exportPdf(); });
  }
  if (rst && rst.dataset.wlBound !== 'true') {
    rst.dataset.wlBound = 'true';
    rst.addEventListener('click', (ev) => { ev.preventDefault(); restartConfig(); });
  }
  initShippingControls();
}

export function init() {
  // Hook up summary actions
  initSummaryActions();
}

export function restoreFromState(_state) {
  try {
    populateSummaryPanel();
  } catch (e) { /* ignore */ }
}

export default { populateSummaryPanel, init, initSummaryActions, restoreFromState };
