const LEG_CUBE_ID = 'leg-sample-02';
const LEG_TRIPOD_ID = 'leg-sample-08';
const COFFEE_LEG_END_SETBACK_LABEL = '5-7 in';
const DEFAULT_LEG_END_SETBACK_LABEL = '12-14 in';
const LONG_LEG_END_SETBACK_LABEL = '18-20 in';

function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatInches(value, decimals = 0) {
  if (!Number.isFinite(value)) return 'TBD';
  if (decimals <= 0) return `${Math.round(value)} in`;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${rounded.toFixed(decimals)} in`.replace(/\.0+\s/, ' ').replace(/(\.\d*[1-9])0+\s/, '$1 ');
}

export function getLegWidthForTable(width) {
  if (!Number.isFinite(width)) return null;
  if (width <= 36) return 26;
  if (width <= 42) return 28;
  if (width <= 48) return 32;
  return Math.max(0, width - 10);
}

export function getLegEndSetbackLabel({ modelId, length, hasLegs = true } = {}) {
  if (!hasLegs) return 'TBD';
  if (modelId === 'mdl-coffee') return COFFEE_LEG_END_SETBACK_LABEL;
  if (Number.isFinite(length) && length >= 120) return LONG_LEG_END_SETBACK_LABEL;
  return DEFAULT_LEG_END_SETBACK_LABEL;
}

export function getPlateEndSetbackLabel(legEndSetback) {
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

export function parseSetbackValue(setbackLabel) {
  if (!setbackLabel || setbackLabel === 'TBD') return null;
  const rangeMatch = setbackLabel.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*in$/);
  if (rangeMatch) return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
  const plusMatch = setbackLabel.match(/^(\d+(?:\.\d+)?)\+\s*in$/);
  if (plusMatch) return Number(plusMatch[1]);
  const singleMatch = setbackLabel.match(/^(\d+(?:\.\d+)?)\s*in$/);
  if (singleMatch) return Number(singleMatch[1]);
  return null;
}

export function getLegEndSetbackValue(context = {}) {
  return parseSetbackValue(getLegEndSetbackLabel(context));
}

export function getLegSideSetbackLabel({ width, legWidth, plateLength, legId, designId }) {
  const fallback = { leg: 'TBD', plate: 'TBD' };
  if (!Number.isFinite(width)) return fallback;
  if (legId === LEG_CUBE_ID) return { leg: '0.25 in', plate: '0.25 in' };
  if (legId === LEG_TRIPOD_ID && designId === 'des-round') return { leg: '12-14 in', plate: '12-14 in' };
  if (legId === LEG_TRIPOD_ID && designId === 'des-cookie') return { leg: '12+ in', plate: '12+ in' };

  const legSetback = Number.isFinite(legWidth) ? Math.max(0, (width - legWidth) / 2) : null;
  const plateSetback = Number.isFinite(plateLength) ? Math.max(0, (width - plateLength) / 2) : null;

  return {
    leg: Number.isFinite(legSetback) ? formatInches(legSetback, Number.isInteger(legSetback) ? 0 : 1) : 'TBD',
    plate: Number.isFinite(plateSetback) ? formatInches(plateSetback, Number.isInteger(plateSetback) ? 0 : 1) : 'TBD'
  };
}
