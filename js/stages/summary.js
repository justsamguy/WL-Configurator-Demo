import { state } from '../state.js';
import { loadData } from '../dataLoader.js';
import { computePrice, getWaterfallEdgeCount } from '../pricing.js';
import { showConfirmDialog } from '../ui/confirmDialog.js';

// html2canvas and jsPDF are available globally via CDN in index.html
const hasHtml2Canvas = typeof html2canvas !== 'undefined';
const hasJsPDF = typeof window.jsPDF !== 'undefined';

let summaryDataCache = null;
let zip3RegionMap = null;
let zip3RegionPromise = null;

async function loadZip3RegionMap() {
  if (zip3RegionMap) return zip3RegionMap;
  if (!zip3RegionPromise) {
    zip3RegionPromise = (async () => {
      try {
        const res = await fetch('data/us_zip3_to_census_region.csv');
        if (!res.ok) throw new Error(`Zip3 region fetch failed: ${res.status}`);
        const text = await res.text();
        const map = new Map();
        const lines = text.trim().split(/\r?\n/);
        lines.slice(1).forEach((line) => {
          const [zip3Raw, regionRaw] = line.split(',');
          const zip3 = zip3Raw ? zip3Raw.trim() : '';
          const region = regionRaw ? regionRaw.trim() : '';
          if (zip3.length === 3 && region) map.set(zip3, region);
        });
        zip3RegionMap = map;
        return map;
      } catch (e) {
        console.warn('Summary zip3 lookup failed', e);
        zip3RegionMap = new Map();
        return zip3RegionMap;
      }
    })();
  }
  zip3RegionMap = await zip3RegionPromise;
  return zip3RegionMap;
}

function normalizeZipInput(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\D/g, '').slice(0, 5);
}

async function updateRegionFromZip(zipValue, regionInput) {
  if (!regionInput) return;
  if (!zipValue || zipValue.length < 3) {
    regionInput.value = 'Auto';
    return;
  }
  const map = await loadZip3RegionMap();
  const zip3 = zipValue.slice(0, 3);
  const region = map.get(zip3);
  regionInput.value = region || 'Unknown';
}

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

function getShippingCost() {
  const estimate = document.getElementById('shipping-estimate') || document.getElementById('shipping-estimate-header');
  if (!estimate) return 0;
  const text = estimate.textContent.trim();
  // Extract numeric value from formatted currency (e.g., "$500" -> 500)
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
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

function addOptionItem(list, label, id, entry, type) {
  if (!id) return;
  list.push({ label, value: getEntryTitle(entry, id), id, type });
}

function buildOptionGroups(selections, summaryData) {
  const groups = [];
  const opts = selections.options || {};
  const waterfallCount = getWaterfallEdgeCount({ selections });

  const modelId = selections.model;
  if (modelId) {
    const modelEntry = summaryData && summaryData.models ? summaryData.models.get(modelId) : null;
    groups.push({
      title: 'Model',
      items: [{ label: 'Model', value: getEntryTitle(modelEntry, modelId), id: modelId, type: 'model' }]
    });
  }

  const designId = selections.design;
  if (designId) {
    const designEntry = summaryData && summaryData.designs ? summaryData.designs.get(designId) : null;
    groups.push({
      title: 'Design',
      items: [{ label: 'Design', value: getEntryTitle(designEntry, designId), id: designId, type: 'design' }]
    });
  }

  const materialItems = [];
  addOptionItem(materialItems, 'Material', opts.material, summaryData && opts.material ? summaryData.materials.get(opts.material) : null, 'material');
  addOptionItem(materialItems, 'Color', opts.color, summaryData && opts.color ? summaryData.colors.get(opts.color) : null, 'color');
  const customColorNote = typeof opts.customColorNote === 'string' ? opts.customColorNote.trim() : '';
  if (customColorNote) materialItems.push({ label: 'Custom Color Note', value: customColorNote, type: 'note' });
  if (materialItems.length) groups.push({ title: 'Materials', items: materialItems });

  const finishItems = [];
  addOptionItem(finishItems, 'Finish Coating', opts['finish-coating'], summaryData && opts['finish-coating'] ? summaryData.finishCoatings.get(opts['finish-coating']) : null, 'finish-coating');
  addOptionItem(finishItems, 'Finish Sheen', opts['finish-sheen'], summaryData && opts['finish-sheen'] ? summaryData.finishSheens.get(opts['finish-sheen']) : null, 'finish-sheen');
  addOptionItem(finishItems, 'Finish Tint', opts['finish-tint'], summaryData && opts['finish-tint'] ? summaryData.finishTints.get(opts['finish-tint']) : null, 'finish-tint');
  if (finishItems.length) groups.push({ title: 'Finish', items: finishItems });

  const dimensionValue = formatDimensionsDetail(selections.dimensionsDetail);
  if (opts.dimensions || dimensionValue) {
    const dimensionEntry = summaryData && opts.dimensions ? summaryData.dimensions.get(opts.dimensions) : null;
    const fallbackDimension = opts.dimensions === 'dimensions-custom' ? 'Custom dimensions' : opts.dimensions;
    const dimensionLabel = dimensionValue || getEntryTitle(dimensionEntry, fallbackDimension || 'Custom dimensions');
    groups.push({ title: 'Dimensions', items: [{ label: 'Dimensions', value: dimensionLabel, id: opts.dimensions, type: 'dimensions' }] });
  }

  const legsItems = [];
  addOptionItem(legsItems, 'Legs', opts.legs, summaryData && opts.legs ? summaryData.legs.get(opts.legs) : null, 'legs');
  addOptionItem(legsItems, 'Tube Size', opts['tube-size'], summaryData && opts['tube-size'] ? summaryData.tubeSizes.get(opts['tube-size']) : null, 'tube-size');
  addOptionItem(legsItems, 'Leg Finish', opts['leg-finish'], summaryData && opts['leg-finish'] ? summaryData.legFinishes.get(opts['leg-finish']) : null, 'leg-finish');
  if (waterfallCount >= 2 && legsItems.length) {
    const legsItem = legsItems.find(item => item.type === 'legs');
    if (legsItem) legsItem.value = 'replaced by waterfall';
  }
  if (legsItems.length) groups.push({ title: 'Legs', items: legsItems });

  const addonItems = [];
  const addons = Array.isArray(opts.addon) ? opts.addon : [];
  addons.forEach((addonId) => {
    if (!addonId) return;
    const entry = summaryData ? summaryData.addons.get(addonId) : null;
    const value = formatAddonValue(entry, addonId);
    if (value) addonItems.push({ label: value, id: addonId, type: 'addon' });
  });
  if (addonItems.length) groups.push({ title: 'Add-ons', items: addonItems });

  return groups;
}

function createOptionRow(item) {
  const row = document.createElement('div');
  row.className = 'summary-option-row';
  const hasValue = item && item.value !== undefined && item.value !== null && String(item.value).trim() !== '';
  const hasPrice = item && item.price !== undefined && item.price !== null && String(item.price).trim() !== '';
  if (hasPrice) row.classList.add('has-price');

  const main = document.createElement('div');
  main.className = 'summary-option-main';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'summary-option-label';
  labelSpan.textContent = hasValue ? `${item.label}:` : item.label;
  main.appendChild(labelSpan);

  if (hasValue) {
    const valueSpan = document.createElement('span');
    valueSpan.className = 'summary-option-value';
    valueSpan.textContent = String(item.value);
    main.appendChild(valueSpan);
  }

  row.appendChild(main);

  if (hasPrice) {
    const priceSpan = document.createElement('span');
    priceSpan.className = 'summary-option-price';
    priceSpan.textContent = String(item.price);
    row.appendChild(priceSpan);
  }

  return row;
}

function createOptionGroup(group) {
  const wrapper = document.createElement('div');
  wrapper.className = 'summary-options-group';

  const heading = document.createElement('div');
  heading.className = 'summary-options-title';
  heading.textContent = group.title;
  wrapper.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'summary-options-list';
  group.items.forEach(item => list.appendChild(createOptionRow(item)));
  wrapper.appendChild(list);

  return wrapper;
}

function renderOptionGroups(container, groups) {
  container.innerHTML = '';
  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'summary-empty';
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

function buildBreakdownPriceMap(priceData) {
  const map = new Map();
  if (!priceData || !Array.isArray(priceData.breakdown)) return map;
  priceData.breakdown.forEach((item) => {
    if (!item || !item.type || !item.id) return;
    const price = formatBreakdownPrice(item);
    if (!price) return;
    map.set(`${item.type}:${item.id}`, price);
  });
  return map;
}

function applyBreakdownPrices(groups, priceMap) {
  if (!Array.isArray(groups) || !priceMap) return;
  groups.forEach((group) => {
    if (!group || !Array.isArray(group.items)) return;
    group.items.forEach((item) => {
      if (!item || !item.type || !item.id) return;
      const price = priceMap.get(`${item.type}:${item.id}`);
      if (price) item.price = price;
    });
  });
}

function createPriceRow(entry, isLast) {
  const row = document.createElement('div');
  row.className = 'summary-price-row';
  if (isLast) row.classList.add('is-last');

  const left = document.createElement('span');
  left.className = 'summary-price-label';
  left.textContent = entry.label;
  row.appendChild(left);

  const right = document.createElement('span');
  right.className = 'summary-price-amount';
  right.textContent = entry.price || '';
  row.appendChild(right);

  return row;
}

function renderPriceBreakdown(container, entries) {
  container.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'summary-empty';
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
  const total = document.getElementById('summary-total-price');
  if (!optionsRoot || !total) return;

  const s = state;
  const selections = s.selections || {};

  let summaryData = null;
  try {
    summaryData = await loadSummaryData();
  } catch (e) {
    console.warn('Summary data load failed', e);
  }

  const groups = buildOptionGroups(selections, summaryData);

  let priceData = null;
  try {
    priceData = await computePrice(s);
  } catch (e) {
    console.warn('Summary pricing failed', e);
  }

  const priceMap = buildBreakdownPriceMap(priceData);
  applyBreakdownPrices(groups, priceMap);
  renderOptionGroups(optionsRoot, groups);

  const totalValue = priceData && typeof priceData.total === 'number'
    ? priceData.total
    : (s.pricing && typeof s.pricing.total === 'number' ? s.pricing.total : 0);
  const shippingCost = getShippingCost();
  const finalTotal = totalValue + shippingCost;
  total.textContent = formatCurrency(finalTotal);
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

async function restartConfig() {
  // Do not mutate global state here. Request a restart and let main.js handle
  // the canonical state reset and stage navigation.
  const confirmed = await showConfirmDialog(
    'Are you sure you want to discard all customizations and start a new project?',
    'Cancel',
    'Start Over'
  );
  if (!confirmed) return;
  document.dispatchEvent(new CustomEvent('request-restart'));
}

function initShippingControls() {
  const section = document.getElementById('summary-shipping-section');
  if (!section || section.dataset.wlBound === 'true') return;
  section.dataset.wlBound = 'true';

  const toggle = document.getElementById('summary-shipping-toggle');
  const body = document.getElementById('summary-shipping-body');
  const quote = document.getElementById('shipping-quote-separately');
  const international = document.getElementById('shipping-international');
  const local = document.getElementById('shipping-local-delivery');
  const zip = document.getElementById('shipping-zip');
  const region = document.getElementById('shipping-region');
  const fields = document.getElementById('summary-shipping-fields');
  const estimate = document.getElementById('shipping-estimate');
  const headerEstimate = document.getElementById('shipping-estimate-header');
  const toggles = document.getElementById('summary-shipping-toggles');
  const commercial = document.getElementById('shipping-commercial');
  const liftgate = document.getElementById('shipping-liftgate');
  const whiteGlove = document.getElementById('shipping-white-glove');
  const notes = document.getElementById('summary-shipping-notes');
  const notesInput = document.getElementById('shipping-notes');
  const defaultEstimate = estimate ? estimate.textContent.trim() : '';

  const setCollapsed = (collapsed) => {
    section.classList.toggle('is-collapsed', collapsed);
    if (body) body.hidden = collapsed;
    if (toggle) toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  };

  const setEstimateText = (value, isDisabled) => {
    if (estimate) {
      estimate.textContent = value;
      estimate.classList.toggle('is-disabled', isDisabled);
    }
    if (headerEstimate) {
      headerEstimate.textContent = value;
      headerEstimate.classList.toggle('is-disabled', isDisabled);
    }
  };

  const updateState = () => {
    const localDelivery = !!(local && local.checked);
    const disabled = !!(quote && quote.checked) || !!(international && international.checked) || localDelivery;
    if (fields) {
      fields.classList.toggle('is-disabled', disabled);
      fields.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
    if (zip) zip.disabled = disabled;
    if (region) region.disabled = disabled;
    const normalizedZip = zip ? normalizeZipInput(zip.value) : '';
    const showExtras = !disabled && normalizedZip.length === 5;
    if (toggles) {
      toggles.classList.toggle('is-visible', showExtras);
      toggles.setAttribute('aria-hidden', showExtras ? 'false' : 'true');
    }
    [commercial, liftgate, whiteGlove].forEach((input) => {
      if (input) input.disabled = !showExtras;
    });
    const showNotes = localDelivery || (!!(whiteGlove && whiteGlove.checked) && showExtras);
    if (notes) {
      notes.classList.toggle('is-visible', showNotes);
      notes.setAttribute('aria-hidden', showNotes ? 'false' : 'true');
    }
    if (notesInput) notesInput.disabled = !showNotes;
    if (localDelivery) {
      const tableLength = state.selections && state.selections.dimensionsDetail && typeof state.selections.dimensionsDetail.length === 'number'
        ? state.selections.dimensionsDetail.length
        : 0;
      const shippingCost = tableLength > 144 ? 750 : 500;
      setEstimateText(formatCurrency(shippingCost), disabled);
    } else {
      setEstimateText(defaultEstimate || '--', disabled);
    }
  };

  const handleZipInput = async () => {
    if (!zip || !region) return;
    const normalized = normalizeZipInput(zip.value);
    if (zip.value !== normalized) zip.value = normalized;
    await updateRegionFromZip(normalized, region);
    updateState();
  };

  const updateTotal = () => {
    populateSummaryPanel();
  };

  const optionInputs = [quote, international, local].filter(Boolean);
  optionInputs.forEach((input) => {
    input.addEventListener('mousedown', () => {
      input.dataset.wasChecked = input.checked ? 'true' : 'false';
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        input.dataset.wasChecked = input.checked ? 'true' : 'false';
      }
    });
    input.addEventListener('click', () => {
      if (input.dataset.wasChecked === 'true') {
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  if (toggle && body) {
    toggle.addEventListener('click', () => {
      setCollapsed(!section.classList.contains('is-collapsed'));
    });
  }
  if (quote) quote.addEventListener('change', () => { updateState(); updateTotal(); });
  if (international) international.addEventListener('change', () => { updateState(); updateTotal(); });
  if (local) local.addEventListener('change', () => { updateState(); updateTotal(); });
  if (zip) zip.addEventListener('input', () => { handleZipInput(); updateTotal(); });
  if (commercial) commercial.addEventListener('change', updateState);
  if (liftgate) liftgate.addEventListener('change', updateState);
  if (whiteGlove) whiteGlove.addEventListener('change', updateState);
  handleZipInput();
  updateState();
  setCollapsed(section.classList.contains('is-collapsed'));
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
    rst.addEventListener('click', async (ev) => { ev.preventDefault(); await restartConfig(); });
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
