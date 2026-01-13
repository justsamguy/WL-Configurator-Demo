import { state } from '../state.js';
import { loadData } from '../dataLoader.js';
import { computePrice, getWaterfallEdgeCount } from '../pricing.js';
import { showConfirmDialog } from '../ui/confirmDialog.js';
import { createLogger } from '../logger.js';

const log = createLogger('Summary');
const pdfLog = createLogger('PDF Export');

// html2canvas and jsPDF are available globally via CDN in index.html
const getJsPDFactory = () => {
  if (typeof window === 'undefined') return null;
  const factory = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
  console.debug('[PDF Export] jsPDF factory check', {
    hasJspdf: !!window.jspdf,
    hasJsPDFClass: !!(window.jspdf && window.jspdf.jsPDF),
    hasGlobalJsPDF: !!window.jsPDF,
    factory: !!factory
  });
  return factory;
};
const isHtml2CanvasAvailable = () => {
  const available = typeof window !== 'undefined' && typeof window.html2canvas !== 'undefined';
  console.debug('[PDF Export] html2canvas check', { 
    available,
    isFunction: typeof window?.html2canvas === 'function',
    keys: available ? Object.keys(window.html2canvas).slice(0, 5) : []
  });
  return available;
};
const SNAPSHOT_CAPTURE_ENABLED = false;

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
        log.warn('Summary zip3 lookup failed', e);
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

const HEIGHT_PRESETS_BY_MODEL = {
  'mdl-coffee': { standard: 18, bar: 20 },
  'mdl-dining': { standard: 30, bar: 42 },
  'mdl-conference': { standard: 30, bar: 36 }
};

const LEG_WEIGHT_RULES = {
  'leg-sample-04': { weight: 55, perLeg: true }, // Squared
  'leg-sample-05': { weight: 55, perLeg: true }, // Tapered
  'leg-sample-06': { weight: 75, perLeg: true }, // X Style
  'leg-sample-03': { weight: 75, perLeg: true }, // Hourglass
  'leg-sample-08': { weight: 110, perLeg: false }, // Tripod
  'leg-sample-07': { weight: 110, perLeg: false }, // Custom
  'leg-sample-02': { weight: 40, perLeg: false, isFlat: true }, // Cube
  'leg-sample-01': { weight: 40, perLeg: false, isFlat: true }, // C Style
  'leg-none': { weight: 0, perLeg: false }
};

const SHIPPING_ZONE_MAP = {
  '8': 2,
  '7': 3,
  '9': 3,
  '6': 4,
  '5': 5,
  '4': 6,
  '3': 7,
  '2': 8,
  '1': 9,
  '0': 10
};

const SHIPPING_RATE_CONFIG = {
  base: -8.2,
  weight: 1.218,
  cube: -1.617,
  zoneSlope: 0.097,
  minimum: 210
};

const POWER_STRIP_ADDONS = new Set(['addon-power-ac', 'addon-power-ac-usb', 'addon-power-ac-usb-usbc']);
const ADDITIONAL_CONNECTIVITY_ADDONS = new Set(['addon-ethernet', 'addon-hdmi']);

function resolveTableHeight(selections) {
  if (!selections || !selections.dimensionsDetail) return null;
  const detail = selections.dimensionsDetail;
  if (typeof detail.height === 'number') return detail.height;
  if (detail.height === 'custom' && typeof detail.heightCustom === 'number') return detail.heightCustom;
  const modelId = selections.model || '';
  const presets = HEIGHT_PRESETS_BY_MODEL[modelId] || { standard: 30, bar: 42 };
  if (detail.height === 'bar') return presets.bar;
  return presets.standard;
}

function resolveTableDimensions(selections) {
  if (!selections || !selections.dimensionsDetail) return null;
  const detail = selections.dimensionsDetail;
  const length = typeof detail.length === 'number' ? detail.length : null;
  const width = typeof detail.width === 'number' ? detail.width : null;
  const height = resolveTableHeight(selections);
  if (!length || !width || !height) return null;
  return { length, width, height };
}

function getLegCount(length) {
  if (typeof length !== 'number') return 2;
  return length > 130 ? 3 : 2;
}

function getLegWeight({ legId, tubeId, length, width, height, waterfallCount }) {
  if (!legId) return 0;
  if (waterfallCount >= 2) return 0;
  const rule = LEG_WEIGHT_RULES[legId];
  if (!rule || !rule.weight) return 0;

  let weight = rule.weight;
  if (!rule.isFlat) {
    const legCount = rule.perLeg ? getLegCount(length) : 1;
    weight = weight * legCount;
    if (tubeId === 'tube-2x4') weight *= 1.52;
    if (typeof height === 'number') {
      const heightMultiplier = Math.max(0.5, 1 + (height - 30) / 24);
      weight *= heightMultiplier;
    }
  }

  if (waterfallCount === 1) weight *= 0.5;
  return weight;
}

function getAddonWeight(addons, length, width) {
  if (!Array.isArray(addons)) return 0;
  let weight = 0;

  addons.forEach((addonId) => {
    if (POWER_STRIP_ADDONS.has(addonId)) weight += 20;
    if (addonId === 'addon-wireless-charging') weight += 10;
    if (ADDITIONAL_CONNECTIVITY_ADDONS.has(addonId)) weight += 10;
    if (addonId === 'addon-custom-tech') weight += 30;
  });

  if (addons.some(id => id && id.startsWith('addon-lighting-'))) weight += 30;
  if (addons.includes('addon-glass-top') && typeof length === 'number' && typeof width === 'number') {
    weight += length * width * 0.25 * 0.1;
  }

  return weight;
}

function getTabletopWeight({ length, width, height, waterfallCount }) {
  const tabletopVolume = length * width * 2;
  const waterfallVolume = waterfallCount > 0 ? waterfallCount * width * height * 2 : 0;
  let weight = (tabletopVolume + waterfallVolume) * 0.03;
  return weight;
}

function getPackagingWeight(totalWeight) {
  return totalWeight * 1.25;
}

function getDensityFactor(density) {
  if (density >= 15) return 0.9;
  if (density >= 10) return 1.0;
  if (density >= 6) return 1.15;
  if (density >= 4) return 1.3;
  if (density >= 2) return 1.6;
  return 2.0;
}

function calculateShippingEstimate({ zip, selections, accessorials }) {
  const normalizedZip = normalizeZipInput(zip || '');
  if (normalizedZip.length !== 5) return null;
  const zone = SHIPPING_ZONE_MAP[normalizedZip[0]];
  if (!zone) return null;
  const dimensions = resolveTableDimensions(selections);
  if (!dimensions) return null;

  const { length, width, height } = dimensions;
  const waterfallCount = getWaterfallEdgeCount({ selections });
  const addons = selections && selections.options && Array.isArray(selections.options.addon)
    ? selections.options.addon
    : [];
  const legId = selections && selections.options ? selections.options.legs : null;
  const tubeId = selections && selections.options ? selections.options['tube-size'] : null;

  const tabletopWeight = getTabletopWeight({ length, width, height, waterfallCount });
  const legWeight = getLegWeight({ legId, tubeId, length, width, height, waterfallCount });
  const addonWeight = getAddonWeight(addons, length, width);
  const totalWeight = getPackagingWeight(tabletopWeight + legWeight + addonWeight);

  const crateLength = length + 7;
  const crateWidth = width + 7;
  const crateHeight = height + 10;
  const cubeFeet = (crateLength * crateWidth * crateHeight) / 1728;
  if (!Number.isFinite(totalWeight) || !Number.isFinite(cubeFeet) || cubeFeet <= 0) return null;

  const zoneMultiplier = 1 + SHIPPING_RATE_CONFIG.zoneSlope * (zone - 2);
  const density = totalWeight / cubeFeet;
  const classFactor = getDensityFactor(density);
  const base = SHIPPING_RATE_CONFIG.base
    + SHIPPING_RATE_CONFIG.weight * totalWeight
    + SHIPPING_RATE_CONFIG.cube * cubeFeet;
  const raw = base * zoneMultiplier * classFactor;
  const estimate = Math.max(SHIPPING_RATE_CONFIG.minimum, raw);

  let total = estimate;
  if (accessorials && accessorials.residential) total += 150;
  if (accessorials && accessorials.liftgate) total += 200;
  if (accessorials && accessorials.whiteGlove) total += 750;

  const roundedUp = Math.ceil(total / 50) * 50;
  return Number.isFinite(total) ? roundedUp + 100 : null;
}

function getShippingCost() {
  const estimate = document.getElementById('shipping-estimate') || document.getElementById('shipping-estimate-header');
  if (!estimate) return 0;
  const numeric = estimate.textContent.trim().replace(/[^\d]/g, '');
  return numeric ? parseInt(numeric, 10) : 0;
}

function getShippingDetails() {
  const quote = document.getElementById('shipping-quote-separately');
  const international = document.getElementById('shipping-international');
  const local = document.getElementById('shipping-local-delivery');
  const zip = document.getElementById('shipping-zip');
  const region = document.getElementById('shipping-region');
  const estimate = document.getElementById('shipping-estimate') || document.getElementById('shipping-estimate-header');
  const commercial = document.getElementById('shipping-commercial');
  const liftgate = document.getElementById('shipping-liftgate');
  const whiteGlove = document.getElementById('shipping-white-glove');
  const notesInput = document.getElementById('shipping-notes');

  let mode = 'Standard shipping';
  if (quote && quote.checked) mode = 'Quote separately';
  else if (international && international.checked) mode = 'International shipping';
  else if (local && local.checked) mode = 'Local delivery';

  const zipValue = zip ? normalizeZipInput(zip.value) : '';
  const regionValue = region ? region.value.trim() : '';
  const estimateText = estimate ? estimate.textContent.trim() || '--' : '--';
  const estimateValue = getShippingCost();

  const flags = [];
  if (commercial && commercial.checked) flags.push('Residential delivery');
  if (liftgate && liftgate.checked) flags.push('Liftgate required');
  if (whiteGlove && whiteGlove.checked) flags.push('White glove service');

  const notes = notesInput && !notesInput.disabled ? notesInput.value.trim() : '';

  return {
    mode,
    zip: zipValue,
    region: regionValue,
    estimateText,
    estimateValue,
    flags,
    notes
  };
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
    log.warn('Summary data load failed', e);
  }

  const groups = buildOptionGroups(selections, summaryData);

  let priceData = null;
  try {
    priceData = await computePrice(s);
  } catch (e) {
    log.warn('Summary pricing failed', e);
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
  if (!SNAPSHOT_CAPTURE_ENABLED) {
    pdfLog.info('Snapshot capture disabled; skipping html2canvas.');
    return null;
  }
  const container = document.getElementById('snapshot-container');
  const imgEl = document.getElementById('snapshot-img');
  const placeholder = document.getElementById('snapshot-placeholder');
  if (!container || !imgEl || !isHtml2CanvasAvailable()) {
    pdfLog.warn('Snapshot prerequisites missing', {
      hasContainer: !!container,
      hasImage: !!imgEl,
      hasHtml2Canvas: isHtml2CanvasAvailable()
    });
    return null;
  }
  try {
    const canvas = await window.html2canvas(container, { backgroundColor: null, scale: 1 });
    const dataUrl = canvas.toDataURL('image/png');
    imgEl.src = dataUrl;
    imgEl.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
    return dataUrl;
  } catch (e) {
    pdfLog.warn('Snapshot failed', e);
    return null;
  }
}

async function exportPdf() {
  console.log('[PDF Export] Button clicked, starting export...');
  const jsPDFactory = getJsPDFactory();
  pdfLog.info('Export started');
  pdfLog.debug('Dependencies check', {
    hasJsPDF: !!jsPDFactory
  });
  console.warn('[PDF Export] Dependency check:', {
    jsPDFactory: !!jsPDFactory,
    windowJspdf: !!window.jspdf,
    windowJsPDF: !!window.jsPDF
  });
  if (!jsPDFactory) {
    const msg = 'Export unavailable: missing jsPDF';
    pdfLog.warn(msg);
    console.error('[PDF Export]', msg);
    return;
  }

  const snapshotUrl = SNAPSHOT_CAPTURE_ENABLED ? await captureSnapshot() : null;
  pdfLog.debug('Snapshot capture', { hasSnapshot: !!snapshotUrl });

  let summaryData = null;
  try {
    summaryData = await loadSummaryData();
    pdfLog.debug('Summary data loaded', {
      hasModels: summaryData && summaryData.models && summaryData.models.size > 0,
      hasAddons: summaryData && summaryData.addons && summaryData.addons.size > 0
    });
  } catch (e) {
    pdfLog.warn('Summary data load failed', e);
  }

  const selections = state.selections || {};
  const groups = buildOptionGroups(selections, summaryData);

  let priceData = null;
  try {
    priceData = await computePrice(state);
    pdfLog.debug('Pricing computed', {
      hasTotal: priceData && typeof priceData.total === 'number'
    });
  } catch (e) {
    pdfLog.warn('Summary pricing failed', e);
  }

  const priceMap = buildBreakdownPriceMap(priceData);
  applyBreakdownPrices(groups, priceMap);
  const priceBreakdown = buildPriceBreakdown(priceData);

  const subtotal = priceData && typeof priceData.total === 'number'
    ? priceData.total
    : (state.pricing && typeof state.pricing.total === 'number' ? state.pricing.total : 0);

  const shippingDetails = getShippingDetails();
  const shippingValue = typeof shippingDetails.estimateValue === 'number' ? shippingDetails.estimateValue : 0;
  const shippingLabel = shippingDetails.mode === 'Quote separately'
    ? 'Quoted separately'
    : (shippingValue ? formatCurrency(shippingValue) : (shippingDetails.estimateText || 'Pending'));
  const finalTotal = subtotal + shippingValue;

  const doc = new jsPDFactory({ unit: 'pt', format: 'a4' });
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const accent = [37, 99, 235];
  const textMain = [17, 24, 39];
  const textMuted = [107, 114, 128];
  let y = margin;

  const ensureSpace = (needed = 24) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addSectionTitle = (title) => {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...textMain);
    doc.text(title, margin, y);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.75);
    doc.line(margin, y + 4, margin + 52, y + 4);
    y += 16;
  };

  const addKeyValue = (label, value, rightValue) => {
    if (!value && !rightValue) return;
    const bodyWidth = pageWidth - margin * 2;
    const textWidth = rightValue ? bodyWidth - 96 : bodyWidth - 32;
    const lines = value ? doc.splitTextToSize(value, textWidth) : [];
    const lineHeight = 12;
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight);
    ensureSpace(blockHeight + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...textMain);
    doc.text(label, margin + 2, y);
    if (lines.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...textMain);
      doc.text(lines, rightValue ? margin + 72 : margin + 2, y);
    }
    if (rightValue) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...textMain);
      doc.text(rightValue, pageWidth - margin, y, { align: 'right' });
    }
    y += blockHeight + 4;
  };

  // Header card
  const headerHeight = 64;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.75);
  doc.roundedRect(margin, y, pageWidth - margin * 2, headerHeight, 8, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...textMain);
  doc.text('WoodLab Configurator', margin + 14, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...textMuted);
  const generatedAt = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  doc.text(`Generated ${generatedAt}`, margin + 14, y + 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...accent);
  doc.text(formatCurrency(finalTotal), pageWidth - margin - 14, y + 26, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...textMuted);
  doc.text('Estimated total with shipping shown', pageWidth - margin - 14, y + 40, { align: 'right' });
  y += headerHeight + 16;

  // Snapshot
  addSectionTitle('Snapshot');
  if (snapshotUrl) {
    const imgProps = doc.getImageProperties(snapshotUrl);
    const maxImgWidth = pageWidth - margin * 2;
    const maxImgHeight = 240;
    const ratio = imgProps.width / imgProps.height || 1;
    let imgWidth = maxImgWidth;
    let imgHeight = imgWidth / ratio;
    if (imgHeight > maxImgHeight) {
      imgHeight = maxImgHeight;
      imgWidth = imgHeight * ratio;
    }
    ensureSpace(imgHeight + 16);
    const imgX = margin + ((maxImgWidth - imgWidth) / 2);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin, y, maxImgWidth, imgHeight + 12, 6, 6, 'S');
    doc.addImage(snapshotUrl, 'PNG', imgX, y + 6, imgWidth, imgHeight);
    y += imgHeight + 24;
  } else {
    addKeyValue('Preview', 'Snapshot not captured yet');
  }

  // Selections
  addSectionTitle('Selections');
  if (!groups.length) {
    addKeyValue('Selections', 'No options selected');
  } else {
    groups.forEach((group) => {
      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...textMain);
      doc.text(group.title, margin + 2, y);
      y += 12;
      group.items.forEach((item) => {
        const valueText = item && (item.value || item.id);
        if (!valueText) return;
        const labelText = item.label && valueText ? `${item.label}: ${valueText}` : valueText;
        const lines = doc.splitTextToSize(labelText, pageWidth - margin * 2 - 96);
        const blockHeight = Math.max(12, lines.length * 12);
        ensureSpace(blockHeight + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...textMain);
        doc.text(lines, margin + 10, y);
        if (item.price) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...textMain);
          doc.text(String(item.price), pageWidth - margin, y, { align: 'right' });
        }
        y += blockHeight + 4;
      });
      y += 4;
    });
  }

  // Pricing
  addSectionTitle('Pricing');
  addKeyValue('Configured subtotal', formatCurrency(subtotal));
  addKeyValue('Shipping', shippingLabel);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accent);
  ensureSpace(14);
  doc.text('Estimated total', margin + 2, y);
  doc.text(formatCurrency(finalTotal), pageWidth - margin, y, { align: 'right' });
  y += 16;
  if (priceBreakdown.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...textMain);
    doc.text('Line items', margin + 2, y);
    y += 10;
    priceBreakdown.forEach((entry) => {
      const lines = doc.splitTextToSize(entry.label, pageWidth - margin * 2 - 88);
      const blockHeight = Math.max(12, lines.length * 12);
      ensureSpace(blockHeight + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...textMain);
      doc.text(lines, margin + 4, y);
      if (entry.price) {
        doc.setFont('helvetica', 'bold');
        doc.text(entry.price, pageWidth - margin, y, { align: 'right' });
      }
      y += blockHeight + 4;
    });
  }

  // Shipping details
  addSectionTitle('Shipping Details');
  addKeyValue('Mode', shippingDetails.mode || 'Not selected');
  const destinationLabel = shippingDetails.zip || shippingDetails.region
    ? [shippingDetails.zip, shippingDetails.region].filter(Boolean).join(' · ')
    : 'Not provided';
  addKeyValue('Destination', destinationLabel);
  addKeyValue('Estimate', shippingLabel);
  if (shippingDetails.flags && shippingDetails.flags.length) {
    addKeyValue('Services', shippingDetails.flags.join(', '));
  }
  if (shippingDetails.notes) {
    addKeyValue('Delivery notes', shippingDetails.notes);
  }

  // Notes / disclaimer
  addSectionTitle('Notes');
  const notes = [
    'Taxes are quoted separately.',
    'This PDF is a visual summary and is not a formal quotation or contract.'
  ];
  const noteLines = doc.splitTextToSize(notes.join(' '), pageWidth - margin * 2);
  ensureSpace(noteLines.length * 12 + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  doc.text(noteLines, margin, y);
  y += noteLines.length * 12 + 2;

  doc.save('woodlab-summary.pdf');
  pdfLog.info('Export finished');
  console.log('[PDF Export] Export complete');
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
  const warning = document.getElementById('summary-shipping-warning');
  const warningAction = document.getElementById('summary-shipping-warning-remove');
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

  const hasGlassTopAddon = () => {
    const addons = state.selections && state.selections.options && Array.isArray(state.selections.options.addon)
      ? state.selections.options.addon
      : [];
    return addons.includes('addon-glass-top');
  };

  const requestGlassTopRemoval = () => {
    const checkbox = document.querySelector('.addons-dropdown-option-checkbox[data-addon-id="addon-glass-top"]');
    if (checkbox && !checkbox.disabled) {
      if (checkbox.checked) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    }
    document.dispatchEvent(new CustomEvent('addon-toggled', {
      detail: { id: 'addon-glass-top', price: 0, checked: false }
    }));
  };

  const normalizeWarningFocus = () => {
    if (!warning) return;
    const active = document.activeElement;
    if (active && warning.contains(active)) {
      if (toggle) toggle.focus();
      else if (active instanceof HTMLElement) active.blur();
    }
  };

  const showWarning = () => {
    if (!warning) return;
    warning.hidden = false;
    warning.inert = false;
    warning.classList.remove('is-closing');
    warning.setAttribute('aria-hidden', 'false');
  };

  const hideWarningImmediate = () => {
    if (!warning) return;
    normalizeWarningFocus();
    warning.hidden = true;
    warning.inert = true;
    warning.classList.remove('is-closing');
    warning.setAttribute('aria-hidden', 'true');
  };

  const startWarningClose = () => {
    if (!warning || warning.hidden) return;
    normalizeWarningFocus();
    warning.inert = true;
    warning.classList.add('is-closing');
    warning.setAttribute('aria-hidden', 'true');
  };

  const updateState = () => {
    const glassLocked = hasGlassTopAddon();
    if (warning) {
      if (glassLocked) {
        if (!warning.classList.contains('is-closing')) showWarning();
      } else if (!warning.classList.contains('is-closing')) {
        hideWarningImmediate();
      }
    }
    if (international) {
      if (glassLocked && international.checked) international.checked = false;
      international.disabled = glassLocked;
      international.setAttribute('aria-disabled', glassLocked ? 'true' : 'false');
    }
    const localDelivery = !!(local && local.checked);
    const disabled = !!(quote && quote.checked) || !!(international && international.checked) || localDelivery;
    const effectiveDisabled = disabled || glassLocked;
    if (fields) {
      fields.classList.toggle('is-disabled', effectiveDisabled);
      fields.setAttribute('aria-disabled', effectiveDisabled ? 'true' : 'false');
    }
    if (zip) zip.disabled = effectiveDisabled;
    if (region) region.disabled = effectiveDisabled;
    const normalizedZip = zip ? normalizeZipInput(zip.value) : '';
    const showExtras = !effectiveDisabled && normalizedZip.length === 5;
    if (toggles) {
      toggles.classList.toggle('is-visible', showExtras);
      toggles.setAttribute('aria-hidden', showExtras ? 'false' : 'true');
    }
    [commercial, liftgate, whiteGlove].forEach((input) => {
      if (input) input.disabled = !showExtras;
    });
    const showNotes = !glassLocked && (localDelivery || (!!(whiteGlove && whiteGlove.checked) && showExtras));
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
      setEstimateText(formatCurrency(shippingCost), effectiveDisabled);
    } else {
      const accessorials = {
        residential: !!(commercial && commercial.checked),
        liftgate: !!(liftgate && liftgate.checked),
        whiteGlove: !!(whiteGlove && whiteGlove.checked)
      };
      const shippingEstimate = effectiveDisabled ? null : calculateShippingEstimate({
        zip: normalizedZip,
        selections: state.selections,
        accessorials
      });
      if (typeof shippingEstimate === 'number') {
        setEstimateText(formatCurrency(shippingEstimate), false);
      } else {
        setEstimateText(defaultEstimate || '--', effectiveDisabled);
      }
    }
  };

  const handleZipInput = async () => {
    if (!zip || !region) return;
    const normalized = normalizeZipInput(zip.value);
    if (zip.value !== normalized) zip.value = normalized;
    updateState();
    await updateRegionFromZip(normalized, region);
  };

  const updateTotal = () => {
    populateSummaryPanel();
  };

  const optionInputs = [quote, international, local].filter(Boolean);
  const handleOptionChange = (event) => {
    const changed = event.target;
    if (!changed || !changed.checked) {
      updateState();
      updateTotal();
      return;
    }
    optionInputs.forEach((input) => {
      if (input !== changed) input.checked = false;
    });
    updateState();
    updateTotal();
  };
  optionInputs.forEach((input) => {
    input.addEventListener('change', handleOptionChange);
  });

  if (toggle && body) {
    toggle.addEventListener('click', () => {
      setCollapsed(!section.classList.contains('is-collapsed'));
    });
  }
  const refreshEstimate = () => {
    updateState();
    updateTotal();
  };

  if (zip) zip.addEventListener('input', () => { handleZipInput(); updateTotal(); });
  if (commercial) commercial.addEventListener('change', refreshEstimate);
  if (liftgate) liftgate.addEventListener('change', refreshEstimate);
  if (whiteGlove) whiteGlove.addEventListener('change', refreshEstimate);
  document.addEventListener('statechange', refreshEstimate);
  if (warningAction) {
    warningAction.addEventListener('click', () => {
      startWarningClose();
      requestGlassTopRemoval();
    });
  }
  if (warning) {
    warning.addEventListener('transitionend', (event) => {
      if (event.propertyName !== 'max-height') return;
      if (!warning.classList.contains('is-closing')) return;
      if (hasGlassTopAddon()) {
        showWarning();
        return;
      }
      hideWarningImmediate();
    });
  }
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

const disclaimerDiv = document.createElement('div');
disclaimerDiv.className = 'summary-disclaimer';
disclaimerDiv.innerHTML = '<small>(This is not a formal quotation or contract sale price)</small>';

export default { populateSummaryPanel, init, initSummaryActions, restoreFromState };
