import { state } from '../state.js';
import { loadData } from '../dataLoader.js';
import { computePrice, getWaterfallEdgeCount } from '../pricing.js';
import { showConfirmDialog } from '../ui/confirmDialog.js';
import { buildExportMarkdown } from '../export.js';
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
  regionInput.value = region ? `${region} US` : 'Unknown';
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

export async function loadSummaryData(loadDataOverride) {
  if (summaryDataCache) return summaryDataCache;
  const loader = typeof loadDataOverride === 'function' ? loadDataOverride : loadData;
  const [models, designs, materials, colors, finish, dimensions, legs, tubeSizes, legFinishes, addons] = await Promise.all([
    loader('data/models.json'),
    loader('data/designs.json'),
    loader('data/materials.json'),
    loader('data/colors.json'),
    loader('data/finish.json'),
    loader('data/dimensions.json'),
    loader('data/legs.json'),
    loader('data/tube-sizes.json'),
    loader('data/leg-finish.json'),
    loader('data/addons.json')
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

export function formatCurrency(val) {
  if (typeof val !== 'number') return '$0';
  return `$${val.toLocaleString()}`;
}

function formatTotalCurrency(val) {
  if (typeof val !== 'number') return '$0 USD';
  return `$${val.toLocaleString()} USD`;
}

function parseCurrencyValue(text) {
  if (typeof text !== 'string') return null;
  const numeric = text.replace(/[^\d]/g, '');
  if (!numeric) return null;
  const parsed = parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

const SHIPPING_ACCESSORIAL_PRICES = {
  residential: 150,
  liftgate: 200,
  whiteGlove: 750
};
const SHIPPING_CRATE_COST = 350;

function getShippingAccessorySummary() {
  const toggles = document.getElementById('summary-shipping-toggles');
  const showExtras = !!(toggles && toggles.classList.contains('is-visible'));
  const commercial = document.getElementById('shipping-commercial');
  const liftgate = document.getElementById('shipping-liftgate');
  const whiteGlove = document.getElementById('shipping-white-glove');
  const items = [];

  if (showExtras) {
    items.push({ label: 'Crate + packaging', value: SHIPPING_CRATE_COST });
    if (commercial && commercial.checked) {
      items.push({ label: 'Residential delivery', value: SHIPPING_ACCESSORIAL_PRICES.residential });
    }
    if (liftgate && liftgate.checked) {
      items.push({ label: 'Liftgate required', value: SHIPPING_ACCESSORIAL_PRICES.liftgate });
    }
    if (whiteGlove && whiteGlove.checked) {
      items.push({ label: 'White glove service', value: SHIPPING_ACCESSORIAL_PRICES.whiteGlove });
    }
  }

  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.value) ? item.value : 0), 0);
  return { showExtras, items, total };
}

const POWER_STRIP_ADDONS = new Set(['addon-power-ac', 'addon-power-ac-usb', 'addon-power-ac-usb-usbc']);
const ADDITIONAL_CONNECTIVITY_ADDONS = new Set(['addon-ethernet', 'addon-hdmi']);

const COOKIE_DESIGN_ID = 'des-cookie';
const TABLETOP_THICKNESS_DEFAULT = 2;

const MATERIAL_TECH_SPECS = {
  'Black Walnut': { density: '35-38', hardness: '950-1100' },
  'Spalted Maple': { density: '30-40', hardness: '700-1100' },
  'American Elm': { density: '35-38', hardness: '800-900' },
  'Siberian Elm': { density: '30-38', hardness: '800-950' },
  'Sycamore': { density: '24-37', hardness: '720-850' },
  'Ash': { density: '30-42', hardness: '1200-1350' },
  'Claro Walnut': { density: '40+', hardness: '1000-1200' }
};

const COLOR_PIGMENT_SPECS = {
  'Multi-Blue': 'Ocean, Maui, Caribbean gradient',
  'Multi-Grey': 'Caviar, Dolphin, Pearl gradient',
  'Copper Blend': 'Espresso, Coral, Pineapple gradient',
  'Multi-Green': 'Jungle, Emerald, Candy Apple gradient',
  'Dark Grey': 'Caviar + Dolphin',
  'Caviar Black': 'Caviar',
  'Solid Black': 'Liquid Pigment, Solid Black',
  'Custom': 'Custom'
};

const COLOR_LAYOUT_SPECS = {
  'Multi-Blue': 'Gradient (dark on one end, light on the other)',
  'Multi-Grey': 'Gradient (dark on one end, light on the other)',
  'Copper Blend': 'Gradient (dark on one end, light on the other)',
  'Multi-Green': 'Gradient (dark on one end, light on the other)',
  'Dark Grey': 'Solid',
  'Caviar Black': 'Solid',
  'Solid Black': 'Solid',
  'Custom': 'Custom'
};

const FINISH_SHEEN_SPECS = {
  '2K Poly': { Satin: '20 sheen', Matte: '10 sheen', Gloss: '30 sheen' },
  'Natural Oil': { Satin: 'osmo Polyx-Oil (Satin) 3043 Clear Satin', Matte: 'osmo Polyx-Oil (Matte) 3031 Clear Matte', Gloss: 'osmo Polyx-Oil (Gloss) 3011 Clear Gloss' }
};

const FINISH_TINT_NOTES = {
  'Natural Oil': {
    Clear: 'osmo Wood Wax Finish Extra Thin 1101 Clear Satin',
    Natural: 'osmo Polyx-Oil 3051 Raw Matte',
    Darken: 'osmo Wood Wax Transparent Finish 3166 Walnut'
  }
};

const LEG_FINISH_BRANDS = {
  'Matte Black': 'Behr matte black B002144',
  'Satin Black': 'Behr satin black 346951',
  'Oil Rubbed Bronze': 'Behr oil rubbed bronze B060244',
  'Satin Bronze': 'Behr satin bronze 314560',
  'Gunmetal Grey': 'Behr gunmetal grey 353091',
  'Titanium Silver': 'Behr titanium silver 245220',
  'Raw Metal': 'Behr raw metal Clear Satin 285092'
};

const TECH_CABLE_LENGTH_DEFAULT = '12 ft';
const MOUNTING_PLATE_THICKNESS = 0.25;

const POWER_STRIP_SPECS = {
  'addon-power-ac': {
    powerRating: '125V 15A',
    ports: '6 AC (per 5 ft rail)',
    railLength: '5 ft or 3 ft',
    color: 'Black'
  },
  'addon-power-ac-usb': {
    powerRating: '125V 15A',
    ports: '3 AC + 6 USB (per 5 ft rail)',
    usbOutput: '5V 2.4A each',
    railLength: '5 ft or 3 ft',
    color: 'Black'
  },
  'addon-power-ac-usb-usbc': {
    powerRating: '125V 15A',
    ports: '3 AC + 3 USB + 3 USB-C (per 5 ft rail)',
    usbOutput: '5V 2.4A each',
    railLength: '5 ft or 3 ft',
    color: 'Black'
  }
};

const LIGHTING_SPECS_BY_ID = {
  'addon-lighting-white': {
    voltage: '24V',
    cri: '90+ CRI',
    color: '2700-6000K',
    control: 'Non-addressable',
    density: '320 LED/m'
  },
  'addon-lighting-color-basic': {
    voltage: '24V',
    color: 'RGBW',
    control: 'Non-addressable',
    density: '30-60 LED/m'
  },
  'addon-lighting-color-fx': {
    voltage: '12V',
    cri: '90+ CRI',
    color: 'RGBW',
    type: 'FCOB',
    control: 'Addressable (SPI control)',
    compatibility: 'App compatible',
    density: '100-400 LED/m'
  },
  'addon-lighting-custom': {
    voltage: '5V/12V/24V',
    cri: '91-94 CRI',
    color: 'CCT/RGB/RGBW',
    type: 'FCOB',
    control: 'Addressable (SPI/DMX512/Art-Net/WS)',
    compatibility: 'Custom effect software/TUYA compatible',
    density: 'Up to 720 LED/m'
  }
};

const getTechCableLengthLabel = (customLength) => {
  const normalized = typeof customLength === 'string' ? customLength.trim() : customLength;
  if (normalized) return `${normalized} ft`;
  return TECH_CABLE_LENGTH_DEFAULT;
};

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

function calculateShippingEstimate({ zip, selections }) {
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

  const roundedUp = Math.ceil(estimate / 50) * 50;
  return Number.isFinite(roundedUp) ? roundedUp : null;
}

function getShippingCost() {
  const estimate = document.getElementById('shipping-estimate');
  if (!estimate) return 0;
  const baseValue = parseCurrencyValue(estimate.textContent.trim());
  if (baseValue === null) return 0;
  const accessorySummary = getShippingAccessorySummary();
  return baseValue + accessorySummary.total;
}

export function getShippingDetails() {
  const quote = document.getElementById('shipping-quote-separately');
  const international = document.getElementById('shipping-international');
  const local = document.getElementById('shipping-local-delivery');
  const zip = document.getElementById('shipping-zip');
  const region = document.getElementById('shipping-region');
  const estimate = document.getElementById('shipping-estimate');
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
  const estimateValue = parseCurrencyValue(estimateText);
  const accessorySummary = getShippingAccessorySummary();
  const totalValue = typeof estimateValue === 'number' ? estimateValue + accessorySummary.total : 0;

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
    totalValue,
    accessoryItems: accessorySummary.items,
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

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return null;
  if (decimals <= 0) return Math.round(value).toString();
  return value.toFixed(decimals);
}

function formatInches(value, decimals = 0) {
  const formatted = formatNumber(value, decimals);
  return formatted ? `${formatted} in` : 'TBD';
}

function formatDimensionPair(length, width) {
  if (!Number.isFinite(length) || !Number.isFinite(width)) return 'TBD';
  return `${formatNumber(length)} in x ${formatNumber(width)} in`;
}

function formatDimensionTriple(length, width, height) {
  if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(height)) return 'TBD';
  return `${formatNumber(length)} in x ${formatNumber(width)} in x ${formatNumber(height)} in`;
}

function formatWeight(value, decimals = 0) {
  const formatted = formatNumber(value, decimals);
  return formatted ? `${formatted} lbs` : 'TBD';
}

function getMaterialSpecs(title) {
  if (!title) return null;
  return MATERIAL_TECH_SPECS[title] || null;
}

function getColorSpecs(title) {
  if (!title) return null;
  return {
    pigment: COLOR_PIGMENT_SPECS[title] || null,
    layout: COLOR_LAYOUT_SPECS[title] || null
  };
}

function getFinishSheenSpec(coatingTitle, sheenTitle) {
  if (!sheenTitle) return null;
  if (coatingTitle === 'Natural Oil') return 'Osmo Polyx-Oil';
  const spec = FINISH_SHEEN_SPECS[coatingTitle];
  if (spec && spec[sheenTitle]) return `${sheenTitle} (${spec[sheenTitle]})`;
  return sheenTitle;
}

function getFinishTintNote(coatingTitle, tintTitle) {
  if (!tintTitle) return null;
  if (coatingTitle === '2K Poly' && tintTitle !== 'Clear') return 'Custom tint';
  const lookup = FINISH_TINT_NOTES[coatingTitle];
  if (lookup && lookup[tintTitle]) return lookup[tintTitle];
  return null;
}

function parseTubeDimensions(title) {
  if (!title) return [];
  const matches = title.match(/[\d.]+/g);
  if (!matches) return [];
  return matches.map(val => Number(val)).filter(Number.isFinite);
}

function getLegWidthForTable(width) {
  if (!Number.isFinite(width)) return null;
  if (width <= 36) return 26;
  if (width <= 42) return 28;
  if (width <= 48) return 32;
  return Math.max(0, width - 10);
}

function getLegSideSetbackLabel({ width, legWidth, plateLength, legId, designId }) {
  const fallback = { leg: 'TBD', plate: 'TBD' };
  if (!Number.isFinite(width)) return fallback;
  if (legId === 'leg-sample-02') return { leg: '0.25 in', plate: '0.25 in' };
  if (legId === 'leg-sample-08' && designId === 'des-round') return { leg: '12-14 in', plate: '12-14 in' };
  if (legId === 'leg-sample-08' && designId === 'des-cookie') return { leg: '12+ in', plate: '12+ in' };
  const formatSideSetback = (value) => formatInches(value, Number.isInteger(value) ? 0 : 1);
  const legSetback = Number.isFinite(legWidth) ? Math.max(0, (width - legWidth) / 2) : null;
  const plateSetback = Number.isFinite(plateLength) ? Math.max(0, (width - plateLength) / 2) : null;
  return {
    leg: Number.isFinite(legSetback) ? formatSideSetback(legSetback) : 'TBD',
    plate: Number.isFinite(plateSetback) ? formatSideSetback(plateSetback) : 'TBD'
  };
}

function getPlateEndSetbackLabel(legEndSetback) {
  if (!legEndSetback || legEndSetback === 'TBD') return 'TBD';
  const rangeMatch = legEndSetback.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*in$/);
  if (rangeMatch) {
    const min = Math.max(0, Number(rangeMatch[1]) - 2);
    const max = Math.max(0, Number(rangeMatch[2]) - 2);
    return `${formatNumber(min)}-${formatNumber(max)} in`;
  }
  const plusMatch = legEndSetback.match(/^(\d+(?:\.\d+)?)\+\s*in$/);
  if (plusMatch) {
    const value = Math.max(0, Number(plusMatch[1]) - 2);
    return `${formatNumber(value)}+ in`;
  }
  const singleMatch = legEndSetback.match(/^(\d+(?:\.\d+)?)\s*in$/);
  if (singleMatch) {
    const value = Math.max(0, Number(singleMatch[1]) - 2);
    return `${formatNumber(value)} in`;
  }
  return legEndSetback;
}

function parseSetbackValue(setbackLabel) {
  if (!setbackLabel || setbackLabel === 'TBD') return null;
  const rangeMatch = setbackLabel.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*in$/);
  if (rangeMatch) return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
  const plusMatch = setbackLabel.match(/^(\d+(?:\.\d+)?)\+\s*in$/);
  if (plusMatch) return Number(plusMatch[1]);
  const singleMatch = setbackLabel.match(/^(\d+(?:\.\d+)?)\s*in$/);
  if (singleMatch) return Number(singleMatch[1]);
  return null;
}

function calculateEmptyCrateWeight(lengthIn, widthIn, heightIn) {
  if (!Number.isFinite(lengthIn) || !Number.isFinite(widthIn) || !Number.isFinite(heightIn)) return null;
  const skidH = 5.5;
  const crossH = 3.5;
  const top2x2H = 1.5;
  const sideHIn = Math.max(0, heightIn - skidH - crossH - top2x2H);

  const lengthFt = lengthIn / 12;
  const widthFt = widthIn / 12;
  const sideHFt = sideHIn / 12;

  const wOsbSqFt = 46 / 32;
  const w2x4Ft = 11 / 8;
  const w2x6Ft = 16 / 8;
  const w2x2Ft = w2x4Ft / 2;

  const runners = Math.ceil(widthIn / 24) + 1;
  const cross = Math.ceil(lengthIn / 24) + 1;
  const studL = Math.ceil(lengthIn / 48) + 1;
  const studW = Math.ceil(widthIn / 48) + 1;
  const studs = 2 * studL + 2 * studW - 4;
  const topBatt = Math.ceil(lengthIn / 48) + 1;

  const osbAreaFt2 = 2 * (lengthFt * widthFt)
    + 2 * (lengthFt * sideHFt)
    + 2 * (widthFt * sideHFt);
  const osbLb = osbAreaFt2 * wOsbSqFt;

  const lf2x6 = runners * lengthFt;
  const lf2x4 = cross * widthFt;
  const lf2x2 = 2 * (lengthFt + widthFt) + studs * sideHFt + topBatt * widthFt;
  const lumberLb = lf2x6 * w2x6Ft + lf2x4 * w2x4Ft + lf2x2 * w2x2Ft;

  const total = (osbLb + lumberLb) * 1.05;
  return Math.round(total * 10) / 10;
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

export function buildOptionGroups(selections, summaryData) {
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

  const tabletopItems = [];
  addOptionItem(tabletopItems, 'Material', opts.material, summaryData && opts.material ? summaryData.materials.get(opts.material) : null, 'material');
  addOptionItem(tabletopItems, 'Color', opts.color, summaryData && opts.color ? summaryData.colors.get(opts.color) : null, 'color');
  const customColorNote = typeof opts.customColorNote === 'string' ? opts.customColorNote.trim() : '';
  if (customColorNote) tabletopItems.push({ label: 'Custom Color Note', value: customColorNote, type: 'note' });
  addOptionItem(tabletopItems, 'Finish Coating', opts['finish-coating'], summaryData && opts['finish-coating'] ? summaryData.finishCoatings.get(opts['finish-coating']) : null, 'finish-coating');
  addOptionItem(tabletopItems, 'Finish Sheen', opts['finish-sheen'], summaryData && opts['finish-sheen'] ? summaryData.finishSheens.get(opts['finish-sheen']) : null, 'finish-sheen');
  addOptionItem(tabletopItems, 'Finish Tint', opts['finish-tint'], summaryData && opts['finish-tint'] ? summaryData.finishTints.get(opts['finish-tint']) : null, 'finish-tint');
  if (tabletopItems.length) groups.push({ title: 'Tabletop', items: tabletopItems });

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

export function buildBreakdownPriceMap(priceData) {
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

export function applyBreakdownPrices(groups, priceMap) {
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

export function buildPriceBreakdown(priceData) {
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
  total.textContent = formatTotalCurrency(finalTotal);
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

async function writeClipboardText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('Clipboard copy failed');
}

function setCopyStatus(message, isError = false) {
  const statusEl = document.getElementById('config-copy-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', isError);
  statusEl.hidden = !message;
}

async function copyConfigMarkdown() {
  setCopyStatus('');
  try {
    const markdown = await buildExportMarkdown(state, loadData);
    await writeClipboardText(markdown);
    setCopyStatus('Configuration copied as markdown.');
  } catch (e) {
    log.warn('Copy configuration failed', e);
    setCopyStatus('Unable to copy configuration. Please try again.', true);
  }
}

async function loadLogoDataUrl() {
  const logoPath = 'assets/icons/WoodLab_logo_-_official.png';
  try {
    const response = await fetch(logoPath);
    if (!response.ok) throw new Error(`Logo fetch failed: ${response.status}`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    pdfLog.warn('Logo load failed', e);
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
  const logoDataUrl = await loadLogoDataUrl();
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

  const subtotal = priceData && typeof priceData.total === 'number'
    ? priceData.total
    : (state.pricing && typeof state.pricing.total === 'number' ? state.pricing.total : 0);

  const shippingDetails = getShippingDetails();
  const shippingTotal = typeof shippingDetails.totalValue === 'number' ? shippingDetails.totalValue : 0;
  const hasFreightEstimate = Number.isFinite(shippingDetails.estimateValue);
  const shippingLabel = shippingDetails.mode === 'Quote separately'
    ? 'Quoted separately'
    : (hasFreightEstimate ? formatCurrency(shippingDetails.estimateValue) : (shippingDetails.estimateText || 'Pending'));
  const finalTotal = subtotal + shippingTotal;

  const doc = new jsPDFactory({ unit: 'pt', format: 'a4' });
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const accent = [37, 99, 235];
  const textMain = [17, 24, 39];
  const textMuted = [107, 114, 128];
  const textValue = [55, 65, 81];
  let y = margin;

  const ensureSpace = (needed = 24) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const sectionGap = 10;
  const addSectionTitle = (title) => {
    if (y !== margin) {
      ensureSpace(24 + sectionGap);
      y += sectionGap;
    } else {
      ensureSpace(24);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...textMain);
    doc.text(title, margin, y);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.75);
    doc.line(margin, y + 4, margin + 52, y + 4);
    y += 18;
  };

  const addKeyValue = (label, value, rightValue) => {
    if (!value && !rightValue) return;
    const bodyWidth = pageWidth - margin * 2;
    const labelColumnWidth = 72;
    const rightColumnWidth = rightValue ? 96 : 0;
    const textWidth = Math.max(40, bodyWidth - labelColumnWidth - rightColumnWidth);
    const valueText = value ? String(value) : '';
    const lines = valueText ? doc.splitTextToSize(valueText, textWidth) : [];
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
      doc.text(lines, margin + labelColumnWidth, y);
    }
    if (rightValue) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...textMain);
      doc.text(rightValue, pageWidth - margin, y, { align: 'right' });
    }
    y += blockHeight + 4;
  };

  const listIndent = 10;
  const priceColumnWidth = 88;
  const listTextWidth = pageWidth - margin * 2 - listIndent - priceColumnWidth;
  const listLineHeight = 12;
  const listRowGap = 4;

  const addListGroupTitle = (title, gapBefore = 0, nextRowHeight = listLineHeight) => {
    ensureSpace(16 + nextRowHeight + gapBefore);
    if (gapBefore) y += gapBefore;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...textMain);
    doc.text(title, margin + 2, y);
    y += 12;
  };

  const addListItem = (labelText, price) => {
    const lines = doc.splitTextToSize(labelText, listTextWidth);
    const blockHeight = Math.max(listLineHeight, lines.length * listLineHeight);
    ensureSpace(blockHeight + listRowGap);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...textMain);
    doc.text(lines, margin + listIndent, y);
    if (price) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textMain);
      doc.text(String(price), pageWidth - margin, y, { align: 'right' });
    }
    y += blockHeight + listRowGap;
  };

  const addSummaryRow = (label, value) => {
    ensureSpace(14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...textMain);
    doc.text(label, margin + 2, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMain);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 14;
  };

  const techRowPadding = 6;
  const techLabelWidth = 168;
  const techValueWidth = pageWidth - margin * 2 - techLabelWidth;
  const techLineColor = [229, 231, 235];
  const techSubheadingFontSize = 10;
  const techSubheadingTopGap = 14;
  const techSubheadingBottomGap = 0;
  const techSubheadingLineHeight = 12;

  const addTechSubheading = (title) => {
    ensureSpace(techSubheadingTopGap + techSubheadingBottomGap + techSubheadingLineHeight);
    y += techSubheadingTopGap;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(techSubheadingFontSize);
    doc.setTextColor(...textMain);
    doc.text(title, margin + 2, y);
    y += techSubheadingLineHeight + techSubheadingBottomGap;
  };

  const addTechRow = (label, value) => {
    if (!value) return;
    const lines = Array.isArray(value)
      ? value.flatMap(item => doc.splitTextToSize(String(item), techValueWidth))
      : doc.splitTextToSize(String(value), techValueWidth);
    const lineHeight = 12;
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight);
    const rowHeight = blockHeight + techRowPadding * 2;
    ensureSpace(rowHeight + 2);
    doc.setDrawColor(...techLineColor);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    const textY = y + techRowPadding + 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...textMain);
    doc.text(label, margin + 2, textY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textValue);
    doc.text(lines, pageWidth - margin, textY, { align: 'right' });
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    y += rowHeight;
  };

  const modelEntry = summaryData && summaryData.models ? summaryData.models.get(selections.model) : null;
  const designEntry = summaryData && summaryData.designs ? summaryData.designs.get(selections.design) : null;
  const modelName = selections.model ? getEntryTitle(modelEntry, selections.model) : 'Model';
  const designName = selections.design ? getEntryTitle(designEntry, selections.design) : 'Design';
  const headerTitle = `WoodLab Custom ${designName} ${modelName}`;

  // Header card
  if (logoDataUrl) {
    const logoProps = doc.getImageProperties(logoDataUrl);
    const maxLogoWidth = pageWidth - margin * 2;
    const maxLogoHeight = 48;
    const baseLogoWidth = Math.min(160, maxLogoWidth);
    const logoRatio = logoProps.width / logoProps.height || 1;
    let logoWidth = baseLogoWidth;
    let logoHeight = logoWidth / logoRatio;
    if (logoHeight > maxLogoHeight) {
      logoHeight = maxLogoHeight;
      logoWidth = logoHeight * logoRatio;
    }
    ensureSpace(logoHeight + 12);
    const logoX = margin + ((pageWidth - margin * 2 - logoWidth) / 2);
    doc.addImage(logoDataUrl, 'PNG', logoX, y, logoWidth, logoHeight);
    y += logoHeight + 12;
  }
  const headerHeight = 64;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.75);
  doc.roundedRect(margin, y, pageWidth - margin * 2, headerHeight, 8, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...textMain);
  doc.text(headerTitle, margin + 14, y + 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...accent);
  doc.text(formatTotalCurrency(finalTotal), pageWidth - margin - 14, y + 26, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...textMuted);
  doc.text('Estimated total', pageWidth - margin - 14, y + 40, { align: 'right' });
  const generatedAt = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  doc.text(`Generated ${generatedAt}`, pageWidth - margin - 14, y + 52, { align: 'right' });
  y += headerHeight + 16;

  // Preview
  addSectionTitle('Preview');
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

  // Configuration
  addSectionTitle('Configuration');
  const optionRows = [];
  groups.forEach((group) => {
    if (!group || !Array.isArray(group.items)) return;
    const groupItems = group.items
      .map((item) => {
        const labelText = item && item.label ? String(item.label) : '';
        const valueText = item && item.value !== undefined && item.value !== null ? String(item.value) : '';
        const fallbackId = item && item.id ? String(item.id) : '';
        const combinedText = labelText && valueText
          ? `${labelText}: ${valueText}`
          : (labelText || valueText || fallbackId);
        if (!combinedText) return null;
        return { label: combinedText, price: item.price };
      })
      .filter(Boolean);
    if (!groupItems.length) return;
    optionRows.push({ type: 'group', title: group.title });
    groupItems.forEach((entry) => optionRows.push({ type: 'item', ...entry }));
  });

  if (!optionRows.length) {
    addKeyValue('Selections', 'No options selected');
  } else {
    let hasGroupTitle = false;
    let hasGroupItems = false;
    const addGroupSeparator = () => {
      if (!hasGroupItems) return;
      ensureSpace(10);
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(margin + listIndent, y, pageWidth - margin, y);
      y += 6;
      hasGroupItems = false;
    };
    optionRows.forEach((row) => {
      if (row.type === 'group') {
        if (hasGroupTitle) addGroupSeparator();
        addListGroupTitle(row.title, hasGroupTitle ? 4 : 0);
        hasGroupTitle = true;
        return;
      }
      addListItem(row.label, row.price);
      hasGroupItems = true;
    });
    addGroupSeparator();
  }

  const zipLabel = shippingDetails.zip ? shippingDetails.zip : 'TBD';
  const accessoryItems = Array.isArray(shippingDetails.accessoryItems) ? shippingDetails.accessoryItems : [];

  // Shipping details
  addListGroupTitle('Shipping', 10);
  addListItem(`Mode: ${shippingDetails.mode || 'Not selected'}`);
  addListItem(`Shipping to ${zipLabel}`, shippingLabel || 'Pending');
  accessoryItems.forEach((item) => {
    if (!item || !item.label) return;
    const priceText = Number.isFinite(item.value) ? formatCurrency(item.value) : '';
    addListItem(item.label, priceText);
  });
  if (shippingDetails.notes) {
    addListItem(`Delivery notes: ${shippingDetails.notes}`);
  }

  ensureSpace(20);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(1.5);
  doc.line(margin + listIndent, y, pageWidth - margin, y);
  y += 10;
  addSummaryRow('Taxes', 'Quoted separately');
  ensureSpace(22);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accent);
  doc.text('Total', margin + 2, y);
  doc.text(formatTotalCurrency(finalTotal), pageWidth - margin, y, { align: 'right' });
  y += 16;

  // Disclosure
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

  // Notes
  addSectionTitle('Notes');
  ensureSpace(8);
  y += 8;

  doc.addPage();
  y = margin;
  addSectionTitle('Technical Specifications');
  const opts = selections.options || {};
  const dimensionDetail = selections.dimensionsDetail || {};
  const length = typeof dimensionDetail.length === 'number' ? dimensionDetail.length : null;
  const width = typeof dimensionDetail.width === 'number' ? dimensionDetail.width : null;
  const height = resolveTableHeight(selections);
  const isCookieDesign = selections.design === COOKIE_DESIGN_ID;
  const tabletopThickness = isCookieDesign ? null : TABLETOP_THICKNESS_DEFAULT;
  const tabletopDimensionsLabel = formatDimensionPair(length, width);
  const tabletopThicknessLabel = isCookieDesign ? 'TBD (quoted separately)' : `${TABLETOP_THICKNESS_DEFAULT} in +/- 0.25 in`;
  const overallDimensionsLabel = formatDimensionTriple(length, width, height);
  const addons = Array.isArray(opts.addon) ? opts.addon : [];
  const waterfallCount = getWaterfallEdgeCount({ selections });
  const edgeDetails = [];
  if (addons.includes('addon-live-edge')) edgeDetails.push('Live edge');
  if (addons.includes('addon-rounded-corners')) edgeDetails.push('Rounded corners');
  if (addons.includes('addon-angled-corners')) edgeDetails.push('Angled corners');
  if (addons.includes('addon-chamfered-edges')) edgeDetails.push('Chamfered edges');
  if (addons.includes('addon-squoval')) edgeDetails.push('Squoval');
  if (waterfallCount > 0) edgeDetails.push(waterfallCount === 1 ? 'Single waterfall' : 'Double waterfall');
  const edgeDetailLabel = edgeDetails.length ? edgeDetails.join(', ') : 'Standard';

  const materialEntry = summaryData && summaryData.materials ? summaryData.materials.get(opts.material) : null;
  const materialTitle = getEntryTitle(materialEntry, opts.material) || 'TBD';
  const materialSpecs = getMaterialSpecs(materialTitle);

  const finishCoatingEntry = summaryData && summaryData.finishCoatings ? summaryData.finishCoatings.get(opts['finish-coating']) : null;
  const finishSheenEntry = summaryData && summaryData.finishSheens ? summaryData.finishSheens.get(opts['finish-sheen']) : null;
  const finishTintEntry = summaryData && summaryData.finishTints ? summaryData.finishTints.get(opts['finish-tint']) : null;
  const finishCoatingTitle = getEntryTitle(finishCoatingEntry, opts['finish-coating']);
  const finishSheenTitle = getEntryTitle(finishSheenEntry, opts['finish-sheen']);
  const finishTintTitle = getEntryTitle(finishTintEntry, opts['finish-tint']);
  const finishTypeLabel = finishCoatingTitle === '2K Poly'
    ? '2K Polyurethane'
    : (finishCoatingTitle === 'Natural Oil' ? 'Osmo Natural Oil' : (finishCoatingTitle || 'TBD'));
  const finishSheenLabel = getFinishSheenSpec(finishCoatingTitle, finishSheenTitle) || finishSheenTitle || 'TBD';
  const finishTintLabel = finishTintTitle || 'TBD';
  const finishTintNote = getFinishTintNote(finishCoatingTitle, finishTintTitle);
  const finishCoatRows = [];
  if (finishTintTitle === 'Custom') {
    finishCoatRows.push({ label: 'Finish Base Coat', value: 'TBD' });
  } else if (finishCoatingTitle === '2K Poly') {
    finishCoatRows.push({ label: 'Finish Base Coat', value: '2K Polyurethane' });
  } else if (finishCoatingTitle === 'Natural Oil') {
    finishCoatRows.push({ label: 'Finish Base Coat', value: finishTintNote || 'Osmo Natural Oil base coat' });
    if (finishTintTitle === 'Natural') {
      finishCoatRows.push({ label: 'Finish Second Coat', value: finishTintNote || 'Osmo Natural Oil second coat' });
    } else {
      finishCoatRows.push({ label: 'Finish Second Coat', value: FINISH_SHEEN_SPECS['Natural Oil'][finishSheenTitle] || 'Osmo Natural Oil second coat' });
    }
    finishCoatRows.push({ label: 'Finish Top Coat', value: 'Ceramic Pro Strong 1000 top coat' });
  } else if (finishCoatingTitle) {
    finishCoatRows.push({ label: 'Finish Base Coat', value: finishTypeLabel });
  }

  const colorEntry = summaryData && summaryData.colors ? summaryData.colors.get(opts.color) : null;
  const colorTitle = getEntryTitle(colorEntry, opts.color);
  const colorSpecs = getColorSpecs(colorTitle);

  const legEntry = summaryData && summaryData.legs ? summaryData.legs.get(opts.legs) : null;
  const tubeEntry = summaryData && summaryData.tubeSizes ? summaryData.tubeSizes.get(opts['tube-size']) : null;
  const legFinishEntry = summaryData && summaryData.legFinishes ? summaryData.legFinishes.get(opts['leg-finish']) : null;
  const legTitle = getEntryTitle(legEntry, opts.legs);
  const tubeTitle = getEntryTitle(tubeEntry, opts['tube-size']);
  const legFinishTitle = getEntryTitle(legFinishEntry, opts['leg-finish']);
  const legFinishBrand = LEG_FINISH_BRANDS[legFinishTitle];
  const legFinishLabel = legFinishBrand ? `${legFinishTitle} (${legFinishBrand})` : (legFinishTitle || 'TBD');
  const hasLegs = opts.legs && opts.legs !== 'leg-none' && waterfallCount < 2;
  const legStyleLabel = hasLegs ? (legTitle || 'TBD') : (waterfallCount >= 2 ? 'Replaced by waterfall' : (legTitle || 'None'));
  const legWidth = getLegWidthForTable(width);
  const legHeight = Number.isFinite(height) && Number.isFinite(tabletopThickness)
    ? Math.max(0, height - tabletopThickness)
    : null;
  const legCount = (hasLegs && Number.isFinite(length)) ? getLegCount(length) : null;
  let legEndSetback = 'TBD';
  let plateEndSetback = 'TBD';
  if (hasLegs) {
    if (selections.model === 'mdl-coffee') legEndSetback = '5-7 in';
    else if (Number.isFinite(length) && length >= 120) legEndSetback = '18-20 in';
    else legEndSetback = '12-14 in';
    plateEndSetback = getPlateEndSetbackLabel(legEndSetback);
  }
  const tubeDims = parseTubeDimensions(tubeTitle);
  const tubeDepth = tubeDims.length ? Math.max(...tubeDims) : null;
  const legHeightWithoutPlate = Number.isFinite(legHeight)
    ? Math.max(0, legHeight - MOUNTING_PLATE_THICKNESS)
    : null;
  const legDimensions = (hasLegs && Number.isFinite(legWidth) && Number.isFinite(tubeDepth) && Number.isFinite(legHeightWithoutPlate))
    ? `${formatNumber(legWidth)} in W x ${formatNumber(tubeDepth)} in D x ${formatNumber(legHeightWithoutPlate)} in H`
    : 'TBD';
  const plateLength = Number.isFinite(width) ? Math.max(0, width - 6) : null;
  const legDimensionsWithPlate = (hasLegs && Number.isFinite(plateLength) && Number.isFinite(legHeight))
    ? `${formatNumber(plateLength)} in L x 6 in W x ${formatNumber(legHeight)} in H`
    : 'TBD';
  const plateSize = hasLegs && Number.isFinite(plateLength)
    ? `${formatNumber(plateLength)} in L x 6 in W x 0.25 in T`
    : 'TBD';
  let legSideSetback = 'TBD';
  let plateSideSetback = 'TBD';
  if (hasLegs) {
    const sideSetbacks = getLegSideSetbackLabel({
      width,
      legWidth,
      plateLength,
      legId: opts.legs,
      designId: selections.design
    });
    legSideSetback = sideSetbacks.leg;
    plateSideSetback = sideSetbacks.plate;
  }
  let legException = null;
  if (opts.legs === 'leg-sample-02') legException = 'Cube bases have 0.25 in setback on all sides';
  if (opts.legs === 'leg-sample-08' && selections.design === 'des-round') {
    legException = 'Round tripods have 12-14 in setback on all sides';
  }
  if (opts.legs === 'leg-sample-08' && selections.design === 'des-cookie') {
    legException = 'Cookie tripods have 12+ in even setback; height TBD';
  }

  let estimatedTotalWeight = null;
  let estimatedTabletopWeight = null;
  let estimatedLegWeight = null;
  if (Number.isFinite(length) && Number.isFinite(width) && Number.isFinite(height)) {
    estimatedTabletopWeight = getTabletopWeight({ length, width, height, waterfallCount });
    estimatedLegWeight = getLegWeight({
      legId: opts.legs,
      tubeId: opts['tube-size'],
      length,
      width,
      height,
      waterfallCount
    });
    const addonWeight = getAddonWeight(addons, length, width);
    const rawWeight = estimatedTabletopWeight + estimatedLegWeight + addonWeight;
    if (Number.isFinite(rawWeight)) estimatedTotalWeight = rawWeight;
  }
  const legWeightPerLeg = Number.isFinite(estimatedLegWeight) && Number.isFinite(legCount) && legCount > 0
    ? estimatedLegWeight / legCount
    : null;

  const crateLength = Number.isFinite(length) ? length + 7 : null;
  const crateWidth = Number.isFinite(width) ? width + 7 : null;
  const crateHeight = Number.isFinite(height) ? height + 10 : null;
  const crateDimensions = formatDimensionTriple(crateLength, crateWidth, crateHeight);
  const emptyCrateWeight = calculateEmptyCrateWeight(crateLength, crateWidth, crateHeight);
  const loadedCrateWeight = Number.isFinite(emptyCrateWeight) && Number.isFinite(estimatedTotalWeight)
    ? emptyCrateWeight + estimatedTotalWeight
    : null;

  addTechRow('Tabletop Dimensions', tabletopDimensionsLabel);
  addTechRow('Overall Dimensions (with legs)', overallDimensionsLabel);
  addTechRow('Estimated Tabletop Weight', formatWeight(estimatedTabletopWeight));
  addTechRow('Estimated Total Weight', formatWeight(estimatedTotalWeight));
  addTechRow('Tabletop Thickness', tabletopThicknessLabel);
  if (addons.includes('addon-rounded-corners')) addTechRow('Rounded Corners', '4 in radius');
  if (addons.includes('addon-angled-corners')) addTechRow('Angled Corners', 'TBD');
  if (waterfallCount > 0) {
    const dropLabel = Number.isFinite(height) ? formatInches(height) : 'TBD';
    const calcLabel = (Number.isFinite(width) && Number.isFinite(height))
      ? ` (calc 2 x ${formatNumber(width)} in x ${formatNumber(height)} in)`
      : ' (calc 2 x width x height)';
    addTechRow('Waterfall Edge', `${waterfallCount === 1 ? 'Single waterfall' : 'Double waterfall'}, drop ${dropLabel}${calcLabel}`);
  }

  addTechSubheading('Tabletop');
  addTechRow('Material', materialTitle || 'TBD');
  addTechRow('Material Density (lb/ft^3)', materialSpecs ? materialSpecs.density : 'TBD');
  addTechRow('Material Hardness (Janka, lbf)', materialSpecs ? materialSpecs.hardness : 'TBD');
  addTechRow('Moisture Content (WMC)', '5-10%');

  addTechRow('Finish Type', finishTypeLabel);
  addTechRow('Finish Sheen', finishSheenLabel);
  addTechRow('Finish Tint', finishTintLabel);
  finishCoatRows.forEach((row) => addTechRow(row.label, row.value));
  addTechRow('Base Epoxy Layer', 'Seal coat <0.25 in');
  addTechRow('Main Epoxy Layer', 'River 2-2.5 in');
  addTechRow('Pigment Composition', (colorSpecs && colorSpecs.pigment) || (colorTitle ? 'Custom' : 'TBD'));
  addTechRow('Color Layout', (colorSpecs && colorSpecs.layout) || (colorTitle ? 'Custom' : 'TBD'));

  addTechSubheading('Hardware');
  addTechRow('Leg Style', legStyleLabel);
  if (hasLegs) {
    addTechRow('Leg Material', 'HSS steel');
    addTechRow('Leg Tube Size', tubeTitle || 'TBD');
    addTechRow('Leg Tube Wall Thickness', '14 gauge (0.083 in)');
    addTechRow('Legs (qty)', Number.isFinite(legCount) ? String(legCount) : 'TBD');
    if (legException) addTechRow('Leg Exceptions', legException);
    addTechRow('Leg Dimensions (without mounting plate)', legDimensions);
    addTechRow('Leg Dimensions (with mounting plate)', legDimensionsWithPlate);
    addTechRow('Mounting Plate Size', plateSize);
    addTechRow('Mounting Hardware Bolts', '3/8"-16 x 1"/1.25"Button Head Bolt (5-8 per leg)');
    addTechRow('Bolt Head Socket', '7/32" Socket');
    addTechRow('Mounting Hardware Inserts', '3/8"-16 ID 1/2" OD x 5/8"/1" Brass Inserts (5-8 per leg)');
    addTechRow('Leg Finish Color', legFinishLabel);
    addTechRow('Leg Weight (per leg)', formatWeight(legWeightPerLeg));
    addTechRow('Setback to Leg (from end)', legEndSetback);
    addTechRow('Setback to Plate (from end)', plateEndSetback);
    addTechRow('Setback to Leg (from side)', legSideSetback);
    addTechRow('Setback to Plate (from side)', plateSideSetback);
    if (Number.isFinite(length) && length > 72) {
      const plateSetbackValue = parseSetbackValue(plateEndSetback);
      const channelLength = Number.isFinite(plateSetbackValue)
        ? Math.max(0, length - plateSetbackValue * 2)
        : null;
      const screwsPerChannel = Number.isFinite(channelLength)
        ? Math.max(1, Math.round(channelLength / 8))
        : null;
      addTechRow('Undercarriage', 'Steel U-Channel');
      addTechRow('Channel Profile', 'Low profile, routered into tabletop');
      addTechRow('Channel Size', '3x1 in');
      addTechRow('Channel Length', Number.isFinite(channelLength) ? `${formatNumber(channelLength)} in` : 'TBD');
      addTechRow('Channel Color', 'Matte Black');
      addTechRow('Channel Hardware', '#10 1-1/4" Black Oxide Button Head Phillips');
      addTechRow(
        'Screws per channel',
        Number.isFinite(screwsPerChannel) ? `${formatNumber(screwsPerChannel)} +/- 3` : 'TBD'
      );
    }
  }

  const powerStripId = addons.find(id => POWER_STRIP_SPECS[id]);
  const powerStripEntry = powerStripId && summaryData ? summaryData.addons.get(powerStripId) : null;
  const powerStripTitle = powerStripEntry ? powerStripEntry.title : 'Power Strip';
  const lightingAddonId = addons.find(id => id && id.startsWith('addon-lighting-'));
  const lightingEntry = lightingAddonId && summaryData ? summaryData.addons.get(lightingAddonId) : null;
  const lightingTitle = lightingEntry ? lightingEntry.title : 'Lighting';
  const hasTechAddons = !!powerStripId ||
    addons.includes('addon-wireless-charging') ||
    addons.includes('addon-ethernet') ||
    addons.includes('addon-hdmi') ||
    !!lightingAddonId ||
    addons.includes('addon-custom-tech');

  const hasAddonSpecs = addons.includes('addon-glass-top') ||
    addons.includes('addon-wireless-charging') ||
    addons.includes('addon-ethernet') ||
    addons.includes('addon-hdmi') ||
    addons.includes('addon-custom-tech') ||
    addons.includes('addon-custom-river') ||
    addons.includes('addon-embedded-logo') ||
    addons.includes('addon-live-edge') ||
    !!powerStripId ||
    !!lightingAddonId ||
    !!edgeDetailLabel;

  if (hasAddonSpecs) {
    addTechSubheading('Add-ons');
    addTechRow('Edge Style', edgeDetailLabel);
    if (addons.includes('addon-glass-top')) {
      addTechRow('Glass thickness', '1/4 in');
      addTechRow('Glass type', 'TBD');
    }
    if (powerStripId) {
      const powerStripSpecs = POWER_STRIP_SPECS[powerStripId];
      addTechRow('Power strip option', powerStripTitle);
      if (powerStripSpecs) {
        addTechRow('Power rating', powerStripSpecs.powerRating);
        addTechRow('# of ports', powerStripSpecs.ports);
        if (powerStripSpecs.usbOutput) addTechRow('USB power output', powerStripSpecs.usbOutput);
        addTechRow('Power rail length', powerStripSpecs.railLength);
        addTechRow('Power rail color', powerStripSpecs.color);
      }
    }
    if (addons.includes('addon-wireless-charging')) {
      addTechRow('Wireless charging input', 'Up to 20W');
      addTechRow('Wireless charging output', 'Up to 15W');
    }
    if (addons.includes('addon-ethernet')) {
      addTechRow('Ethernet keystone ports', '2-8 ports');
      addTechRow('Ethernet cable type', 'Cat5e');
      addTechRow('Ethernet switch wattage', '67.5W (upgradable to 130W)');
      addTechRow('# of switch ports', '8');
      addTechRow('Switch management style', 'Unmanaged');
      addTechRow('POE budget (single port)', '25.5W');
      addTechRow('Max POE budget', '60W (upgradable to 123W)');
    }
    if (addons.includes('addon-hdmi')) {
      addTechRow('HDMI keystone ports', '2 ports');
      addTechRow('HDMI version', 'HDMI 2.0');
      addTechRow('HDMI cable routing', 'Cables to bottom of leg');
    }
    if (lightingAddonId) {
      const lightingSpecs = LIGHTING_SPECS_BY_ID[lightingAddonId];
      addTechRow('Lighting option', lightingTitle);
      addTechRow('Lighting operating temp', '-10C to 45C');
      if (lightingSpecs) {
        if (lightingSpecs.voltage) addTechRow('Lighting voltage', lightingSpecs.voltage);
        if (lightingSpecs.cri) addTechRow('Lighting CRI', lightingSpecs.cri);
        if (lightingSpecs.color) addTechRow('Lighting color', lightingSpecs.color);
        if (lightingSpecs.type) addTechRow('Lighting type', lightingSpecs.type);
        if (lightingSpecs.control) addTechRow('Lighting control', lightingSpecs.control);
        if (lightingSpecs.compatibility) addTechRow('Lighting compatibility', lightingSpecs.compatibility);
        if (lightingSpecs.density) addTechRow('Lighting density', lightingSpecs.density);
      }
    }
    if (hasTechAddons) {
      const techCableLabel = addons.includes('addon-hdmi')
        ? 'Tech Cable Lengths (excluding HDMI)'
        : 'Tech Cable Lengths';
      addTechRow(techCableLabel, getTechCableLengthLabel(selections.techCableLength));
    }
    if (addons.includes('addon-custom-tech')) addTechRow('Custom Tech', 'Quoted separately');
    if (addons.includes('addon-custom-river')) addTechRow('Custom River Design', 'Quoted separately');
    if (addons.includes('addon-embedded-logo')) addTechRow('Embedded Logo', 'Custom inlay');
  }

  addTechSubheading('Shipping');
  const shippingMode = shippingDetails.mode || 'Standard shipping';
  const shippingMethod = shippingMode === 'Standard shipping' ? 'LTL' : shippingMode;
  const transitTime = shippingMode === 'Standard shipping' ? '5-10 business days' : 'TBD';
  const destinationLabel = shippingDetails.zip || shippingDetails.region
    ? [shippingDetails.zip, shippingDetails.region].filter(Boolean).join(' · ')
    : 'Not provided';
  addTechRow('Shipping Method', shippingMethod);
  addTechRow('Estimated Transit Time', transitTime);
  addTechRow('Delivery Region', destinationLabel);
  addTechRow('Crate Dimensions', crateDimensions);
  addTechRow('Crate Material (walls/floor/top)', '7/16 in OSB');
  addTechRow('Crate Material (frame)', '2x2/2x4/2x6 lumber');
  addTechRow('Crate Hardware', 'T-25 screws 3/4in - 3in');
  addTechRow('Crate seal', 'DAP Alex Plus Clear');
  addTechRow('Table Packaging', 'Table wrap: 1/4 in PE foam + 80 Ga stretch wrap');
  addTechRow('Crate Packaging', 'Crate lining: 1 in EPS foam');
  addTechRow('Estimated Empty Crate Weight', formatWeight(emptyCrateWeight));
  addTechRow('Estimated Crate Weight (loaded)', formatWeight(loadedCrateWeight));

  // Technical specs disclaimer
  const techDisclaimer = 'These specifications are standard and may not be identical for every custom project.';
  const techDisclaimerLines = doc.splitTextToSize(techDisclaimer, pageWidth - margin * 2);
  ensureSpace(techDisclaimerLines.length * 12 + 16);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  doc.text(techDisclaimerLines, margin, y);
  y += techDisclaimerLines.length * 12 + 2;

  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0');
  doc.save(`woodlab-summary-${timestamp}.pdf`);
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
  const commercialPrice = document.getElementById('shipping-commercial-price');
  const liftgatePrice = document.getElementById('shipping-liftgate-price');
  const whiteGlovePrice = document.getElementById('shipping-white-glove-price');
  const cratePrice = document.getElementById('shipping-crate-price');
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
    if (!estimate) return;
    estimate.textContent = value;
    estimate.classList.toggle('is-disabled', isDisabled);
  };

  const setHeaderEstimateText = (value, isDisabled) => {
    if (!headerEstimate) return;
    headerEstimate.textContent = value;
    headerEstimate.classList.toggle('is-disabled', isDisabled);
  };

  const formatAccessorialPrice = (value) => `+${formatCurrency(value)}`;

  const setTogglePrice = (node, isActive, value) => {
    if (!node) return;
    if (isActive) {
      node.textContent = formatAccessorialPrice(value);
      node.classList.add('is-visible');
    } else {
      node.textContent = '';
      node.classList.remove('is-visible');
    }
  };
  const setStaticPrice = (node, value, isVisible) => {
    if (!node) return;
    node.textContent = value;
    node.classList.toggle('is-visible', isVisible);
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
    const whiteGloveSelected = !!(whiteGlove && whiteGlove.checked);
    [commercial, liftgate, whiteGlove].forEach((input) => {
      if (input) input.disabled = !showExtras;
    });
    if (liftgate) {
      if (whiteGloveSelected) liftgate.checked = false;
      liftgate.disabled = !showExtras || whiteGloveSelected;
      liftgate.setAttribute('aria-disabled', liftgate.disabled ? 'true' : 'false');
    }
    setStaticPrice(cratePrice, formatAccessorialPrice(SHIPPING_CRATE_COST), showExtras);
    setTogglePrice(commercialPrice, !!(commercial && commercial.checked), SHIPPING_ACCESSORIAL_PRICES.residential);
    setTogglePrice(liftgatePrice, !!(liftgate && liftgate.checked), SHIPPING_ACCESSORIAL_PRICES.liftgate);
    setTogglePrice(whiteGlovePrice, !!(whiteGlove && whiteGlove.checked), SHIPPING_ACCESSORIAL_PRICES.whiteGlove);
    const showNotes = !glassLocked && (localDelivery || (!!(whiteGlove && whiteGlove.checked) && showExtras));
    if (notes) {
      notes.classList.toggle('is-visible', showNotes);
      notes.setAttribute('aria-hidden', showNotes ? 'false' : 'true');
    }
    if (notesInput) notesInput.disabled = !showNotes;
    const accessoryTotal = showExtras
      ? SHIPPING_CRATE_COST
        + (commercial && commercial.checked ? SHIPPING_ACCESSORIAL_PRICES.residential : 0)
        + (liftgate && liftgate.checked ? SHIPPING_ACCESSORIAL_PRICES.liftgate : 0)
        + (whiteGlove && whiteGlove.checked ? SHIPPING_ACCESSORIAL_PRICES.whiteGlove : 0)
      : 0;

    if (localDelivery) {
      const tableLength = state.selections && state.selections.dimensionsDetail && typeof state.selections.dimensionsDetail.length === 'number'
        ? state.selections.dimensionsDetail.length
        : 0;
      const shippingCost = tableLength >= 120 ? 750 : 500;
      const freightText = formatCurrency(shippingCost);
      setEstimateText(freightText, effectiveDisabled);
      setHeaderEstimateText(formatCurrency(shippingCost + accessoryTotal), effectiveDisabled);
    } else {
      const shippingEstimate = effectiveDisabled ? null : calculateShippingEstimate({
        zip: normalizedZip,
        selections: state.selections
      });
      const estimateFallback = defaultEstimate || '--';
      const hasEstimate = typeof shippingEstimate === 'number';
      const freightText = hasEstimate ? formatCurrency(shippingEstimate) : estimateFallback;
      const disabledState = hasEstimate ? false : effectiveDisabled;
      setEstimateText(freightText, disabledState);
      const totalValue = hasEstimate ? shippingEstimate + accessoryTotal : null;
      const headerText = typeof totalValue === 'number' ? formatCurrency(totalValue) : freightText;
      setHeaderEstimateText(headerText, disabledState);
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
  const cap = document.getElementById('copy-config');
  const exp = document.getElementById('export-pdf');
  const rst = document.getElementById('restart-config');
  if (cap && cap.dataset.wlBound !== 'true') {
    cap.dataset.wlBound = 'true';
    cap.addEventListener('click', async (ev) => { ev.preventDefault(); await copyConfigMarkdown(); });
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
