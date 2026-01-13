import { computePrice } from './pricing.js';
import { loadData } from './dataLoader.js';
import {
  buildOptionGroups,
  buildPriceBreakdown,
  formatCurrency,
  getShippingDetails,
  loadSummaryData
} from './stages/summary.js';

function resolveDataLoader(dataLoader) {
  if (typeof dataLoader === 'function') return dataLoader;
  if (dataLoader && typeof dataLoader.loadData === 'function') return dataLoader.loadData;
  return loadData;
}

function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function getGroup(groups, title) {
  if (!Array.isArray(groups)) return null;
  return groups.find(group => group && group.title === title) || null;
}

function getItemValue(items, label) {
  if (!Array.isArray(items)) return null;
  const match = items.find(item => item && item.label === label);
  if (!match) return null;
  if (match.value !== undefined && match.value !== null) {
    return normalizeValue(match.value);
  }
  return normalizeValue(match.label);
}

function getAddonValues(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => normalizeValue(item && (item.label || item.value)))
    .filter(Boolean);
}

function buildConfigFromGroups(groups) {
  const modelGroup = getGroup(groups, 'Model');
  const designGroup = getGroup(groups, 'Design');
  const materialsGroup = getGroup(groups, 'Materials');
  const finishGroup = getGroup(groups, 'Finish');
  const dimensionsGroup = getGroup(groups, 'Dimensions');
  const legsGroup = getGroup(groups, 'Legs');
  const addonsGroup = getGroup(groups, 'Add-ons');

  return {
    model: getItemValue(modelGroup && modelGroup.items, 'Model'),
    design: getItemValue(designGroup && designGroup.items, 'Design'),
    materials: {
      material: getItemValue(materialsGroup && materialsGroup.items, 'Material'),
      color: getItemValue(materialsGroup && materialsGroup.items, 'Color'),
      customColorNote: getItemValue(materialsGroup && materialsGroup.items, 'Custom Color Note')
    },
    finish: {
      coating: getItemValue(finishGroup && finishGroup.items, 'Finish Coating'),
      sheen: getItemValue(finishGroup && finishGroup.items, 'Finish Sheen'),
      tint: getItemValue(finishGroup && finishGroup.items, 'Finish Tint')
    },
    dimensions: getItemValue(dimensionsGroup && dimensionsGroup.items, 'Dimensions'),
    legs: {
      style: getItemValue(legsGroup && legsGroup.items, 'Legs'),
      tube: getItemValue(legsGroup && legsGroup.items, 'Tube Size'),
      finish: getItemValue(legsGroup && legsGroup.items, 'Leg Finish')
    },
    addons: getAddonValues(addonsGroup && addonsGroup.items)
  };
}

export async function buildExportJSON(appState, dataLoader) {
  const load = resolveDataLoader(dataLoader);
  const selections = appState && appState.selections ? appState.selections : {};
  let summaryData = null;

  try {
    summaryData = await loadSummaryData(load);
  } catch (e) {
    summaryData = null;
  }

  const groups = buildOptionGroups(selections, summaryData);

  let priceData = null;
  try {
    priceData = await computePrice(appState);
  } catch (e) {
    priceData = null;
  }

  const pricingLineItems = buildPriceBreakdown(priceData);
  const subtotal = priceData && typeof priceData.total === 'number'
    ? formatCurrency(priceData.total)
    : formatCurrency((appState && appState.pricing && appState.pricing.total) || 0);

  const shippingDetails = getShippingDetails();
  const estimatedCost = (shippingDetails && typeof shippingDetails.estimateValue === 'number' && shippingDetails.estimateValue > 0)
    ? formatCurrency(shippingDetails.estimateValue)
    : (shippingDetails && shippingDetails.estimateText ? shippingDetails.estimateText : 'Pending');

  return {
    metadata: {
      timestamp: new Date().toISOString(),
      appVersion: (typeof window !== 'undefined' && window.__wl_app_version) ? window.__wl_app_version : null
    },
    configuration: buildConfigFromGroups(groups),
    pricing: {
      lineItems: pricingLineItems,
      subtotal
    },
    shipping: {
      mode: (shippingDetails && shippingDetails.mode) || 'Not selected',
      zipCode: (shippingDetails && shippingDetails.zip) || '',
      region: (shippingDetails && shippingDetails.region) || '',
      estimatedCost,
      accessorials: (shippingDetails && shippingDetails.flags) ? shippingDetails.flags : [],
      notes: normalizeValue(shippingDetails && shippingDetails.notes)
    }
  };
}

export default { buildExportJSON };
