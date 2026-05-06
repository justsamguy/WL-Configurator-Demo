// WoodLab Configurator - viewer.js
// Persistent Three.js viewer with empty, loading, ready, and error states.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { loadData } from './dataLoader.js';
import { getWaterfallEdgeCount } from './pricing.js';
import { state } from './state.js';
import { createLogger } from './logger.js';
import {
  getLegEndSetbackValue,
  getLegWidthForTable,
  getLowerShelfDimensions,
  isLowerShelfCompatibleContext
} from './legGeometry.js';

const VIEWER_DEBUG_ENABLED = false;
const log = VIEWER_DEBUG_ENABLED
  ? createLogger('Viewer')
  : { debug() {}, info() {}, warn() {}, error() {} };

const VIEWER_MANIFEST_PATH = 'data/viewer-models.json';
const LEG_FINISH_DATA_PATH = 'data/leg-finish.json';
const COLOR_DATA_PATH = 'data/colors.json';
const FINISH_DATA_PATH = 'data/finish.json';
const MATERIAL_BLACK_WALNUT_ID = 'mat-01';
const LOWER_SHELF_LINEAR_WALNUT_TEXTURE_PATH = 'assets/models/textures/Generated%20Linear%20Walnut.png';
const FALLBACK_CAMERA_OFFSET = Object.freeze([1.65, 0.94, 1.95]);
const ERROR_COPY = 'The selected 3D preview could not be loaded. Try again.';
const MISSING_CONFIGURATION_MODEL_COPY = "We don't have a 3D model for your configuration yet.";
const VIEWER_LOADING_STATUS = Object.freeze({
  title: 'Loading preview',
  copy: 'Preparing your 3D preview.'
});
const VIEWER_SUPPORT_NOTICE = Object.freeze({
  title: 'Preview limited',
  copy: `${MISSING_CONFIGURATION_MODEL_COPY} Some selected details may not appear in the preview.`
});
const VIEWER_NOTICE_VISIBLE_SELECTION_LIMIT = 3;
const TABLETOP_MATERIAL_TEXTURES = Object.freeze({
  'mat-02': 'assets/models/textures/Gemini_Generated_Image_otflgaotflgaotfl.jpg',
  'mat-03': 'assets/models/textures/Generated%20American%20Elm.jpg',
  'mat-04': 'assets/models/textures/Generated%20Siberian%20Elm%20Texture.jpg',
  'mat-05': 'assets/models/textures/Edited%20Sycamore%20Texture.jpg'
});
const EPOXY_PREVIEW_PART_NAME = 'tabletop-epoxy';
const LIVE_EDGE_ADDON_ID = 'addon-live-edge';
const AXIS_COMPONENTS = ['x', 'y', 'z'];
const LEG_NONE_ID = 'leg-none';
const LEG_CUSTOM_ID = 'leg-sample-07';
const LEG_SIGNATURE_ID = 'leg-signature';
const DESIGN_CUSTOM_ID = 'des-custom';
const MATERIAL_CUSTOM_ID = 'mat-08';
const MATERIAL_COOKIE_EXCLUSIVE_ID = 'mat-09';
const COLOR_CUSTOM_ID = 'color-01';
const COLOR_GRADIENT_DARK_TO_LIGHT_ID = 'color-gradient-01';
const COLOR_GRADIENT_CUSTOM_ID = 'color-gradient-03';
const COLOR_GRADIENT_LIGHT_CENTER_ID = 'color-gradient-02';
const COLOR_GRADIENT_SINGLE_COLOR_ID = 'color-gradient-04';
const VIEWER_SINGLE_COLOR_RENDERED_COLOR_IDS = new Set(['color-06', 'color-07', 'color-08']);
const LEG_FINISH_CUSTOM_ID = 'leg-finish-08';
const LEG_CUBE_ID = 'leg-sample-02';
const LEG_TRIPOD_ID = 'leg-sample-08';
const LEG_PAIR_COUNT_THRESHOLD = 130;
const TRIPOD_EDGE_SETBACK_IN = 13;
const CUBE_EDGE_SETBACK_IN = 0.25;
const DEFAULT_SURFACE_INSET_OFFSET = Object.freeze([0, 0, 0]);
const DEFAULT_RESIN_VIEWER_TINT = '#d2d7df';
const EPOXY_VERTICAL_INSET = 0.0015;
const GLASS_TOP_ADDON_ID = 'addon-glass-top';
const GLASS_TOP_PART_NAME = 'tabletop-glass';
const LOWER_SHELF_ADDON_ID = 'addon-lower-shelf';
const LOWER_SHELF_PART_NAME = 'lower-shelf';
const GLASS_TOP_THICKNESS_IN = 0.25;
const GLASS_TOP_AXIS_REDUCTION_IN = 0.125;
const GLASS_TOP_SURFACE_GAP = 0.0007;
const GLASS_TOP_MATERIAL_THICKNESS = GLASS_TOP_THICKNESS_IN * 0.0254;
const ROOM_ENVIRONMENT_BLUR = 0.04;
const GLASS_TOP_LIVE_EDGE_SAMPLE_SPACING_IN = 2;
const GLASS_TOP_LIVE_EDGE_MIN_SAMPLE_COUNT = 24;
const GLASS_TOP_LIVE_EDGE_MAX_SAMPLE_COUNT = 72;
const GLASS_TOP_LIVE_EDGE_POINT_TOLERANCE = 0.0005;
const RESIN_VIEWER_TINTS = Object.freeze({
  'color-01': '#1a1a1c',
  'color-02': '#5f87c4',
  'color-03': '#8c939e',
  'color-04': '#9b6945',
  'color-05': '#67836a',
  'color-06': '#4a4c53',
  'color-07': '#161618',
  'color-08': '#101011'
});
const TABLETOP_FINISH_TINTS = Object.freeze({
  'fin-tint-02': {
    label: 'Natural',
    brightness: 1.035,
    saturation: 0.88,
    tintColor: '#f3eadc',
    tintMix: 0.045
  },
  'fin-tint-03': {
    label: 'Darken',
    brightness: 0.68,
    saturation: 1.12,
    tintColor: '#4a2718',
    tintMix: 0.1
  }
});
const LIVE_EDGE_RESIN_SAMPLE_COUNT = 15;
const LIVE_EDGE_RESIN_MIN_GAP = 0.01;
const LIVE_EDGE_RESIN_NORMAL_Y_MIN = 0.7;
const LIVE_EDGE_RESIN_INNER_OVERDRAW = 0.0015;
const LIVE_EDGE_RESIN_OUTER_CLEARANCE = 0.0015;
const RESIN_PREVIEW_TOP_VIEW_TRANSMISSION = 0.39;
const RESIN_PREVIEW_END_VIEW_TRANSMISSION = 0.54;
const RESIN_PREVIEW_TOP_VIEW_ATTENUATION_DISTANCE = 0.82;
const RESIN_PREVIEW_END_VIEW_ATTENUATION_DISTANCE = 0.5;
const RESIN_PREVIEW_VIEW_BLEND_MIN = 0.18;
const RESIN_PREVIEW_VIEW_BLEND_MAX = 0.78;
const TABLETOP_GLARE_LIGHT_COLOR = 0xfff7eb;
const TABLETOP_GLARE_LIGHT_INTENSITY = Object.freeze({
  'fin-sheen-01': 0.7,
  'fin-sheen-02': 1.3,
  'fin-sheen-03': 1.85,
  default: 1.2
});
const WATERFALL_VIEWER_ADDON_IDS = new Set(['addon-waterfall-single', 'addon-waterfall-second', 'addon-waterfall-art']);
const EDGE_PROFILE_VIEWER_ADDON_IDS = new Set(['addon-chamfered-edges', 'addon-squoval', 'addon-rounded-corners', 'addon-angled-corners']);
const TECH_VIEWER_ADDON_IDS = new Set([
  'addon-power-ac',
  'addon-power-ac-usb',
  'addon-power-ac-usb-usbc',
  'addon-wireless-charging',
  'addon-ethernet',
  'addon-hdmi',
  'addon-lighting-white',
  'addon-lighting-color-basic',
  'addon-lighting-color-fx',
  'addon-lighting-custom',
  'addon-custom-tech'
]);
const DESIGN_VIEWER_NOTICES = Object.freeze({
  'des-round': {
    title: 'Round design',
    reason: 'Round tabletop geometry does not have a dedicated local 3D model yet.'
  },
  'des-cookie': {
    title: 'Cookie design',
    reason: 'Cookie slab geometry does not have a dedicated local 3D model yet.'
  },
  'des-keystone': {
    title: 'Keystone design',
    reason: 'This design does not have a dedicated 3D preview yet.'
  },
  'des-encasement': {
    title: 'Encasement design',
    reason: 'This layout is finished to spec, so the viewer keeps the standard slab preview.'
  },
  'des-encased-slab': {
    title: 'Encased slab design',
    reason: 'This layout does not have a dedicated local 3D model yet.'
  },
  [DESIGN_CUSTOM_ID]: {
    title: 'Custom design',
    reason: 'Custom layouts are quoted separately and do not have a standard 3D preview.'
  }
});

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let loader = null;
let floorMesh = null;
let tabletopGlareLight = null;
let initialized = false;
let manifestPromise = null;
let resizeObserver = null;
let themeObserver = null;
let resizeTimeout = null;
let currentRenderRoot = null;
let requestedModelId = null;
let displayedModelId = null;
let displayedRenderSignature = null;
let pendingRequestToken = 0;
let isLoading = false;
let defaultCameraPosition = new THREE.Vector3(32, 22, 40);
let defaultCameraTarget = new THREE.Vector3(0, 10, 0);
let hasLoggedManifestSummary = false;
let tabletopTexturePromises = new Map();
let lowerShelfTexturePromises = new Map();
let materialSourcePromises = new Map();
let legFinishDataPromise = null;
let colorDataPromise = null;
let finishDataPromise = null;

const dom = {
  surface: null,
  canvas: null,
  empty: null,
  error: null,
  errorCopy: null,
  statusBox: null,
  statusTitle: null,
  statusCopy: null,
  statusSpinner: null,
  liveRegion: null,
  retryButton: null
};

let lastObservedModelId = null;
let lastObservedDesignId = null;
let lastObservedMaterialId = null;
let lastObservedFinishSheenId = null;
let lastObservedFinishTintId = null;
let lastObservedColorId = null;
let lastObservedColorGradientId = null;
let lastObservedLegFinishId = null;
let lastObservedDimensionsSignature = '';
let lastObservedLegId = null;
let lastObservedTubeId = null;
let lastObservedAddonsSignature = '';
let activeResinPreviewMaterials = [];
const cameraViewDirection = new THREE.Vector3();
const tabletopSurfaceNormal = new THREE.Vector3(0, 1, 0);

function getSelections() {
  return state && state.selections && typeof state.selections === 'object'
    ? state.selections
    : {};
}

function getSelectedOption(optionId) {
  const selections = getSelections();
  const options = selections && selections.options && typeof selections.options === 'object'
    ? selections.options
    : {};
  return options[optionId] || null;
}

function getSelectedAddons() {
  const addons = getSelectedOption('addon');
  return Array.isArray(addons) ? addons : [];
}

function hasSelectedAddon(addonId) {
  return typeof addonId === 'string' && getSelectedAddons().includes(addonId);
}

function getCurrentViewerSelectionContext(modelId) {
  const selections = getSelections();
  const detail = selections && selections.dimensionsDetail && typeof selections.dimensionsDetail === 'object'
    ? selections.dimensionsDetail
    : {};

  return {
    modelId,
    designId: selections.design || null,
    legId: getSelectedOption('legs'),
    tubeId: getSelectedOption('tube-size'),
    waterfallCount: getWaterfallEdgeCount(state),
    length: Number.isFinite(Number(detail.length)) ? Number(detail.length) : null,
    width: Number.isFinite(Number(detail.width)) ? Number(detail.width) : null
  };
}

function isLegPreviewSuppressed(selectionContext = {}) {
  const { legId, waterfallCount } = selectionContext;
  if (!legId) return true;
  if (legId === LEG_NONE_ID || legId === LEG_CUSTOM_ID || legId === LEG_SIGNATURE_ID) return true;
  return waterfallCount >= 2;
}

function getLegCount(length) {
  if (!Number.isFinite(length)) return 2;
  return length > LEG_PAIR_COUNT_THRESHOLD ? 3 : 2;
}

function parseTubeProfile(tubeId) {
  if (!tubeId || typeof tubeId !== 'string') return [];
  const match = tubeId.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
  if (!match) return [];
  return [Number(match[1]), Number(match[2])].filter(Number.isFinite);
}

function getTubeFallbackScale(baseTubeId, selectedTubeId) {
  if (!baseTubeId || !selectedTubeId || baseTubeId === selectedTubeId) return 1;
  const baseProfile = parseTubeProfile(baseTubeId);
  const selectedProfile = parseTubeProfile(selectedTubeId);
  if (!baseProfile.length || !selectedProfile.length) return 1;
  const baseMax = Math.max(...baseProfile);
  const selectedMax = Math.max(...selectedProfile);
  if (!Number.isFinite(baseMax) || !Number.isFinite(selectedMax) || baseMax <= 0 || selectedMax <= 0) return 1;
  return THREE.MathUtils.clamp(selectedMax / baseMax, 0.78, 1.5);
}

function matchesVariantScope(scopeIds, selectedId) {
  if (!Array.isArray(scopeIds) || !scopeIds.length) return true;
  return !!selectedId && scopeIds.includes(selectedId);
}

function resolveLegVariant(definition = {}, selectionContext = {}) {
  const variants = Array.isArray(definition.variants) ? definition.variants : [];
  let bestMatch = null;
  let bestScore = -Infinity;

  variants.forEach((variant) => {
    if (!variant || typeof variant.assetPath !== 'string' || !variant.assetPath.trim()) return;
    if (!matchesVariantScope(variant.modelIds, selectionContext.modelId)) return;
    if (!matchesVariantScope(variant.designIds, selectionContext.designId)) return;

    let score = 0;
    if (Array.isArray(variant.modelIds) && variant.modelIds.length) score += 4;
    if (Array.isArray(variant.designIds) && variant.designIds.length) score += 2;

    const tubeIds = Array.isArray(variant.tubeIds) ? variant.tubeIds : [];
    if (tubeIds.length) {
      if (selectionContext.tubeId && tubeIds.includes(selectionContext.tubeId)) {
        score += 8;
      } else if (selectionContext.tubeId && definition.tubeScaleFallback === false) {
        return;
      } else {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = variant;
    }
  });

  return bestMatch;
}

function buildLegRenderableParts(legCatalog = {}, selectionContext = {}) {
  if (isLegPreviewSuppressed(selectionContext)) return [];

  const definition = legCatalog && selectionContext.legId ? legCatalog[selectionContext.legId] : null;
  if (!definition || typeof definition !== 'object') return [];

  const variant = resolveLegVariant(definition, selectionContext);
  if (!variant) return [];

  const tubeIds = Array.isArray(variant.tubeIds) ? variant.tubeIds : [];
  const baseTubeId = variant.baseTubeId || tubeIds[0] || null;
  const tubeFallbackScale = definition.tubeScaleFallback
    ? getTubeFallbackScale(baseTubeId, selectionContext.tubeId)
    : 1;

  if (definition.layout === 'single-center') {
    return [{
      name: 'leg-center',
      role: 'leg',
      placement: 'center',
      layout: 'single-center',
      legId: selectionContext.legId,
      assetPath: variant.assetPath,
      tubeFallbackScale
    }];
  }

  const placements = ['front', 'back'];
  if (definition.allowThirdLeg !== false && getLegCount(selectionContext.length) > 2) {
    placements.push('middle');
  }

  if (selectionContext.waterfallCount === 1) {
    // Single waterfall replaces the reset-view-side end leg, never the center support.
    const defaultViewPlacement = selectionContext.defaultViewNearestPlacement === 'back' ? 'back' : 'front';
    return placements
      .filter((placement) => placement === 'middle' || placement !== defaultViewPlacement)
      .map((placement) => ({
        name: `leg-${placement}`,
        role: 'leg',
        placement,
        layout: 'paired-supports',
        legId: selectionContext.legId,
        assetPath: variant.assetPath,
        tubeFallbackScale
      }));
  }

  return placements.map((placement) => ({
    name: `leg-${placement}`,
    role: 'leg',
    placement,
    layout: 'paired-supports',
    legId: selectionContext.legId,
    assetPath: variant.assetPath,
    tubeFallbackScale
  }));
}

function getConfiguredLegParts(manifest = {}, modelId) {
  const defaults = manifest && manifest.defaults && typeof manifest.defaults === 'object'
    ? manifest.defaults
    : {};
  const modelEntry = manifest && manifest.models && typeof manifest.models === 'object'
    ? manifest.models[modelId]
    : null;
  const cameraConfig = {
    ...(defaults.camera && typeof defaults.camera === 'object' ? defaults.camera : {}),
    ...(modelEntry && typeof modelEntry.camera === 'object' ? modelEntry.camera : {})
  };
  const selectionContext = getCurrentViewerSelectionContext(modelId);
  const cameraSettings = getCameraSettings({ camera: cameraConfig });
  selectionContext.defaultViewNearestPlacement = Number(cameraSettings.offset[2]) < 0 ? 'back' : 'front';
  const legCatalog = defaults.legAssets && typeof defaults.legAssets === 'object'
    ? defaults.legAssets
    : {};
  return buildLegRenderableParts(legCatalog, selectionContext);
}

function getModelTitle(modelId, config = {}) {
  if (config && typeof config.title === 'string' && config.title.trim()) return config.title.trim();
  if (!modelId || typeof modelId !== 'string') return 'Selected Table';
  return modelId
    .replace(/^mdl-/, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getCameraSettings(config = {}) {
  const cameraConfig = config.camera && typeof config.camera === 'object' ? config.camera : {};
  return {
    offset: Array.isArray(cameraConfig.offset) && cameraConfig.offset.length === 3
      ? cameraConfig.offset
      : FALLBACK_CAMERA_OFFSET,
    targetHeightRatio: Number.isFinite(Number(cameraConfig.targetHeightRatio))
      ? Number(cameraConfig.targetHeightRatio)
      : 0.34,
    minDistanceMultiplier: Number.isFinite(Number(cameraConfig.minDistanceMultiplier))
      ? Number(cameraConfig.minDistanceMultiplier)
      : 0.9,
    maxDistanceMultiplier: Number.isFinite(Number(cameraConfig.maxDistanceMultiplier))
      ? Number(cameraConfig.maxDistanceMultiplier)
      : 5.8
  };
}

function getDimensionRules(config = {}) {
  const ruleConfig = config.dimensionRules && typeof config.dimensionRules === 'object'
    ? config.dimensionRules
    : {};
  const baseDimensions = ruleConfig.baseDimensions && typeof ruleConfig.baseDimensions === 'object'
    ? ruleConfig.baseDimensions
    : {};
  const sourceDimensions = ruleConfig.sourceDimensions && typeof ruleConfig.sourceDimensions === 'object'
    ? ruleConfig.sourceDimensions
    : baseDimensions;
  const heightOptions = ruleConfig.heightOptions && typeof ruleConfig.heightOptions === 'object'
    ? ruleConfig.heightOptions
    : {};

  return {
    unitsPerInch: Number.isFinite(Number(ruleConfig.unitsPerInch))
      ? Number(ruleConfig.unitsPerInch)
      : 0.0254,
    roundScaleMode: typeof ruleConfig.roundScaleMode === 'string' && ruleConfig.roundScaleMode.trim()
      ? ruleConfig.roundScaleMode.trim()
      : 'uniform-length',
    baseDimensions: {
      length: Number.isFinite(Number(baseDimensions.length)) ? Number(baseDimensions.length) : null,
      width: Number.isFinite(Number(baseDimensions.width)) ? Number(baseDimensions.width) : null,
      height: Number.isFinite(Number(baseDimensions.height)) ? Number(baseDimensions.height) : null
    },
    sourceDimensions: {
      length: Number.isFinite(Number(sourceDimensions.length))
        ? Number(sourceDimensions.length)
        : (Number.isFinite(Number(baseDimensions.length)) ? Number(baseDimensions.length) : null),
      width: Number.isFinite(Number(sourceDimensions.width))
        ? Number(sourceDimensions.width)
        : (Number.isFinite(Number(baseDimensions.width)) ? Number(baseDimensions.width) : null),
      height: Number.isFinite(Number(sourceDimensions.height))
        ? Number(sourceDimensions.height)
        : (Number.isFinite(Number(baseDimensions.height)) ? Number(baseDimensions.height) : null)
    },
    heightOptions: {
      standard: Number.isFinite(Number(heightOptions.standard)) ? Number(heightOptions.standard) : null,
      bar: Number.isFinite(Number(heightOptions.bar)) ? Number(heightOptions.bar) : null
    },
    partBehaviors: ruleConfig.partBehaviors && typeof ruleConfig.partBehaviors === 'object'
      ? ruleConfig.partBehaviors
      : {}
  };
}

function getSelectedDimensions(config = {}) {
  const rules = getDimensionRules(config);
  const detail = state && state.selections ? state.selections.dimensionsDetail : null;
  const baseDimensions = rules.baseDimensions || {};
  const heightOptions = rules.heightOptions || {};
  const rawLength = detail ? Number(detail.length) : NaN;
  const rawWidth = detail ? Number(detail.width) : NaN;
  const rawCustomHeight = detail ? Number(detail.heightCustom) : NaN;
  const heightSelection = detail && typeof detail.height === 'string'
    ? detail.height
    : 'standard';

  let heightInches = Number(baseDimensions.height) || Number(heightOptions.standard) || null;
  if (heightSelection === 'bar') {
    heightInches = Number(heightOptions.bar) || heightInches;
  } else if (heightSelection === 'custom' && Number.isFinite(rawCustomHeight)) {
    heightInches = rawCustomHeight;
  } else if (heightSelection === 'standard') {
    heightInches = Number(heightOptions.standard) || heightInches;
  }

  return {
    length: Number.isFinite(rawLength) ? rawLength : (Number(baseDimensions.length) || null),
    width: Number.isFinite(rawWidth) ? rawWidth : (Number(baseDimensions.width) || null),
    height: Number.isFinite(heightInches) ? heightInches : (Number(baseDimensions.height) || null),
    heightSelection,
    isRound: state && state.selections ? state.selections.design === 'des-round' : false
  };
}

function getRoundPlanarScale(lengthScale, widthScale, roundScaleMode = 'uniform-length') {
  if (roundScaleMode === 'uniform-width') return widthScale;
  if (roundScaleMode === 'uniform-average') return (lengthScale + widthScale) / 2;
  return lengthScale;
}

function getDimensionScaleMap(config = {}) {
  const rules = getDimensionRules(config);
  const selectedDimensions = getSelectedDimensions(config);
  const sourceDimensions = rules.sourceDimensions || {};
  const rawLengthScale = Number.isFinite(selectedDimensions.length) && Number.isFinite(Number(sourceDimensions.length)) && Number(sourceDimensions.length) > 0
    ? selectedDimensions.length / Number(sourceDimensions.length)
    : 1;
  const rawWidthScale = Number.isFinite(selectedDimensions.width) && Number.isFinite(Number(sourceDimensions.width)) && Number(sourceDimensions.width) > 0
    ? selectedDimensions.width / Number(sourceDimensions.width)
    : 1;
  const heightScale = Number.isFinite(selectedDimensions.height) && Number.isFinite(Number(sourceDimensions.height)) && Number(sourceDimensions.height) > 0
    ? selectedDimensions.height / Number(sourceDimensions.height)
    : 1;

  if (selectedDimensions.isRound) {
    const planarScale = getRoundPlanarScale(rawLengthScale, rawWidthScale, rules.roundScaleMode);
    return {
      length: planarScale,
      width: planarScale,
      height: heightScale,
      selectedDimensions
    };
  }

  return {
    length: rawLengthScale,
    width: rawWidthScale,
    height: heightScale,
    selectedDimensions
  };
}

function getScaleFactorForDimension(scaleMap, dimensionKey) {
  if (!scaleMap || !dimensionKey) return 1;
  if (dimensionKey === 'length') return scaleMap.length;
  if (dimensionKey === 'width') return scaleMap.width;
  if (dimensionKey === 'height') return scaleMap.height;
  if (dimensionKey === 'support-width') {
    const widthScale = Number.isFinite(scaleMap.width) ? scaleMap.width : 1;
    const selectedDimensions = scaleMap.selectedDimensions || {};
    const width = Number(selectedDimensions.width);
    const length = Number(selectedDimensions.length);
    const requiresHeavySupport = (Number.isFinite(width) && width > 48) || (Number.isFinite(length) && length > 120);
    let supportWidthScale = widthScale >= 1
      ? 1 + ((widthScale - 1) * 0.72)
      : 1 - ((1 - widthScale) * 0.25);
    if (requiresHeavySupport) supportWidthScale = Math.max(supportWidthScale, 1.16);
    return THREE.MathUtils.clamp(supportWidthScale, 0.85, 1.95);
  }
  return 1;
}

function isVisibilityRuleSatisfied(scaleMap, visibilityRule) {
  if (!visibilityRule || typeof visibilityRule !== 'object') return true;
  const dimensionKey = typeof visibilityRule.dimension === 'string' ? visibilityRule.dimension : '';
  const selectedDimensions = scaleMap && scaleMap.selectedDimensions ? scaleMap.selectedDimensions : {};
  const value = Number(selectedDimensions[dimensionKey]);
  const min = Number(visibilityRule.min);
  const max = Number(visibilityRule.max);

  if (Number.isFinite(min) && (!Number.isFinite(value) || value < min)) return false;
  if (Number.isFinite(max) && (!Number.isFinite(value) || value > max)) return false;
  return true;
}

function getObjectMetrics(root) {
  if (!root) return null;
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) return null;
  return {
    bounds,
    min: bounds.min.clone(),
    max: bounds.max.clone(),
    center: bounds.getCenter(new THREE.Vector3())
  };
}

function getTabletopGlareLightIntensity() {
  const selectedSheenId = getSelectedOption('finish-sheen');
  return TABLETOP_GLARE_LIGHT_INTENSITY[selectedSheenId] || TABLETOP_GLARE_LIGHT_INTENSITY.default;
}

function syncTabletopGlareLight(renderRoot = currentRenderRoot) {
  if (!tabletopGlareLight || !camera) return;
  if (!renderRoot) {
    tabletopGlareLight.visible = false;
    return;
  }

  const tabletopRoot = renderRoot.getObjectByName('tabletop');
  const tabletopMetrics = getObjectMetrics(tabletopRoot);
  if (!tabletopMetrics) {
    tabletopGlareLight.visible = false;
    return;
  }

  const tabletopSize = tabletopMetrics.bounds.getSize(new THREE.Vector3());
  const tabletopSpan = Math.max(tabletopSize.x, tabletopSize.z, 1);
  const surfacePoint = new THREE.Vector3(
    tabletopMetrics.center.x,
    tabletopMetrics.max.y + Math.max(tabletopSpan * 0.002, 0.002),
    tabletopMetrics.center.z
  );
  const surfaceToCamera = camera.position.clone().sub(surfacePoint);
  if (surfaceToCamera.lengthSq() < 0.0001) {
    tabletopGlareLight.visible = false;
    return;
  }

  // Mirror the camera vector across the tabletop plane so the highlight faces the active view.
  const reflectedLightVector = surfaceToCamera.clone().negate().reflect(tabletopSurfaceNormal);
  const lightDistance = THREE.MathUtils.clamp(surfaceToCamera.length(), tabletopSpan * 0.65, tabletopSpan * 2.6);
  reflectedLightVector.setLength(lightDistance);

  tabletopGlareLight.position.copy(surfacePoint).add(reflectedLightVector);
  tabletopGlareLight.target.position.copy(surfacePoint);
  tabletopGlareLight.target.updateMatrixWorld();
  tabletopGlareLight.intensity = getTabletopGlareLightIntensity();
  tabletopGlareLight.visible = true;
}

function getNamedMeshMetrics(root, namePattern) {
  if (!root || !(namePattern instanceof RegExp)) return null;

  let bounds = null;
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    if (!child || !child.isMesh || !namePattern.test(child.name || '')) return;
    const childBounds = new THREE.Box3().setFromObject(child);
    if (childBounds.isEmpty()) return;
    if (!bounds) bounds = childBounds.clone();
    else bounds.union(childBounds);
  });

  if (!bounds || bounds.isEmpty()) return null;
  return {
    bounds,
    min: bounds.min.clone(),
    max: bounds.max.clone(),
    center: bounds.getCenter(new THREE.Vector3())
  };
}

function hasGlassTopAddon() {
  const addons = state && state.selections && state.selections.options
    ? state.selections.options.addon
    : null;
  return Array.isArray(addons) && addons.includes(GLASS_TOP_ADDON_ID);
}

function captureRenderRootBaseState(renderRoot) {
  if (!renderRoot) return;

  const partStates = {};
  renderRoot.children.forEach((child) => {
    const metrics = getObjectMetrics(child);
    partStates[child.name] = {
      position: child.position.clone(),
      scale: child.scale.clone(),
      metrics
    };
  });
  renderRoot.userData.basePartStates = partStates;
}

function getPartConfig(partRoot) {
  return partRoot && partRoot.userData && partRoot.userData.partConfig && typeof partRoot.userData.partConfig === 'object'
    ? partRoot.userData.partConfig
    : {};
}

function getPartSpan(metrics, axis) {
  if (!metrics || !metrics.min || !metrics.max || !AXIS_COMPONENTS.includes(axis)) return null;
  return metrics.max[axis] - metrics.min[axis];
}

function getLiveEdgeTopSurfaceTriangles(tabletopRoot, tabletopMetrics) {
  if (!tabletopRoot || !tabletopMetrics) return [];

  tabletopRoot.updateWorldMatrix(true, true);
  const normalMatrix = new THREE.Matrix3();
  const vertexA = new THREE.Vector3();
  const vertexB = new THREE.Vector3();
  const vertexC = new THREE.Vector3();
  const normalA = new THREE.Vector3();
  const normalB = new THREE.Vector3();
  const normalC = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const topSurfaceBand = Math.max(getPartSpan(tabletopMetrics, 'y') * 0.08, 0.0015);
  const topSurfaceMinY = tabletopMetrics.max.y - topSurfaceBand;
  const triangles = [];

  tabletopRoot.traverse((child) => {
    if (!child || !child.isMesh || !child.geometry) return;

    const positionAttribute = child.geometry.getAttribute('position');
    if (!positionAttribute) return;

    const indexAttribute = child.geometry.index;
    const normalAttribute = child.geometry.getAttribute('normal');
    normalMatrix.getNormalMatrix(child.matrixWorld);

    const triangleCount = indexAttribute ? indexAttribute.count : positionAttribute.count;
    for (let index = 0; index < triangleCount; index += 3) {
      const vertexIndexA = indexAttribute ? indexAttribute.getX(index) : index;
      const vertexIndexB = indexAttribute ? indexAttribute.getX(index + 1) : index + 1;
      const vertexIndexC = indexAttribute ? indexAttribute.getX(index + 2) : index + 2;

      vertexA.fromBufferAttribute(positionAttribute, vertexIndexA).applyMatrix4(child.matrixWorld);
      vertexB.fromBufferAttribute(positionAttribute, vertexIndexB).applyMatrix4(child.matrixWorld);
      vertexC.fromBufferAttribute(positionAttribute, vertexIndexC).applyMatrix4(child.matrixWorld);

      const maxY = Math.max(vertexA.y, vertexB.y, vertexC.y);
      if (maxY < topSurfaceMinY) continue;

      let averageNormalY = 0;
      if (normalAttribute) {
        normalA.fromBufferAttribute(normalAttribute, vertexIndexA).applyMatrix3(normalMatrix).normalize();
        normalB.fromBufferAttribute(normalAttribute, vertexIndexB).applyMatrix3(normalMatrix).normalize();
        normalC.fromBufferAttribute(normalAttribute, vertexIndexC).applyMatrix3(normalMatrix).normalize();
        averageNormalY = (normalA.y + normalB.y + normalC.y) / 3;
      } else {
        faceNormal.copy(vertexB).sub(vertexA).cross(new THREE.Vector3().copy(vertexC).sub(vertexA)).normalize();
        averageNormalY = faceNormal.y;
      }

      if (averageNormalY < LIVE_EDGE_RESIN_NORMAL_Y_MIN) continue;

      triangles.push({
        a: vertexA.clone(),
        b: vertexB.clone(),
        c: vertexC.clone(),
        minZ: Math.min(vertexA.z, vertexB.z, vertexC.z),
        maxZ: Math.max(vertexA.z, vertexB.z, vertexC.z),
        topSurfaceMinY
      });
    }
  });

  return triangles;
}

function getLiveEdgeIntervalsAtZ(triangles, sampleZ) {
  if (!Array.isArray(triangles) || !triangles.length) return [];

  const rawIntervals = [];
  const intersectionTolerance = 0.000001;

  const addEdgeIntersection = (points, pointA, pointB, topSurfaceMinY) => {
    const withinPlane = (
      (pointA.z <= sampleZ && pointB.z >= sampleZ)
      || (pointB.z <= sampleZ && pointA.z >= sampleZ)
    );
    if (!withinPlane) return;

    const deltaZ = pointB.z - pointA.z;
    if (Math.abs(deltaZ) <= intersectionTolerance) {
      if (pointA.y >= topSurfaceMinY) points.push(pointA.x);
      if (pointB.y >= topSurfaceMinY) points.push(pointB.x);
      return;
    }

    const interpolation = (sampleZ - pointA.z) / deltaZ;
    if (interpolation < -intersectionTolerance || interpolation > 1 + intersectionTolerance) return;

    const intersectionY = pointA.y + ((pointB.y - pointA.y) * interpolation);
    if (intersectionY < topSurfaceMinY) return;

    points.push(pointA.x + ((pointB.x - pointA.x) * interpolation));
  };

  triangles.forEach((triangle) => {
    if (!triangle || sampleZ < triangle.minZ || sampleZ > triangle.maxZ) return;

    const points = [];
    addEdgeIntersection(points, triangle.a, triangle.b, triangle.topSurfaceMinY);
    addEdgeIntersection(points, triangle.b, triangle.c, triangle.topSurfaceMinY);
    addEdgeIntersection(points, triangle.c, triangle.a, triangle.topSurfaceMinY);

    const uniqueXs = [];
    points.sort((left, right) => left - right).forEach((value) => {
      if (!uniqueXs.length || Math.abs(value - uniqueXs[uniqueXs.length - 1]) > intersectionTolerance) {
        uniqueXs.push(value);
      }
    });

    if (uniqueXs.length < 2) return;
    rawIntervals.push([uniqueXs[0], uniqueXs[uniqueXs.length - 1]]);
  });

  if (!rawIntervals.length) return [];

  const mergedIntervals = [];
  rawIntervals.sort((left, right) => left[0] - right[0]).forEach(([start, end]) => {
    if (!mergedIntervals.length || start > mergedIntervals[mergedIntervals.length - 1][1] + intersectionTolerance) {
      mergedIntervals.push([start, end]);
      return;
    }

    mergedIntervals[mergedIntervals.length - 1][1] = Math.max(mergedIntervals[mergedIntervals.length - 1][1], end);
  });

  return mergedIntervals;
}

function getLiveEdgeResinFit(tabletopRoot, tabletopMetrics) {
  if (!hasSelectedAddon(LIVE_EDGE_ADDON_ID) || !tabletopRoot || !tabletopMetrics) return null;

  const tabletopLength = getPartSpan(tabletopMetrics, 'z');
  if (!Number.isFinite(tabletopLength) || tabletopLength <= 0) return null;

  const triangles = getLiveEdgeTopSurfaceTriangles(tabletopRoot, tabletopMetrics);
  if (!triangles.length) return null;

  const riverSamples = [];
  const minZ = tabletopMetrics.min.z;
  const lengthStep = tabletopLength / (LIVE_EDGE_RESIN_SAMPLE_COUNT + 1);
  for (let sampleIndex = 1; sampleIndex <= LIVE_EDGE_RESIN_SAMPLE_COUNT; sampleIndex += 1) {
    const sampleZ = minZ + (lengthStep * sampleIndex);
    const intervals = getLiveEdgeIntervalsAtZ(triangles, sampleZ);
    if (intervals.length < 2) continue;

    const leftSpan = intervals[0];
    const rightSpan = intervals[intervals.length - 1];
    const gapWidth = rightSpan[0] - leftSpan[1];
    if (!Number.isFinite(gapWidth) || gapWidth <= LIVE_EDGE_RESIN_MIN_GAP) continue;

    riverSamples.push({
      leftOuter: leftSpan[0],
      leftInner: leftSpan[1],
      rightInner: rightSpan[0],
      rightOuter: rightSpan[1]
    });
  }

  if (!riverSamples.length) return null;

  const safeOuterLeft = Math.max(...riverSamples.map((sample) => sample.leftOuter));
  const safeInnerLeft = Math.min(...riverSamples.map((sample) => sample.leftInner));
  const safeInnerRight = Math.max(...riverSamples.map((sample) => sample.rightInner));
  const safeOuterRight = Math.min(...riverSamples.map((sample) => sample.rightOuter));

  const targetLeft = Math.max(safeOuterLeft + LIVE_EDGE_RESIN_OUTER_CLEARANCE, safeInnerLeft - LIVE_EDGE_RESIN_INNER_OVERDRAW);
  const targetRight = Math.min(safeOuterRight - LIVE_EDGE_RESIN_OUTER_CLEARANCE, safeInnerRight + LIVE_EDGE_RESIN_INNER_OVERDRAW);
  const targetWidth = targetRight - targetLeft;

  if (!Number.isFinite(targetWidth) || targetWidth <= LIVE_EDGE_RESIN_MIN_GAP) return null;

  return {
    centerX: (targetLeft + targetRight) / 2,
    width: targetWidth
  };
}

function addUniqueShapePoint(points, x, y, tolerance = GLASS_TOP_LIVE_EDGE_POINT_TOLERANCE) {
  if (!Array.isArray(points)) return;

  const nextPoint = new THREE.Vector2(x, y);
  const lastPoint = points[points.length - 1];
  if (lastPoint && lastPoint.distanceToSquared(nextPoint) <= tolerance * tolerance) return;
  points.push(nextPoint);
}

function replaceGlassMeshGeometry(glassMesh, nextGeometry, geometryMode) {
  if (!glassMesh || !nextGeometry) return;

  const currentGeometry = glassMesh.geometry;
  if (currentGeometry && currentGeometry !== nextGeometry && typeof currentGeometry.dispose === 'function') {
    currentGeometry.dispose();
  }

  glassMesh.geometry = nextGeometry;
  glassMesh.userData.geometryMode = geometryMode;
}

function ensureGlassBoxGeometry(glassMesh) {
  if (!glassMesh) return;
  if (glassMesh.userData.geometryMode === 'box' && glassMesh.geometry) return;
  replaceGlassMeshGeometry(glassMesh, new THREE.BoxGeometry(1, 1, 1), 'box');
}

function createLiveEdgeGlassGeometry(tabletopRoot, tabletopMetrics, thickness, perimeterInset, unitsPerInch) {
  if (!tabletopRoot || !tabletopMetrics || !Number.isFinite(thickness) || thickness <= 0) return null;

  const tabletopLength = getPartSpan(tabletopMetrics, 'z');
  if (!Number.isFinite(tabletopLength) || tabletopLength <= 0) return null;

  const triangles = getLiveEdgeTopSurfaceTriangles(tabletopRoot, tabletopMetrics);
  if (!triangles.length) return null;

  const inset = Math.max(0, perimeterInset);
  const minZ = tabletopMetrics.min.z + inset;
  const maxZ = tabletopMetrics.max.z - inset;
  if (maxZ <= minZ) return null;

  const targetSampleSpacing = Math.max((Number(unitsPerInch) || 0.0254) * GLASS_TOP_LIVE_EDGE_SAMPLE_SPACING_IN, 0.0254);
  const sampleCount = THREE.MathUtils.clamp(
    Math.round((maxZ - minZ) / targetSampleSpacing),
    GLASS_TOP_LIVE_EDGE_MIN_SAMPLE_COUNT,
    GLASS_TOP_LIVE_EDGE_MAX_SAMPLE_COUNT
  );
  const centerX = tabletopMetrics.center.x;
  const centerZ = tabletopMetrics.center.z;
  const samples = [];

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const interpolation = sampleCount === 0 ? 0 : sampleIndex / sampleCount;
    const sampleZ = THREE.MathUtils.lerp(minZ, maxZ, interpolation);
    const intervals = getLiveEdgeIntervalsAtZ(triangles, sampleZ);
    if (!intervals.length) continue;

    const leftBoundary = intervals[0][0] + inset;
    const rightBoundary = intervals[intervals.length - 1][1] - inset;
    if (!Number.isFinite(leftBoundary) || !Number.isFinite(rightBoundary) || rightBoundary <= leftBoundary) continue;

    samples.push({
      leftX: leftBoundary - centerX,
      rightX: rightBoundary - centerX,
      z: sampleZ - centerZ
    });
  }

  if (samples.length < 4) return null;

  const minSampleZ = minZ - centerZ;
  const maxSampleZ = maxZ - centerZ;
  const endpointTolerance = Math.max(targetSampleSpacing * 0.25, GLASS_TOP_LIVE_EDGE_POINT_TOLERANCE);
  const firstSample = samples[0];
  if (firstSample && Math.abs(firstSample.z - minSampleZ) > endpointTolerance) {
    // Keep the glass flush to the slab ends even when the first top-surface hit lands one sample inside the perimeter.
    samples.unshift({
      leftX: firstSample.leftX,
      rightX: firstSample.rightX,
      z: minSampleZ
    });
  }

  const lastSample = samples[samples.length - 1];
  if (lastSample && Math.abs(lastSample.z - maxSampleZ) > endpointTolerance) {
    samples.push({
      leftX: lastSample.leftX,
      rightX: lastSample.rightX,
      z: maxSampleZ
    });
  }

  const outline = [];
  samples.forEach((sample) => addUniqueShapePoint(outline, sample.leftX, -sample.z));
  [...samples].reverse().forEach((sample) => addUniqueShapePoint(outline, sample.rightX, -sample.z));

  if (outline.length < 3) return null;
  if (THREE.ShapeUtils.isClockWise(outline)) outline.reverse();

  const glassShape = new THREE.Shape(outline);
  const glassGeometry = new THREE.ExtrudeGeometry(glassShape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: Math.max(12, Math.round(samples.length / 2)),
    steps: 1
  });

  // Build the footprint in tabletop X/Z space, then rotate the extrusion into thickness on Y.
  glassGeometry.rotateX(-Math.PI / 2);
  glassGeometry.translate(0, -thickness / 2, 0);
  glassGeometry.computeVertexNormals();
  return glassGeometry;
}

function computeTabletopTransform(partRoot, baseState, scaleMap, selectedUndersideY) {
  if (!partRoot || !baseState || !baseState.metrics) return;

  partRoot.scale.x = baseState.scale.x * (Number.isFinite(scaleMap.width) ? scaleMap.width : 1);
  partRoot.scale.z = baseState.scale.z * (Number.isFinite(scaleMap.length) ? scaleMap.length : 1);

  const metrics = getObjectMetrics(partRoot);
  if (!metrics) return;

  partRoot.position.x += baseState.metrics.center.x - metrics.center.x;
  partRoot.position.z += baseState.metrics.center.z - metrics.center.z;

  const desiredUnderside = Number.isFinite(selectedUndersideY)
    ? selectedUndersideY
    : baseState.metrics.min.y;
  partRoot.position.y += desiredUnderside - metrics.min.y;
}

function computeEpoxyTransform(partRoot, baseState, scaleMap, tabletopMetrics, tabletopRoot) {
  if (!partRoot || !baseState || !baseState.metrics || !tabletopMetrics) return;

  const liveEdgeResinFit = getLiveEdgeResinFit(tabletopRoot, tabletopMetrics);
  const epoxyBaseWidth = getPartSpan(baseState.metrics, 'x');
  const targetEpoxyWidth = liveEdgeResinFit && Number.isFinite(liveEdgeResinFit.width)
    ? liveEdgeResinFit.width
    : null;

  partRoot.scale.x = Number.isFinite(targetEpoxyWidth) && Number.isFinite(epoxyBaseWidth) && epoxyBaseWidth > 0
    ? baseState.scale.x * (targetEpoxyWidth / epoxyBaseWidth)
    : baseState.scale.x * (Number.isFinite(scaleMap.width) ? scaleMap.width : 1);
  partRoot.scale.z = baseState.scale.z * (Number.isFinite(scaleMap.length) ? scaleMap.length : 1);

  const tabletopThickness = getPartSpan(tabletopMetrics, 'y');
  const epoxyBaseThickness = getPartSpan(baseState.metrics, 'y');
  const targetEpoxyThickness = Number.isFinite(tabletopThickness)
    ? Math.max(tabletopThickness - (EPOXY_VERTICAL_INSET * 2), tabletopThickness * 0.85)
    : null;
  if (Number.isFinite(targetEpoxyThickness) && Number.isFinite(epoxyBaseThickness) && epoxyBaseThickness > 0) {
    partRoot.scale.y = baseState.scale.y * (targetEpoxyThickness / epoxyBaseThickness);
  }

  const metrics = getObjectMetrics(partRoot);
  if (!metrics) return;

  partRoot.position.x += liveEdgeResinFit && Number.isFinite(liveEdgeResinFit.centerX)
    ? liveEdgeResinFit.centerX - metrics.center.x
    : tabletopMetrics.center.x - metrics.center.x;
  partRoot.position.z += tabletopMetrics.center.z - metrics.center.z;
  partRoot.position.y += (tabletopMetrics.min.y + EPOXY_VERTICAL_INSET) - metrics.min.y;
}

function getLegTransformTargets(partConfig = {}, selectedDimensions = {}, legId = '') {
  const length = Number(selectedDimensions.length);
  const width = Number(selectedDimensions.width);

  if (legId === LEG_CUBE_ID) {
    return {
      spanX: Number.isFinite(width) ? Math.max(width - (CUBE_EDGE_SETBACK_IN * 2), 8) : null,
      spanZ: Number.isFinite(length) ? Math.max(length - (CUBE_EDGE_SETBACK_IN * 2), 8) : null,
      endSetback: 0
    };
  }

  if (legId === LEG_TRIPOD_ID) {
    return {
      spanX: Number.isFinite(width) ? Math.max(width - (TRIPOD_EDGE_SETBACK_IN * 2), width * 0.45) : null,
      spanZ: Number.isFinite(length) ? Math.max(length - (TRIPOD_EDGE_SETBACK_IN * 2), length * 0.45) : null,
      endSetback: 0
    };
  }

  return {
    spanX: getLegWidthForTable(width, { modelId: selectedDimensions.modelId }),
    spanZ: null,
    endSetback: getLegEndSetbackValue({ modelId: selectedDimensions.modelId, length, hasLegs: true })
  };
}

function computeLegTransform(partRoot, baseState, scaleMap, unitsPerInch, selectedUndersideY) {
  if (!partRoot || !baseState || !baseState.metrics) return;

  const partConfig = getPartConfig(partRoot);
  const selectedDimensions = scaleMap && scaleMap.selectedDimensions
    ? { ...scaleMap.selectedDimensions, modelId: (state && state.selections && state.selections.model) || null }
    : {};
  const targets = getLegTransformTargets(partConfig, selectedDimensions, partConfig.legId);

  const baseSpanX = getPartSpan(baseState.metrics, 'x');
  const baseSpanY = getPartSpan(baseState.metrics, 'y');
  const baseSpanZ = getPartSpan(baseState.metrics, 'z');
  const basePlateMetrics = getNamedMeshMetrics(partRoot, /plate/i);
  const baseContactSpanY = basePlateMetrics
    ? Math.max(0, basePlateMetrics.max.y - baseState.metrics.min.y)
    : baseSpanY;
  const desiredLegHeight = Number.isFinite(selectedUndersideY) ? selectedUndersideY : baseSpanY;
  const scaleY = Number.isFinite(baseContactSpanY) && baseContactSpanY > 0 && Number.isFinite(desiredLegHeight)
    ? desiredLegHeight / baseContactSpanY
    : 1;
  const scaleX = Number.isFinite(baseSpanX) && baseSpanX > 0 && Number.isFinite(targets.spanX)
    ? targets.spanX * unitsPerInch / baseSpanX
    : 1;
  const scaleZ = Number.isFinite(baseSpanZ) && baseSpanZ > 0 && Number.isFinite(targets.spanZ)
    ? targets.spanZ * unitsPerInch / baseSpanZ
    : (Number.isFinite(partConfig.tubeFallbackScale) ? partConfig.tubeFallbackScale : 1);

  partRoot.scale.x = baseState.scale.x * scaleX;
  partRoot.scale.y = baseState.scale.y * scaleY;
  partRoot.scale.z = baseState.scale.z * scaleZ;

  const metrics = getObjectMetrics(partRoot);
  if (!metrics) return;

  const centerX = 0;
  let centerZ = 0;
  if (partConfig.layout === 'paired-supports') {
    const totalLength = Number.isFinite(selectedDimensions.length)
      ? selectedDimensions.length * unitsPerInch
      : null;
    const endSetback = Number.isFinite(targets.endSetback)
      ? targets.endSetback * unitsPerInch
      : 0;
    const maxOffset = Number.isFinite(totalLength)
      ? Math.max(0, (totalLength / 2) - endSetback - ((metrics.max.z - metrics.min.z) / 2))
      : Math.abs(baseState.position.z);

    if (partConfig.placement === 'front') centerZ = maxOffset;
    else if (partConfig.placement === 'back') centerZ = -maxOffset;
  }

  partRoot.position.x += centerX - metrics.center.x;
  partRoot.position.y += 0 - metrics.min.y;
  partRoot.position.z += centerZ - metrics.center.z;
}

function computeGlassTopTransform(renderRoot, unitsPerInch) {
  if (!renderRoot) return;

  const glassRoot = renderRoot.getObjectByName(GLASS_TOP_PART_NAME);
  if (!glassRoot) return;

  if (!hasGlassTopAddon()) {
    glassRoot.visible = false;
    return;
  }

  const tabletopRoot = renderRoot.getObjectByName('tabletop');
  const tabletopMetrics = getObjectMetrics(tabletopRoot);
  if (!tabletopRoot || !tabletopMetrics) {
    glassRoot.visible = false;
    return;
  }

  const glassMesh = glassRoot.getObjectByName(`${GLASS_TOP_PART_NAME}-mesh`);
  if (!glassMesh) {
    glassRoot.visible = false;
    return;
  }

  const tabletopWidth = getPartSpan(tabletopMetrics, 'x');
  const tabletopLength = getPartSpan(tabletopMetrics, 'z');
  const shrinkAmount = GLASS_TOP_AXIS_REDUCTION_IN * unitsPerInch;
  const thickness = GLASS_TOP_THICKNESS_IN * unitsPerInch;
  const perimeterInset = shrinkAmount / 2;

  const glassWidth = Number.isFinite(tabletopWidth) ? Math.max(tabletopWidth - shrinkAmount, thickness * 3) : null;
  const glassLength = Number.isFinite(tabletopLength) ? Math.max(tabletopLength - shrinkAmount, thickness * 3) : null;
  if (!Number.isFinite(glassWidth) || !Number.isFinite(glassLength) || !Number.isFinite(thickness)) {
    glassRoot.visible = false;
    return;
  }

  const liveEdgeGlassGeometry = hasSelectedAddon(LIVE_EDGE_ADDON_ID)
    ? createLiveEdgeGlassGeometry(tabletopRoot, tabletopMetrics, thickness, perimeterInset, unitsPerInch)
    : null;

  glassRoot.visible = true;
  glassRoot.scale.set(1, 1, 1);
  glassMesh.scale.set(1, 1, 1);
  glassMesh.position.set(0, 0, 0);

  if (liveEdgeGlassGeometry) {
    replaceGlassMeshGeometry(glassMesh, liveEdgeGlassGeometry, 'live-edge');
  } else {
    ensureGlassBoxGeometry(glassMesh);
    glassRoot.scale.set(glassWidth, thickness, glassLength);
  }

  glassRoot.position.set(
    tabletopMetrics.center.x,
    tabletopMetrics.max.y + (thickness / 2) + GLASS_TOP_SURFACE_GAP,
    tabletopMetrics.center.z
  );
}

function getFirstMeshMaterial(root) {
  if (!root) return null;
  let material = null;
  root.traverse((child) => {
    if (material || !child.isMesh || !child.material) return;
    material = Array.isArray(child.material) ? child.material.find(Boolean) : child.material;
  });
  return material || null;
}

function rotateLowerShelfTexture(texture) {
  if (!texture) return texture;
  texture.center.set(0.5, 0.5);
  texture.rotation = Math.PI / 2;
  texture.needsUpdate = true;
  return texture;
}

function rotateLowerShelfMaterialTextures(material) {
  if (!material) return;
  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((key) => {
    if (material[key]) rotateLowerShelfTexture(material[key]);
  });
  material.needsUpdate = true;
}

function computeLowerShelfTransform(renderRoot, scaleMap, unitsPerInch, tabletopRoot = null) {
  if (!renderRoot) return;
  const lowerShelfRoot = renderRoot.getObjectByName(LOWER_SHELF_PART_NAME);
  if (!lowerShelfRoot) return;

  const selections = getSelections();
  const options = selections && selections.options && typeof selections.options === 'object'
    ? selections.options
    : {};
  const modelId = selections.model || null;
  const legId = options.legs || null;
  const shelfDimensions = getLowerShelfDimensions({
    modelId,
    legId,
    tubeId: options['tube-size'] || null,
    length: scaleMap && scaleMap.selectedDimensions ? Number(scaleMap.selectedDimensions.length) : NaN,
    width: scaleMap && scaleMap.selectedDimensions ? Number(scaleMap.selectedDimensions.width) : NaN,
    height: scaleMap && scaleMap.selectedDimensions ? Number(scaleMap.selectedDimensions.height) : NaN
  });

  if (!hasSelectedAddon(LOWER_SHELF_ADDON_ID) || !shelfDimensions) {
    lowerShelfRoot.visible = false;
    return;
  }

  const shelfMesh = lowerShelfRoot.getObjectByName(`${LOWER_SHELF_PART_NAME}-mesh`);
  const shelfWidth = shelfDimensions.width * unitsPerInch;
  const shelfLength = shelfDimensions.length * unitsPerInch;
  const shelfThickness = shelfDimensions.thickness * unitsPerInch;
  const shelfCenterY = (shelfDimensions.topHeightFromFloor * unitsPerInch) - (shelfThickness / 2);
  if (!shelfMesh || !Number.isFinite(shelfWidth) || !Number.isFinite(shelfLength) || !Number.isFinite(shelfThickness)) {
    lowerShelfRoot.visible = false;
    return;
  }

  lowerShelfRoot.visible = true;
  lowerShelfRoot.position.set(0, shelfCenterY, 0);
  lowerShelfRoot.scale.set(shelfWidth, shelfThickness, shelfLength);
}

function applyConfiguredPartTransforms(renderRoot, config = {}) {
  if (!renderRoot) return null;
  if (!renderRoot.userData.basePartStates) captureRenderRootBaseState(renderRoot);

  const basePartStates = renderRoot.userData.basePartStates || {};
  const rules = getDimensionRules(config);
  const scaleMap = getDimensionScaleMap(config);
  const selectedHeight = scaleMap && scaleMap.selectedDimensions
    ? Number(scaleMap.selectedDimensions.height)
    : NaN;
  const sourceHeight = rules && rules.sourceDimensions ? Number(rules.sourceDimensions.height) : NaN;
  const unitsPerInch = Number.isFinite(Number(rules.unitsPerInch)) ? Number(rules.unitsPerInch) : 0.0254;
  const heightDeltaUnits = Number.isFinite(selectedHeight) && Number.isFinite(sourceHeight)
    ? (selectedHeight - sourceHeight) * unitsPerInch
    : 0;
  const tabletopBaseState = basePartStates.tabletop && basePartStates.tabletop.metrics
    ? basePartStates.tabletop
    : null;
  const selectedUndersideY = tabletopBaseState
    ? tabletopBaseState.metrics.min.y + heightDeltaUnits
    : null;
  let tabletopMetrics = null;
  let tabletopRoot = null;

  Object.entries(basePartStates).forEach(([partName, baseState]) => {
    const partRoot = renderRoot.getObjectByName(partName);
    if (!partRoot || !baseState) return;

    partRoot.position.copy(baseState.position);
    partRoot.scale.copy(baseState.scale);
    partRoot.visible = true;

    const partConfig = getPartConfig(partRoot);
    const role = partConfig.role || '';

    if (partName === EPOXY_PREVIEW_PART_NAME && tabletopMetrics) {
      computeEpoxyTransform(partRoot, baseState, scaleMap, tabletopMetrics, tabletopRoot);
      return;
    }

    if (role === 'tabletop' || partName.startsWith('tabletop')) {
      computeTabletopTransform(partRoot, baseState, scaleMap, selectedUndersideY);
      if (partName === 'tabletop') {
        tabletopRoot = partRoot;
        tabletopMetrics = getObjectMetrics(partRoot);
      }
      return;
    }

    if (role === 'leg' || partName.startsWith('leg-')) {
      computeLegTransform(partRoot, baseState, scaleMap, unitsPerInch, selectedUndersideY);
      return;
    }

    const metrics = getObjectMetrics(partRoot);
    if (!metrics || !baseState.metrics) return;
    partRoot.position.x += baseState.metrics.center.x - metrics.center.x;
    partRoot.position.z += baseState.metrics.center.z - metrics.center.z;
  });

  computeGlassTopTransform(renderRoot, unitsPerInch);
  computeLowerShelfTransform(renderRoot, scaleMap, unitsPerInch, tabletopRoot);

  return scaleMap;
}

function getScaleVector(scaleValue) {
  if (Array.isArray(scaleValue) && scaleValue.length === 3) {
    return new THREE.Vector3(
      Number(scaleValue[0]) || 1,
      Number(scaleValue[1]) || 1,
      Number(scaleValue[2]) || 1
    );
  }
  if (Number.isFinite(Number(scaleValue))) {
    const uniform = Number(scaleValue) || 1;
    return new THREE.Vector3(uniform, uniform, uniform);
  }
  return new THREE.Vector3(1, 1, 1);
}

function getVectorTriplet(value, fallback = 0) {
  if (Array.isArray(value) && value.length === 3) {
    return value.map((entry) => Number(entry) || 0);
  }
  return [fallback, fallback, fallback];
}

function resolvePartConfig(partConfig = {}) {
  const defaultAssetPath = typeof partConfig.assetPath === 'string' ? partConfig.assetPath.trim() : '';
  const addonAssetPaths = partConfig.addonAssetPaths && typeof partConfig.addonAssetPaths === 'object'
    ? partConfig.addonAssetPaths
    : null;
  if (!addonAssetPaths) return { ...partConfig, assetPath: defaultAssetPath };

  const selectedAddons = getSelectedAddons();
  const selectedAddonOverride = selectedAddons.find((addonId) => (
    typeof addonId === 'string'
    && addonAssetPaths[addonId]
    && (
      (typeof addonAssetPaths[addonId] === 'string' && addonAssetPaths[addonId].trim())
      || (
        typeof addonAssetPaths[addonId] === 'object'
        && typeof addonAssetPaths[addonId].assetPath === 'string'
        && addonAssetPaths[addonId].assetPath.trim()
      )
    )
  ));

  if (!selectedAddonOverride) return { ...partConfig, assetPath: defaultAssetPath };

  const selectedOverrideValue = addonAssetPaths[selectedAddonOverride];
  if (typeof selectedOverrideValue === 'string') {
    return {
      ...partConfig,
      assetPath: selectedOverrideValue.trim()
    };
  }

  if (selectedOverrideValue && typeof selectedOverrideValue === 'object') {
    const overrideAssetPath = typeof selectedOverrideValue.assetPath === 'string'
      ? selectedOverrideValue.assetPath.trim()
      : defaultAssetPath;
    return {
      ...partConfig,
      ...selectedOverrideValue,
      assetPath: overrideAssetPath
    };
  }

  return { ...partConfig, assetPath: defaultAssetPath };
}

function resolvePartAssetPath(partConfig = {}) {
  return resolvePartConfig(partConfig).assetPath || '';
}

function normalizeRenderablePart(partConfig = {}, index = 0) {
  const resolvedPartConfig = resolvePartConfig(partConfig);
  const assetPath = resolvedPartConfig.assetPath || '';
  return {
    name: typeof resolvedPartConfig.name === 'string' && resolvedPartConfig.name.trim()
      ? resolvedPartConfig.name.trim()
      : `part-${index + 1}`,
    role: typeof resolvedPartConfig.role === 'string' && resolvedPartConfig.role.trim()
      ? resolvedPartConfig.role.trim()
      : '',
    placement: typeof resolvedPartConfig.placement === 'string' && resolvedPartConfig.placement.trim()
      ? resolvedPartConfig.placement.trim()
      : '',
    layout: typeof resolvedPartConfig.layout === 'string' && resolvedPartConfig.layout.trim()
      ? resolvedPartConfig.layout.trim()
      : '',
    legId: typeof resolvedPartConfig.legId === 'string' && resolvedPartConfig.legId.trim()
      ? resolvedPartConfig.legId.trim()
      : '',
    tubeFallbackScale: Number.isFinite(Number(resolvedPartConfig.tubeFallbackScale))
      ? Number(resolvedPartConfig.tubeFallbackScale)
      : 1,
    assetPath,
    materialSourceAssetPath: typeof resolvedPartConfig.materialSourceAssetPath === 'string'
      ? resolvedPartConfig.materialSourceAssetPath.trim()
      : '',
    scale: Array.isArray(resolvedPartConfig.scale) && resolvedPartConfig.scale.length === 3
      ? resolvedPartConfig.scale.map((entry) => Number(entry) || 1)
      : (Number.isFinite(Number(resolvedPartConfig.scale)) ? Number(resolvedPartConfig.scale) || 1 : 1),
    surfaceInsetScale: Array.isArray(resolvedPartConfig.surfaceInsetScale) && resolvedPartConfig.surfaceInsetScale.length === 3
      ? resolvedPartConfig.surfaceInsetScale.map((entry) => Number(entry) || 1)
      : null,
    surfaceInsetOffset: Array.isArray(resolvedPartConfig.surfaceInsetOffset) && resolvedPartConfig.surfaceInsetOffset.length === 3
      ? resolvedPartConfig.surfaceInsetOffset.map((entry) => Number(entry) || 0)
      : DEFAULT_SURFACE_INSET_OFFSET,
    rotation: getVectorTriplet(resolvedPartConfig.rotation),
    positionOffset: getVectorTriplet(resolvedPartConfig.positionOffset),
    receiveModelShadows: resolvedPartConfig.receiveModelShadows === true
  };
}

function createGlassTopPart() {
  const glassRoot = new THREE.Group();
  glassRoot.name = GLASS_TOP_PART_NAME;
  glassRoot.userData.partConfig = {
    role: 'glass'
  };

  const glassGeometry = new THREE.BoxGeometry(1, 1, 1);
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe7f5ff,
    metalness: 0,
    roughness: 0.08,
    transmission: 0,
    transparent: true,
    opacity: 0.2,
    envMapIntensity: 0.96,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.FrontSide
  });
  // Use a thin-tint overlay so the glass reads clearly without swallowing the epoxy preview beneath it.
  glassMaterial.depthWrite = false;
  glassMaterial.premultipliedAlpha = true;

  const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
  glassMesh.name = `${GLASS_TOP_PART_NAME}-mesh`;
  glassMesh.userData.geometryMode = 'box';
  glassMesh.castShadow = false;
  glassMesh.receiveShadow = false;
  glassMesh.renderOrder = 12;
  glassRoot.add(glassMesh);
  glassRoot.visible = false;
  return glassRoot;
}

function createLowerShelfPart() {
  const shelfRoot = new THREE.Group();
  shelfRoot.name = LOWER_SHELF_PART_NAME;
  shelfRoot.userData.partConfig = {
    role: 'lower-shelf'
  };

  const shelfMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a5334,
    roughness: 0.5,
    metalness: 0.02
  });
  shelfMaterial.userData = { lowerShelfMaterial: true };

  const shelfMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shelfMaterial);
  shelfMesh.name = `${LOWER_SHELF_PART_NAME}-mesh`;
  shelfMesh.castShadow = true;
  shelfMesh.receiveShadow = true;
  shelfMesh.frustumCulled = false;
  shelfRoot.add(shelfMesh);
  shelfRoot.visible = false;
  return shelfRoot;
}

function applySurfaceInsetTransform(assetRoot, partConfig = {}) {
  if (!assetRoot || !partConfig.surfaceInsetScale) return;

  // Keep epoxy marginally inside the wood shell by design so the viewer avoids z-fighting.
  assetRoot.scale.multiply(getScaleVector(partConfig.surfaceInsetScale));
}

function getRenderableParts(config = {}) {
  const candidateParts = Array.isArray(config.parts) && config.parts.length
    ? config.parts
    : [config];

  return candidateParts
    .filter((partConfig) => partConfig && resolvePartAssetPath(partConfig))
    .map((partConfig, index) => normalizeRenderablePart(partConfig, index));
}

function getRenderSignature(config = {}) {
  return JSON.stringify(getRenderableParts(config));
}

function getRenderAssetPaths(config = {}) {
  return getRenderableParts(config).map((partConfig) => partConfig.assetPath);
}

async function loadTabletopTexture(texturePath) {
  if (!texturePath) return null;
  if (!tabletopTexturePromises.has(texturePath)) {
    const textureLoader = new THREE.TextureLoader();
    tabletopTexturePromises.set(texturePath, textureLoader.loadAsync(texturePath).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI / 2;
      if (renderer && renderer.capabilities) {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      return texture;
    }).catch((error) => {
      tabletopTexturePromises.delete(texturePath);
      throw error;
    }));
  }

  return tabletopTexturePromises.get(texturePath);
}

async function loadLowerShelfTexture(texturePath) {
  if (!texturePath) return null;
  if (!lowerShelfTexturePromises.has(texturePath)) {
    const textureLoader = new THREE.TextureLoader();
    lowerShelfTexturePromises.set(texturePath, textureLoader.loadAsync(texturePath).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      if (renderer && renderer.capabilities) {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      return rotateLowerShelfTexture(texture);
    }).catch((error) => {
      lowerShelfTexturePromises.delete(texturePath);
      throw error;
    }));
  }

  return lowerShelfTexturePromises.get(texturePath);
}

function cloneReusableMaterial(material) {
  if (!material || typeof material.clone !== 'function') return material;

  const clonedMaterial = material.clone();
  Object.keys(clonedMaterial).forEach((key) => {
    const value = clonedMaterial[key];
    if (value && value.isTexture && typeof value.clone === 'function') {
      clonedMaterial[key] = value.clone();
      if (renderer && renderer.capabilities) {
        clonedMaterial[key].anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
    }
  });

  if ('normalScale' in material && material.normalScale && typeof material.normalScale.clone === 'function') {
    clonedMaterial.normalScale = material.normalScale.clone();
  }
  if (
    'clearcoatNormalScale' in material
    && material.clearcoatNormalScale
    && typeof material.clearcoatNormalScale.clone === 'function'
  ) {
    clonedMaterial.clearcoatNormalScale = material.clearcoatNormalScale.clone();
  }

  clonedMaterial.needsUpdate = true;
  return clonedMaterial;
}

async function loadMaterialSourceTemplates(assetPath) {
  if (!assetPath) return [];
  if (!materialSourcePromises.has(assetPath)) {
    if (!loader) loader = new GLTFLoader();
    materialSourcePromises.set(assetPath, loader.loadAsync(assetPath).then((gltf) => {
      const sourceRoot = gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null);
      if (!sourceRoot) throw new Error('Material donor GLB did not contain a scene.');

      const templates = [];
      sourceRoot.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        templates.push(materials.filter(Boolean));
      });

      if (!templates.length) throw new Error('Material donor GLB did not contain any mesh materials.');
      return templates;
    }).catch((error) => {
      materialSourcePromises.delete(assetPath);
      throw error;
    }));
  }

  return materialSourcePromises.get(assetPath);
}

async function applyConfiguredMaterialSource(assetRoot, partConfig = {}) {
  const materialSourceAssetPath = partConfig && typeof partConfig.materialSourceAssetPath === 'string'
    ? partConfig.materialSourceAssetPath.trim()
    : '';
  if (!assetRoot || !materialSourceAssetPath) return;

  const templates = await loadMaterialSourceTemplates(materialSourceAssetPath);
  if (!Array.isArray(templates) || !templates.length) return;

  let meshIndex = 0;
  assetRoot.traverse((child) => {
    if (!child.isMesh) return;
    const templateSet = templates[Math.min(meshIndex, templates.length - 1)] || [];
    meshIndex += 1;
    if (!templateSet.length) return;

    const clonedMaterials = templateSet.map((material) => cloneReusableMaterial(material)).filter(Boolean);
    if (!clonedMaterials.length) return;
    child.material = clonedMaterials.length === 1 ? clonedMaterials[0] : clonedMaterials;
  });
}

async function loadLegFinishDefinitions() {
  if (!legFinishDataPromise) {
    legFinishDataPromise = loadData(LEG_FINISH_DATA_PATH).then((entries) => {
      if (!Array.isArray(entries)) throw new Error('Leg finish catalog must be an array.');
      return entries;
    }).catch((error) => {
      legFinishDataPromise = null;
      throw error;
    });
  }

  return legFinishDataPromise;
}

async function loadColorDefinitions() {
  if (!colorDataPromise) {
    colorDataPromise = loadData(COLOR_DATA_PATH).then((entries) => {
      if (!Array.isArray(entries)) throw new Error('Color catalog must be an array.');
      return entries;
    }).catch((error) => {
      colorDataPromise = null;
      throw error;
    });
  }

  return colorDataPromise;
}

async function loadFinishDefinitions() {
  if (!finishDataPromise) {
    finishDataPromise = loadData(FINISH_DATA_PATH).then((entries) => {
      if (!entries || typeof entries !== 'object') throw new Error('Finish catalog must be an object.');
      return entries;
    }).catch((error) => {
      finishDataPromise = null;
      throw error;
    });
  }

  return finishDataPromise;
}

async function loadResinPreviewTexture(texturePath) {
  const textureLoader = new THREE.TextureLoader();
  const texture = await textureLoader.loadAsync(texturePath);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (renderer && renderer.capabilities) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return texture;
}

function cloneMaterialWithTexture(material, texture) {
  if (!material || typeof material.clone !== 'function') return material;
  const clonedMaterial = material.clone();
  if ('color' in clonedMaterial && clonedMaterial.color && typeof clonedMaterial.color.setHex === 'function') {
    clonedMaterial.color.setHex(0xffffff);
  }
  if ('map' in clonedMaterial) clonedMaterial.map = texture;
  clonedMaterial.needsUpdate = true;
  return clonedMaterial;
}

function cloneMaterialForResinPreview(material, texture, resinTint = DEFAULT_RESIN_VIEWER_TINT) {
  const sourceMaterial = material && typeof material === 'object' ? material : null;
  const previewMaterial = sourceMaterial && sourceMaterial.isMeshPhysicalMaterial
    ? sourceMaterial.clone()
    : new THREE.MeshPhysicalMaterial();
  const selectedColorId = state && state.selections && state.selections.options
    ? state.selections.options.color || null
    : null;
  const isSolidBlack = selectedColorId === 'color-08';

  if (sourceMaterial) {
    if ('side' in sourceMaterial) previewMaterial.side = sourceMaterial.side;
    if ('alphaMap' in sourceMaterial) previewMaterial.alphaMap = sourceMaterial.alphaMap || null;
    if ('normalMap' in sourceMaterial) previewMaterial.normalMap = sourceMaterial.normalMap || null;
    if ('normalScale' in sourceMaterial && sourceMaterial.normalScale) {
      previewMaterial.normalScale = typeof sourceMaterial.normalScale.clone === 'function'
        ? sourceMaterial.normalScale.clone()
        : sourceMaterial.normalScale;
    }
    if ('aoMap' in sourceMaterial) previewMaterial.aoMap = sourceMaterial.aoMap || null;
    if ('aoMapIntensity' in sourceMaterial && Number.isFinite(Number(sourceMaterial.aoMapIntensity))) {
      previewMaterial.aoMapIntensity = Number(sourceMaterial.aoMapIntensity);
    }
  }

  if (previewMaterial.color && typeof previewMaterial.color.setHex === 'function') {
    previewMaterial.color.setHex(0xffffff);
  }
  previewMaterial.map = texture;
  previewMaterial.transparent = !isSolidBlack;
  previewMaterial.opacity = isSolidBlack
    ? 1
    : (sourceMaterial && Number.isFinite(Number(sourceMaterial.opacity))
      ? Math.min(1, Number(sourceMaterial.opacity) * 2)
      : 0.98);
  if ('metalness' in previewMaterial) previewMaterial.metalness = 0.03;
  if ('roughness' in previewMaterial) previewMaterial.roughness = 0.16;
  if ('transmission' in previewMaterial) previewMaterial.transmission = isSolidBlack ? 0 : RESIN_PREVIEW_TOP_VIEW_TRANSMISSION;
  if ('thickness' in previewMaterial) previewMaterial.thickness = 1.1;
  if ('ior' in previewMaterial) previewMaterial.ior = 1.46;
  if ('envMapIntensity' in previewMaterial) previewMaterial.envMapIntensity = 1.08;
  if ('clearcoat' in previewMaterial) previewMaterial.clearcoat = 0.24;
  if ('clearcoatRoughness' in previewMaterial) previewMaterial.clearcoatRoughness = 0.18;
  if ('attenuationDistance' in previewMaterial) previewMaterial.attenuationDistance = RESIN_PREVIEW_TOP_VIEW_ATTENUATION_DISTANCE;
  if ('attenuationColor' in previewMaterial) previewMaterial.attenuationColor = new THREE.Color(resinTint);
  previewMaterial.userData = {
    ...(previewMaterial.userData || {}),
    resinPreviewMaterial: !isSolidBlack
  };
  previewMaterial.needsUpdate = true;
  return previewMaterial;
}

function getDedicatedGradientTexturePath(selectedColor, selectedGradientId) {
  if (!selectedColor || selectedGradientId !== COLOR_GRADIENT_LIGHT_CENTER_ID) return '';
  const gradientImages = selectedColor.gradientImages && typeof selectedColor.gradientImages === 'object'
    ? selectedColor.gradientImages
    : {};
  return typeof gradientImages['light-center'] === 'string'
    ? gradientImages['light-center'].trim()
    : '';
}

function getResinPreviewViewBlend() {
  if (!camera) return 1;
  camera.getWorldDirection(cameraViewDirection);
  const verticalViewAmount = THREE.MathUtils.clamp(Math.abs(cameraViewDirection.y), 0, 1);
  return THREE.MathUtils.smoothstep(verticalViewAmount, RESIN_PREVIEW_VIEW_BLEND_MIN, RESIN_PREVIEW_VIEW_BLEND_MAX);
}

function updateResinPreviewMaterialsForView() {
  if (!activeResinPreviewMaterials.length) return;
  const viewBlend = getResinPreviewViewBlend();
  const transmission = THREE.MathUtils.lerp(
    RESIN_PREVIEW_END_VIEW_TRANSMISSION,
    RESIN_PREVIEW_TOP_VIEW_TRANSMISSION,
    viewBlend
  );
  const attenuationDistance = THREE.MathUtils.lerp(
    RESIN_PREVIEW_END_VIEW_ATTENUATION_DISTANCE,
    RESIN_PREVIEW_TOP_VIEW_ATTENUATION_DISTANCE,
    viewBlend
  );

  activeResinPreviewMaterials.forEach((material) => {
    if (!material || !material.userData?.resinPreviewMaterial) return;
    if ('transmission' in material) material.transmission = transmission;
    if ('attenuationDistance' in material) material.attenuationDistance = attenuationDistance;
  });
}

function setActiveResinPreviewMaterialsFromRoot(renderRoot) {
  activeResinPreviewMaterials = [];
  if (!renderRoot) return;

  renderRoot.traverse((child) => {
    if (!child?.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material?.userData?.resinPreviewMaterial) activeResinPreviewMaterials.push(material);
    });
  });
}

function cloneMaterialWithFinish(material, finishMaterial = {}) {
  if (!material || typeof material.clone !== 'function') return material;

  const clonedMaterial = material.clone();
  const {
    baseColor,
    metalness,
    roughness,
    envIntensity,
    clearcoat,
    clearcoatRoughness
  } = finishMaterial;

  if (
    typeof baseColor === 'string'
    && 'color' in clonedMaterial
    && clonedMaterial.color
    && typeof clonedMaterial.color.set === 'function'
  ) {
    clonedMaterial.color.set(baseColor);
  }
  if (Number.isFinite(Number(metalness)) && 'metalness' in clonedMaterial) {
    clonedMaterial.metalness = Number(metalness);
  }
  if (Number.isFinite(Number(roughness)) && 'roughness' in clonedMaterial) {
    clonedMaterial.roughness = Number(roughness);
  }
  if (Number.isFinite(Number(envIntensity)) && 'envMapIntensity' in clonedMaterial) {
    clonedMaterial.envMapIntensity = Number(envIntensity);
  }
  if (Number.isFinite(Number(clearcoat)) && 'clearcoat' in clonedMaterial) {
    clonedMaterial.clearcoat = Number(clearcoat);
  }
  if (Number.isFinite(Number(clearcoatRoughness)) && 'clearcoatRoughness' in clonedMaterial) {
    clonedMaterial.clearcoatRoughness = Number(clearcoatRoughness);
  }

  clonedMaterial.needsUpdate = true;
  return clonedMaterial;
}

function cloneMaterialWithTabletopTint(material, tintConfig = {}) {
  if (!material || typeof material.clone !== 'function') return material;

  const clonedMaterial = material.clone();
  const previousOnBeforeCompile = clonedMaterial.onBeforeCompile;
  const previousCustomProgramCacheKey = typeof clonedMaterial.customProgramCacheKey === 'function'
    ? clonedMaterial.customProgramCacheKey.bind(clonedMaterial)
    : null;
  const brightness = Number.isFinite(Number(tintConfig.brightness)) ? Number(tintConfig.brightness) : 1;
  const saturation = Number.isFinite(Number(tintConfig.saturation)) ? Number(tintConfig.saturation) : 1;
  const tintMix = Number.isFinite(Number(tintConfig.tintMix)) ? Number(tintConfig.tintMix) : 0;
  const tintColor = typeof tintConfig.tintColor === 'string' && tintConfig.tintColor.trim()
    ? new THREE.Color(tintConfig.tintColor)
    : new THREE.Color(0xffffff);

  // Tint in shader space so texture-backed walnut can get lighter, darker, and less saturated.
  clonedMaterial.onBeforeCompile = (shader, rendererInstance) => {
    if (typeof previousOnBeforeCompile === 'function') previousOnBeforeCompile.call(clonedMaterial, shader, rendererInstance);
    shader.uniforms.tabletopTintColor = { value: tintColor };
    shader.uniforms.tabletopTintBrightness = { value: brightness };
    shader.uniforms.tabletopTintSaturation = { value: saturation };
    shader.uniforms.tabletopTintMix = { value: tintMix };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 tabletopTintColor;
        uniform float tabletopTintBrightness;
        uniform float tabletopTintSaturation;
        uniform float tabletopTintMix;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float tabletopTintGray = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(tabletopTintGray), diffuseColor.rgb, tabletopTintSaturation);
        diffuseColor.rgb *= tabletopTintBrightness;
        diffuseColor.rgb = mix(diffuseColor.rgb, tabletopTintColor, tabletopTintMix);
        diffuseColor.rgb = clamp(diffuseColor.rgb, 0.0, 1.0);`
      );
  };
  clonedMaterial.customProgramCacheKey = () => [
    'tabletop-finish-tint',
    previousCustomProgramCacheKey ? previousCustomProgramCacheKey() : '',
    brightness,
    saturation,
    tintConfig.tintColor || '',
    tintMix
  ].join(':');
  clonedMaterial.needsUpdate = true;
  return clonedMaterial;
}

async function applySelectedTabletopSheen(renderRoot) {
  if (!renderRoot) return;

  const selectedSheenId = state && state.selections && state.selections.options
    ? state.selections.options['finish-sheen'] || null
    : null;
  if (!selectedSheenId) return;

  const tabletopRoot = renderRoot.getObjectByName('tabletop');
  if (!tabletopRoot) return;

  try {
    const finishDefinitions = await loadFinishDefinitions();
    const sheens = Array.isArray(finishDefinitions && finishDefinitions.sheens)
      ? finishDefinitions.sheens
      : [];
    const selectedSheen = sheens.find((entry) => entry && entry.id === selectedSheenId);
    const finishMaterial = selectedSheen && selectedSheen.viewerMaterial;
    if (!finishMaterial || typeof finishMaterial !== 'object') return;

    tabletopRoot.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => cloneMaterialWithFinish(material, finishMaterial));
      } else {
        child.material = cloneMaterialWithFinish(child.material, finishMaterial);
      }
    });

    log.info('Applied tabletop sheen material override', {
      sheenId: selectedSheenId,
      finishMaterial
    });
  } catch (error) {
    log.warn('Failed to apply tabletop sheen material override', {
      sheenId: selectedSheenId,
      error
    });
  }
}

async function applySelectedTabletopTint(renderRoot) {
  if (!renderRoot) return;

  const selectedTintId = state && state.selections && state.selections.options
    ? state.selections.options['finish-tint'] || null
    : null;
  const tintConfig = TABLETOP_FINISH_TINTS[selectedTintId];
  if (!tintConfig) return;

  const tabletopRoot = renderRoot.getObjectByName('tabletop');
  if (!tabletopRoot) return;

  tabletopRoot.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => cloneMaterialWithTabletopTint(material, tintConfig));
    } else {
      child.material = cloneMaterialWithTabletopTint(child.material, tintConfig);
    }
  });

  log.info('Applied tabletop finish tint override', {
    tintId: selectedTintId,
    tintLabel: tintConfig.label
  });
}

async function applySelectedTabletopMaterial(renderRoot) {
  if (!renderRoot) return;

  const selectedMaterialId = state && state.selections && state.selections.options
    ? state.selections.options.material
    : null;
  const texturePath = TABLETOP_MATERIAL_TEXTURES[selectedMaterialId];
  if (!texturePath) return;

  const tabletopRoot = renderRoot.getObjectByName('tabletop');
  if (!tabletopRoot) return;

  try {
    const texture = await loadTabletopTexture(texturePath);
    if (!texture) return;
    tabletopRoot.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => cloneMaterialWithTexture(material, texture));
      } else {
        child.material = cloneMaterialWithTexture(child.material, texture);
      }
    });
    log.info('Applied tabletop material texture override', {
      materialId: selectedMaterialId,
      texturePath
    });
  } catch (error) {
    log.warn('Failed to apply tabletop material texture override', {
      materialId: selectedMaterialId,
      texturePath,
      error
    });
  }
}

async function applySelectedLowerShelfMaterial(renderRoot) {
  if (!renderRoot) return;

  const lowerShelfRoot = renderRoot.getObjectByName(LOWER_SHELF_PART_NAME);
  const shelfMesh = lowerShelfRoot && lowerShelfRoot.getObjectByName(`${LOWER_SHELF_PART_NAME}-mesh`);
  if (!shelfMesh) return;

  const tabletopRoot = renderRoot.getObjectByName('tabletop');
  const sourceMaterial = getFirstMeshMaterial(tabletopRoot);
  const previousMaterial = shelfMesh.material;
  let nextMaterial = sourceMaterial && typeof sourceMaterial.clone === 'function'
    ? cloneReusableMaterial(sourceMaterial)
    : previousMaterial;

  const selectedMaterialId = state && state.selections && state.selections.options
    ? state.selections.options.material || null
    : null;

  if (selectedMaterialId === MATERIAL_BLACK_WALNUT_ID) {
    try {
      const texture = await loadLowerShelfTexture(LOWER_SHELF_LINEAR_WALNUT_TEXTURE_PATH);
      if (texture) {
        const texturedMaterial = cloneMaterialWithTexture(nextMaterial, texture);
        if (texturedMaterial !== nextMaterial && nextMaterial !== previousMaterial) disposeMaterial(nextMaterial);
        nextMaterial = texturedMaterial;
      }
    } catch (error) {
      log.warn('Failed to apply lower shelf walnut texture', {
        texturePath: LOWER_SHELF_LINEAR_WALNUT_TEXTURE_PATH,
        error
      });
    }
  }

  rotateLowerShelfMaterialTextures(nextMaterial);
  if (nextMaterial && typeof nextMaterial === 'object') {
    nextMaterial.userData = {
      ...(nextMaterial.userData || {}),
      lowerShelfMaterial: true
    };
  }

  shelfMesh.material = nextMaterial;
  shelfMesh.userData.sourceMaterialUuid = sourceMaterial && sourceMaterial.uuid ? sourceMaterial.uuid : '';

  if (
    previousMaterial
    && previousMaterial !== nextMaterial
    && previousMaterial.userData
    && previousMaterial.userData.lowerShelfMaterial
  ) {
    disposeMaterial(previousMaterial);
  }
}

async function applySelectedResinPreview(renderRoot) {
  if (!renderRoot) return;
  activeResinPreviewMaterials = [];

  const selectedColorId = state && state.selections && state.selections.options
    ? state.selections.options.color || null
    : null;
  const selectedGradientId = state && state.selections && state.selections.options
    ? state.selections.options['color-gradient'] || null
    : null;
  if (!selectedColorId) return;

  const epoxyRoot = renderRoot.getObjectByName(EPOXY_PREVIEW_PART_NAME);
  if (!epoxyRoot) return;

  try {
    const colorDefinitions = await loadColorDefinitions();
    const selectedColor = colorDefinitions.find((entry) => entry && entry.id === selectedColorId);
    const gradientTexturePath = getDedicatedGradientTexturePath(selectedColor, selectedGradientId);
    const texturePath = gradientTexturePath || (selectedColor && typeof selectedColor.image === 'string'
      ? selectedColor.image.trim()
      : '');
    if (!texturePath) return;

    const texture = await loadResinPreviewTexture(texturePath);
    const resinTint = RESIN_VIEWER_TINTS[selectedColorId] || DEFAULT_RESIN_VIEWER_TINT;

    epoxyRoot.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => cloneMaterialForResinPreview(material, texture, resinTint));
      } else {
        child.material = cloneMaterialForResinPreview(child.material, texture, resinTint);
      }
    });
    setActiveResinPreviewMaterialsFromRoot(renderRoot);
    updateResinPreviewMaterialsForView();

    log.info('Applied resin preview test material override', {
      colorId: selectedColorId,
      gradientId: selectedGradientId,
      texturePath,
      epoxyPartName: EPOXY_PREVIEW_PART_NAME
    });
  } catch (error) {
    log.warn('Failed to apply resin preview test material override', {
      colorId: selectedColorId,
      gradientId: selectedGradientId,
      error
    });
  }
}

async function applySelectedLegFinish(renderRoot) {
  if (!renderRoot) return;

  const selectedLegFinishId = state && state.selections && state.selections.options
    ? state.selections.options['leg-finish'] || null
    : null;
  if (!selectedLegFinishId) return;

  try {
    const legFinishDefinitions = await loadLegFinishDefinitions();
    const selectedFinish = legFinishDefinitions.find((entry) => entry && entry.id === selectedLegFinishId);
    const finishMaterial = selectedFinish && selectedFinish.viewerMaterial;
    if (!finishMaterial || typeof finishMaterial !== 'object') return;

    renderRoot.children.forEach((partRoot) => {
      const role = partRoot && partRoot.userData && partRoot.userData.partConfig
        ? partRoot.userData.partConfig.role
        : '';
      if (role !== 'leg' && !partRoot.name.startsWith('leg-')) return;

      partRoot.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (Array.isArray(child.material)) {
          child.material = child.material.map((material) => cloneMaterialWithFinish(material, finishMaterial));
        } else {
          child.material = cloneMaterialWithFinish(child.material, finishMaterial);
        }
      });
    });

    log.info('Applied leg finish material override', {
      legFinishId: selectedLegFinishId,
      finishMaterial
    });
  } catch (error) {
    log.warn('Failed to apply leg finish material override', {
      legFinishId: selectedLegFinishId,
      error
    });
  }
}

function disposeMaterial(material) {
  if (!material) return;
  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'].forEach((key) => {
    if (material[key] && typeof material[key].dispose === 'function') material[key].dispose();
  });
  if (typeof material.dispose === 'function') material.dispose();
}

function disposeObject3D(root) {
  if (!root) return;
  root.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
    else disposeMaterial(child.material);
  });
}

function setLiveStatus(message) {
  if (dom.liveRegion) dom.liveRegion.textContent = message;
}

function hideStatusBox() {
  if (!dom.statusBox) return;
  dom.statusBox.hidden = true;
  if (dom.statusSpinner) dom.statusSpinner.hidden = true;
  if (dom.statusBox.dataset) delete dom.statusBox.dataset.statusTone;
}

function showStatusBox({ title = '', copy = '', loading = false } = {}) {
  if (!dom.statusBox || !dom.statusTitle || !dom.statusCopy || !dom.statusSpinner) return;
  dom.statusTitle.textContent = title;
  dom.statusCopy.textContent = copy;
  dom.statusSpinner.hidden = !loading;
  dom.statusBox.dataset.statusTone = loading ? 'loading' : 'note';
  dom.statusBox.hidden = false;
}

function setViewerState(mode, { errorCopy } = {}) {
  if (dom.surface) dom.surface.dataset.viewerState = mode;
  if (dom.empty) dom.empty.hidden = mode !== 'empty';
  if (dom.error) dom.error.hidden = mode !== 'error';
  if (typeof errorCopy === 'string' && dom.errorCopy) dom.errorCopy.textContent = errorCopy;
}

function escapeSelectorValue(value) {
  const text = String(value || '');
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(text);
  return text.replace(/["\\]/g, '\\$&');
}

function cleanSelectOptionLabel(label) {
  return String(label || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function getFirstTextContent(selectors = []) {
  if (typeof document === 'undefined' || !Array.isArray(selectors)) return '';
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element ? String(element.textContent || '').trim() : '';
    if (text) return text;
  }
  return '';
}

function getOptionDisplayName(category, id, fallback = '') {
  if (!category || !id) return fallback || '';
  const safeId = escapeSelectorValue(id);
  const safeCategory = escapeSelectorValue(category);
  if (category === 'addon') {
    const addonLabel = getFirstTextContent([
      `.addons-dropdown-option[data-addon-id="${safeId}"] .addons-dropdown-option-label`,
      `.addons-tile[data-addon-id="${safeId}"] .addons-tile-label`,
      `.addons-dropdown-select option[value="${safeId}"]`
    ]);
    return cleanSelectOptionLabel(addonLabel) || fallback || id;
  }

  const optionLabel = getFirstTextContent([
    `.option-card[data-category="${safeCategory}"][data-id="${safeId}"] .title`,
    `.option-card[data-id="${safeId}"] .title`
  ]);
  return optionLabel || fallback || id;
}

function formatCustomSelectionName(optionTitle, contextualName) {
  return String(optionTitle || '').trim().toLowerCase() === 'custom'
    ? contextualName
    : optionTitle;
}

function formatSelectionWithDescriptor(optionTitle, descriptor) {
  const title = String(optionTitle || '').trim();
  const label = String(descriptor || '').trim();
  if (!title || !label) return title || label;
  return title.toLowerCase().includes(label.toLowerCase()) ? title : `${title} ${label}`;
}

function formatJoinedSelectionNames(names = []) {
  const uniqueNames = [];
  names.forEach((name) => {
    const text = String(name || '').trim();
    if (text && !uniqueNames.includes(text)) uniqueNames.push(text);
  });
  return uniqueNames;
}

function pushViewerNotice(notices, title, reason, selectionNames = title) {
  if (!title || !reason) return;
  if (notices.some((notice) => notice.title === title && notice.reason === reason)) return;
  const names = Array.isArray(selectionNames) ? selectionNames : [selectionNames];
  notices.push({ title, reason, selectionNames: formatJoinedSelectionNames(names) });
}

function summarizeViewerNotices(notices = []) {
  if (!Array.isArray(notices) || !notices.length) return null;
  const selectionNames = formatJoinedSelectionNames(notices.flatMap((notice) => notice.selectionNames || notice.title));
  if (!selectionNames.length) return VIEWER_SUPPORT_NOTICE;

  const visibleNames = selectionNames.slice(0, VIEWER_NOTICE_VISIBLE_SELECTION_LIMIT);
  const remainingCount = selectionNames.length - visibleNames.length;
  const suffix = remainingCount > 0 ? `, +${remainingCount} more` : '';
  return {
    title: VIEWER_SUPPORT_NOTICE.title,
    copy: `Not fully shown: ${visibleNames.join(', ')}${suffix}.`
  };
}

function getLegPreviewNotice(manifest = {}, modelId) {
  const selectionContext = getCurrentViewerSelectionContext(modelId);
  const legId = selectionContext.legId;
  if (!legId) return null;
  const legTitle = getOptionDisplayName('legs', legId, 'Leg preview');
  const tubeTitle = selectionContext.tubeId
    ? getOptionDisplayName('tube-size', selectionContext.tubeId, selectionContext.tubeId)
    : '';
  const legAndTubeTitle = tubeTitle ? `${legTitle} + ${tubeTitle}` : legTitle;

  if (selectionContext.waterfallCount >= 2) {
    return {
      title: 'Waterfall leg layout',
      reason: 'Two waterfalls replace the leg assembly, and waterfall geometry is not modeled in the local viewer yet.',
      selectionNames: ['Waterfall leg layout']
    };
  }

  if (legId === LEG_NONE_ID) {
    return {
      title: 'No legs',
      reason: 'Leg preview is hidden because this configuration is set to use no legs.',
      selectionNames: [legTitle]
    };
  }

  if (legId === LEG_CUSTOM_ID) {
    return {
      title: 'Custom leg',
      reason: 'Custom leg bases are quoted separately and do not have a dedicated 3D asset yet.',
      selectionNames: [formatCustomSelectionName(legTitle, 'Custom leg')]
    };
  }

  if (legId === LEG_SIGNATURE_ID) {
    return {
      title: 'Signature base',
      reason: 'The signature base does not have a dedicated local 3D asset yet.',
      selectionNames: [legTitle]
    };
  }

  const defaults = manifest && manifest.defaults && typeof manifest.defaults === 'object'
    ? manifest.defaults
    : {};
  const legCatalog = defaults.legAssets && typeof defaults.legAssets === 'object'
    ? defaults.legAssets
    : {};
  const definition = legCatalog[legId];
  if (!definition || typeof definition !== 'object') {
    return {
      title: 'Leg preview',
      reason: 'The selected leg style does not have a local 3D asset yet.',
      selectionNames: [legTitle]
    };
  }

  const variant = resolveLegVariant(definition, selectionContext);
  if (variant) return null;

  return {
    title: 'Leg preview',
    reason: 'The selected leg and tube combination does not have a local 3D asset yet.',
    selectionNames: [legAndTubeTitle]
  };
}

function collectViewerSelectionNotices(manifest = {}, modelId) {
  const selections = getSelections();
  const options = selections && selections.options && typeof selections.options === 'object'
    ? selections.options
    : {};
  const notices = [];
  const designId = selections && typeof selections.design === 'string' ? selections.design : null;
  const designNotice = designId ? DESIGN_VIEWER_NOTICES[designId] : null;
  if (designNotice) {
    const designTitle = getOptionDisplayName('design', designId, designNotice.title);
    pushViewerNotice(notices, designNotice.title, designNotice.reason, formatSelectionWithDescriptor(designTitle, 'design'));
  }

  if (options.material === MATERIAL_CUSTOM_ID) {
    const materialTitle = getOptionDisplayName('material', options.material, 'Custom wood');
    pushViewerNotice(
      notices,
      'Custom wood',
      'Custom wood species are quoted to spec, so the viewer keeps the standard slab material.',
      formatCustomSelectionName(materialTitle, 'Custom wood')
    );
  } else if (options.material === MATERIAL_COOKIE_EXCLUSIVE_ID) {
    const materialTitle = getOptionDisplayName('material', options.material, 'Cookie exclusive wood');
    pushViewerNotice(
      notices,
      'Cookie exclusive wood',
      'This quoted wood option does not have a dedicated viewer texture yet.',
      materialTitle
    );
  }

  if (options.color === COLOR_CUSTOM_ID) {
    const colorTitle = getOptionDisplayName('color', options.color, 'Custom epoxy color');
    pushViewerNotice(
      notices,
      'Custom epoxy color',
      'Custom epoxy colors are mixed to spec, so the viewer keeps the standard resin preview.',
      formatCustomSelectionName(colorTitle, 'Custom epoxy color')
    );
  }

  const selectedGradientId = options['color-gradient'] || null;
  if (selectedGradientId === COLOR_GRADIENT_CUSTOM_ID) {
    const gradientTitle = getOptionDisplayName('color-gradient', selectedGradientId, 'Custom epoxy gradient');
    pushViewerNotice(
      notices,
      'Custom epoxy gradient',
      'Custom gradient transitions are quoted to spec and are not rendered in the viewer.',
      formatCustomSelectionName(gradientTitle, 'Custom epoxy gradient')
    );
  } else if (
    selectedGradientId === COLOR_GRADIENT_SINGLE_COLOR_ID
    && !VIEWER_SINGLE_COLOR_RENDERED_COLOR_IDS.has(options.color)
  ) {
    const gradientTitle = getOptionDisplayName('color-gradient', selectedGradientId, 'Single color epoxy');
    pushViewerNotice(
      notices,
      'Single color epoxy',
      'Single-color epoxy is not rendered for multi-color epoxy palettes in the local 3D viewer yet.',
      formatSelectionWithDescriptor(gradientTitle, 'epoxy')
    );
  } else if (
    selectedGradientId
    && selectedGradientId !== COLOR_GRADIENT_SINGLE_COLOR_ID
    && selectedGradientId !== COLOR_GRADIENT_LIGHT_CENTER_ID
    && selectedGradientId !== COLOR_GRADIENT_DARK_TO_LIGHT_ID
  ) {
    const gradientTitle = getOptionDisplayName('color-gradient', selectedGradientId, 'Epoxy gradient');
    pushViewerNotice(
      notices,
      'Epoxy gradient',
      'Gradient transitions are not rendered in the local 3D viewer yet.',
      formatSelectionWithDescriptor(gradientTitle, 'gradient')
    );
  }

  if (options['leg-finish'] === LEG_FINISH_CUSTOM_ID) {
    const legFinishTitle = getOptionDisplayName('leg-finish', options['leg-finish'], 'Custom leg finish');
    pushViewerNotice(
      notices,
      'Custom leg finish',
      'The viewer uses a neutral stand-in because custom metal finishes are finalized after quoting.',
      formatCustomSelectionName(legFinishTitle, 'Custom leg finish')
    );
  }

  const legNotice = getLegPreviewNotice(manifest, modelId);
  if (legNotice) pushViewerNotice(notices, legNotice.title, legNotice.reason, legNotice.selectionNames);

  const selectedAddons = Array.isArray(options.addon) ? options.addon : [];
  if (selectedAddons.some((addonId) => WATERFALL_VIEWER_ADDON_IDS.has(addonId)) && getWaterfallEdgeCount(state) < 2) {
    const waterfallNames = selectedAddons
      .filter((addonId) => WATERFALL_VIEWER_ADDON_IDS.has(addonId))
      .map((addonId) => getOptionDisplayName('addon', addonId, 'Waterfall edge'));
    pushViewerNotice(
      notices,
      'Waterfall edge',
      'Waterfall geometry is not fully modeled in the viewer yet; the preview only adjusts the leg arrangement.',
      waterfallNames
    );
  }
  if (selectedAddons.some((addonId) => EDGE_PROFILE_VIEWER_ADDON_IDS.has(addonId))) {
    const edgeProfileNames = selectedAddons
      .filter((addonId) => EDGE_PROFILE_VIEWER_ADDON_IDS.has(addonId))
      .map((addonId) => getOptionDisplayName('addon', addonId, 'Edge profile'));
    pushViewerNotice(
      notices,
      'Edge profile',
      'Edge profile changes are not modeled in the local viewer yet.',
      edgeProfileNames
    );
  }
  if (
    selectedAddons.includes(LOWER_SHELF_ADDON_ID)
    && !isLowerShelfCompatibleContext({ modelId, legId: options.legs || null })
  ) {
    pushViewerNotice(
      notices,
      'Lower shelf',
      'Lower shelf geometry is only shown for compatible coffee table bases.',
      getOptionDisplayName('addon', LOWER_SHELF_ADDON_ID, 'Lower shelf')
    );
  }
  if (selectedAddons.includes('addon-embedded-logo')) {
    pushViewerNotice(
      notices,
      'Embedded logo',
      'Embedded logo placement is laid out to spec and is not shown in the standard viewer.',
      getOptionDisplayName('addon', 'addon-embedded-logo', 'Embedded logo')
    );
  }
  if (selectedAddons.includes('addon-custom-river')) {
    pushViewerNotice(
      notices,
      'Custom river design',
      'Custom river layouts are quoted to spec and do not have a standard 3D preview.',
      getOptionDisplayName('addon', 'addon-custom-river', 'Custom river design')
    );
  }
  if (selectedAddons.some((addonId) => TECH_VIEWER_ADDON_IDS.has(addonId))) {
    const techAddonNames = selectedAddons
      .filter((addonId) => TECH_VIEWER_ADDON_IDS.has(addonId))
      .map((addonId) => getOptionDisplayName('addon', addonId, 'Tech add-on'));
    pushViewerNotice(
      notices,
      'Tech add-ons',
      'Power, data, and lighting hardware is installed to spec and is not shown in the 3D viewer.',
      techAddonNames
    );
  }

  return notices;
}

function applyViewerSupportNotice(manifest = {}, modelId) {
  if (!dom.surface || dom.surface.dataset.viewerState !== 'ready') return;
  const notice = summarizeViewerNotices(collectViewerSelectionNotices(manifest, modelId));
  if (!notice) {
    hideStatusBox();
    return;
  }

  showStatusBox({
    title: notice.title,
    copy: notice.copy,
    loading: false
  });
  setLiveStatus(`${getModelTitle(modelId)} 3D preview loaded. ${notice.copy}`);
}

async function syncViewerSupportNotice(modelId) {
  if (!initialized || !modelId) {
    hideStatusBox();
    return;
  }

  if (!dom.surface || dom.surface.dataset.viewerState !== 'ready') return;

  const manifest = await loadManifest();
  const selectedModelId = state && state.selections ? state.selections.model : null;
  if (!manifest || selectedModelId !== modelId || !currentRenderRoot) return;
  applyViewerSupportNotice(manifest, modelId);
}

function applyViewerTheme() {
  if (!scene || !floorMesh) return;
  const resolvedTheme = document.body?.getAttribute('data-resolved-theme')
    || document.documentElement.getAttribute('data-resolved-theme')
    || 'light';
  const isDark = resolvedTheme === 'dark';

  scene.background = new THREE.Color(isDark ? 0x0f172a : 0xf3f7fb);
  floorMesh.material.color.setHex(isDark ? 0x1b2538 : 0xe7eef6);
}

function configureModelMeshes(root, config = {}) {
  const receiveModelShadows = config && config.receiveModelShadows === true;
  root.traverse((child) => {
    if (!child.isMesh) return;

    if (child.geometry && !child.geometry.getAttribute('normal') && typeof child.geometry.computeVertexNormals === 'function') {
      child.geometry.computeVertexNormals();
    }

    child.castShadow = true;
    child.receiveShadow = receiveModelShadows;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      if ('shadowSide' in material) material.shadowSide = THREE.FrontSide;
      material.needsUpdate = true;
    });
  });
}

function replaceCurrentRenderRoot(nextRoot) {
  if (currentRenderRoot && currentRenderRoot.parent) {
    currentRenderRoot.parent.remove(currentRenderRoot);
    disposeObject3D(currentRenderRoot);
  }
  currentRenderRoot = nextRoot;
  if (scene && currentRenderRoot) scene.add(currentRenderRoot);
  setActiveResinPreviewMaterialsFromRoot(currentRenderRoot);
}

function clearCurrentRenderRoot() {
  if (currentRenderRoot && currentRenderRoot.parent) {
    currentRenderRoot.parent.remove(currentRenderRoot);
    disposeObject3D(currentRenderRoot);
  }
  activeResinPreviewMaterials = [];
  currentRenderRoot = null;
  displayedModelId = null;
  displayedRenderSignature = null;
  syncTabletopGlareLight(null);
}

function getFramingBounds(root) {
  if (!root) return null;

  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  let hasVisibleBounds = false;

  root.children.forEach((child) => {
    if (!child || child.visible === false || child.name === GLASS_TOP_PART_NAME) return;

    const childBounds = new THREE.Box3().setFromObject(child);
    if (childBounds.isEmpty()) return;

    if (!hasVisibleBounds) {
      bounds.copy(childBounds);
      hasVisibleBounds = true;
      return;
    }

    bounds.union(childBounds);
  });

  return hasVisibleBounds ? bounds : null;
}

function getModelFramingMetrics(root) {
  if (!root) return null;
  const bounds = getFramingBounds(root);

  if (!bounds || bounds.isEmpty()) throw new Error('Loaded model has no visible bounds.');

  const size = bounds.getSize(new THREE.Vector3());
  const target = bounds.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  return { bounds, size, target, maxDim };
}

function applyFramingMetrics(metrics, config = {}, { preserveView = false, previousTarget = null } = {}) {
  if (!metrics || !camera || !controls) return null;
  const { size, target, maxDim } = metrics;
  const cameraSettings = getCameraSettings(config);
  camera.near = Math.max(0.1, maxDim / 100);
  camera.far = Math.max(120, maxDim * 20);
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(0.5, maxDim * cameraSettings.minDistanceMultiplier);
  controls.maxDistance = Math.max(controls.minDistance + 1, maxDim * cameraSettings.maxDistanceMultiplier);

  if (preserveView) {
    const anchorTarget = previousTarget instanceof THREE.Vector3
      ? previousTarget
      : controls.target.clone();
    const delta = target.clone().sub(anchorTarget);
    camera.position.add(delta);
    controls.target.add(delta);
    controls.update();
  } else {
    const offset = new THREE.Vector3(
      Number(cameraSettings.offset[0]) || FALLBACK_CAMERA_OFFSET[0],
      Number(cameraSettings.offset[1]) || FALLBACK_CAMERA_OFFSET[1],
      Number(cameraSettings.offset[2]) || FALLBACK_CAMERA_OFFSET[2]
    );
    const cameraPosition = target.clone().add(offset.multiplyScalar(maxDim));
    camera.position.copy(cameraPosition);
    controls.target.copy(target);
    controls.update();
    controls.saveState();
    defaultCameraPosition = camera.position.clone();
    defaultCameraTarget = controls.target.clone();
  }

  if (preserveView) {
    if (controls.minDistance > controls.maxDistance) {
      controls.maxDistance = controls.minDistance + 1;
    }
  }
  controls.update();

  if (floorMesh) {
    const floorScale = Math.max(maxDim * 3, 6);
    floorMesh.scale.setScalar(floorScale);
  }

  return {
    size: {
      x: Number(size.x.toFixed(3)),
      y: Number(size.y.toFixed(3)),
      z: Number(size.z.toFixed(3))
    },
    maxDim: Number(maxDim.toFixed(3)),
    target: {
      x: Number(target.x.toFixed(3)),
      y: Number(target.y.toFixed(3)),
      z: Number(target.z.toFixed(3))
    }
  };
}

function frameModel(root, config = {}, options = {}) {
  if (!root || !camera || !controls) return null;
  const metrics = getModelFramingMetrics(root);
  const framing = applyFramingMetrics(metrics, config, options);
  syncTabletopGlareLight(root);
  return framing;
}

async function loadManifest() {
  if (!manifestPromise) {
    log.info('Requesting viewer manifest', { path: VIEWER_MANIFEST_PATH });
    manifestPromise = loadData(VIEWER_MANIFEST_PATH);
  }
  const manifest = await manifestPromise;
  if (manifest && !hasLoggedManifestSummary) {
    hasLoggedManifestSummary = true;
    log.info('Viewer manifest loaded', {
      path: VIEWER_MANIFEST_PATH,
      modelIds: Object.keys(manifest.models || {})
    });
  } else if (!manifest) {
    log.warn('Viewer manifest failed to load', { path: VIEWER_MANIFEST_PATH });
  }
  return manifest && typeof manifest === 'object' ? manifest : null;
}

function resolveViewerConfig(manifest, modelId) {
  if (!manifest || !modelId) return null;
  const defaults = manifest.defaults && typeof manifest.defaults === 'object' ? manifest.defaults : {};
  const modelEntry = manifest.models && typeof manifest.models === 'object' ? manifest.models[modelId] : null;
  if (!modelEntry || typeof modelEntry !== 'object') return null;
  const defaultDimensionRules = defaults.dimensionRules && typeof defaults.dimensionRules === 'object'
    ? defaults.dimensionRules
    : {};
  const modelDimensionRules = modelEntry.dimensionRules && typeof modelEntry.dimensionRules === 'object'
    ? modelEntry.dimensionRules
    : null;

  return {
    ...defaults,
    ...modelEntry,
    parts: [
      ...getRenderableParts({ parts: defaults.parts || [] }),
      ...getConfiguredLegParts(manifest, modelId)
    ],
    camera: {
      ...(defaults.camera && typeof defaults.camera === 'object' ? defaults.camera : {}),
      ...(modelEntry.camera && typeof modelEntry.camera === 'object' ? modelEntry.camera : {})
    },
    dimensionRules: {
      ...defaultDimensionRules,
      ...(modelDimensionRules || {}),
      baseDimensions: {
        ...(defaultDimensionRules.baseDimensions && typeof defaultDimensionRules.baseDimensions === 'object'
          ? defaultDimensionRules.baseDimensions
          : {}),
        ...(modelDimensionRules && modelDimensionRules.baseDimensions && typeof modelDimensionRules.baseDimensions === 'object'
          ? modelDimensionRules.baseDimensions
          : {})
      },
      heightOptions: {
        ...(defaultDimensionRules.heightOptions && typeof defaultDimensionRules.heightOptions === 'object'
          ? defaultDimensionRules.heightOptions
          : {}),
        ...(modelDimensionRules && modelDimensionRules.heightOptions && typeof modelDimensionRules.heightOptions === 'object'
          ? modelDimensionRules.heightOptions
          : {})
      },
      partBehaviors: {
        ...(defaultDimensionRules.partBehaviors && typeof defaultDimensionRules.partBehaviors === 'object'
          ? defaultDimensionRules.partBehaviors
          : {}),
        ...(modelDimensionRules && modelDimensionRules.partBehaviors && typeof modelDimensionRules.partBehaviors === 'object'
          ? modelDimensionRules.partBehaviors
          : {})
      }
    }
  };
}

async function buildRenderAsset(partConfig, index = 0) {
  if (!loader) loader = new GLTFLoader();
  const assetPath = partConfig && typeof partConfig.assetPath === 'string' ? partConfig.assetPath : '';
  if (!assetPath) throw new Error('No asset path configured for viewer model.');

  const gltf = await loader.loadAsync(assetPath);
  const sourceRoot = gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null);
  if (!sourceRoot) throw new Error('GLB did not contain a scene.');

  const assetRoot = new THREE.Group();
  assetRoot.name = partConfig.name || `viewer-part-${index + 1}`;
  assetRoot.userData.partConfig = {
    role: partConfig.role || '',
    placement: partConfig.placement || '',
    layout: partConfig.layout || '',
    legId: partConfig.legId || '',
    tubeFallbackScale: Number.isFinite(Number(partConfig.tubeFallbackScale))
      ? Number(partConfig.tubeFallbackScale)
      : 1
  };
  assetRoot.add(sourceRoot);
  assetRoot.scale.copy(getScaleVector(partConfig.scale));
  applySurfaceInsetTransform(assetRoot, partConfig);
  assetRoot.rotation.set(
    Number(partConfig.rotation[0]) || 0,
    Number(partConfig.rotation[1]) || 0,
    Number(partConfig.rotation[2]) || 0
  );

  await applyConfiguredMaterialSource(assetRoot, partConfig);
  configureModelMeshes(assetRoot, partConfig);

  const initialBounds = new THREE.Box3().setFromObject(assetRoot);
  if (initialBounds.isEmpty()) throw new Error('Loaded model has no mesh bounds.');

  const center = initialBounds.getCenter(new THREE.Vector3());
  assetRoot.position.set(-center.x, -initialBounds.min.y, -center.z);
  assetRoot.position.x += Number(partConfig.positionOffset[0]) || 0;
  assetRoot.position.y += Number(partConfig.positionOffset[1]) || 0;
  assetRoot.position.z += Number(partConfig.positionOffset[2]) || 0;
  assetRoot.position.x += Number(partConfig.surfaceInsetOffset[0]) || 0;
  assetRoot.position.y += Number(partConfig.surfaceInsetOffset[1]) || 0;
  assetRoot.position.z += Number(partConfig.surfaceInsetOffset[2]) || 0;

  return assetRoot;
}

async function buildRenderRoot(config) {
  const renderableParts = getRenderableParts(config);
  if (!renderableParts.length) throw new Error('No asset path configured for viewer model.');

  const renderRoot = new THREE.Group();
  renderRoot.name = `viewer-model-${requestedModelId || 'selection'}`;

  const parts = await Promise.all(renderableParts.map((partConfig, index) => buildRenderAsset(partConfig, index)));
  parts.forEach((partRoot) => renderRoot.add(partRoot));
  renderRoot.add(createGlassTopPart());
  renderRoot.add(createLowerShelfPart());
  await applySelectedTabletopMaterial(renderRoot);
  await applySelectedTabletopSheen(renderRoot);
  await applySelectedTabletopTint(renderRoot);
  await applySelectedLowerShelfMaterial(renderRoot);
  await applySelectedResinPreview(renderRoot);
  await applySelectedLegFinish(renderRoot);
  captureRenderRootBaseState(renderRoot);
  applyConfiguredPartTransforms(renderRoot, config);

  return renderRoot;
}

async function refreshCurrentRenderState(modelId) {
  if (!initialized || !currentRenderRoot || !modelId) return;

  const manifest = await loadManifest();
  if (!manifest) return;

  const config = resolveViewerConfig(manifest, modelId);
  if (!config) return;

  const previousMetrics = getModelFramingMetrics(currentRenderRoot);
  const previousTarget = previousMetrics ? previousMetrics.target.clone() : controls.target.clone();
  const scaleMap = applyConfiguredPartTransforms(currentRenderRoot, config);
  const framing = frameModel(currentRenderRoot, config, { preserveView: true, previousTarget });
  log.info('Applied viewer state transforms', {
    modelId,
    scales: scaleMap
      ? {
        length: Number(scaleMap.length.toFixed(3)),
        width: Number(scaleMap.width.toFixed(3)),
        height: Number(scaleMap.height.toFixed(3))
      }
      : null,
    selection: scaleMap ? scaleMap.selectedDimensions : null,
    framing
  });
  showReadyState(modelId, config, manifest);
}

function showEmptyState() {
  pendingRequestToken += 1;
  isLoading = false;
  requestedModelId = null;
  clearCurrentRenderRoot();
  log.info('Showing viewer empty state');
  setViewerState('empty');
  hideStatusBox();
  setLiveStatus('3D preview ready. Choose a model to begin.');
}

function showErrorState(title, errorCopy = ERROR_COPY) {
  isLoading = false;
  log.warn('Showing viewer error state', { title, errorCopy });
  setViewerState('error', { errorCopy });
  hideStatusBox();
  setLiveStatus(`3D preview unavailable for ${title}.`);
}

function showReadyState(modelId, config = {}, manifest = null) {
  const title = getModelTitle(modelId, config);
  log.info('Showing viewer ready state', { modelId, title });
  setViewerState('ready');
  setLiveStatus(`${title} 3D preview loaded.`);
  applyViewerSupportNotice(manifest || {}, modelId);
}

export async function updateModel(modelId, { force = false } = {}) {
  if (!initialized) return;

  if (!modelId) {
    showEmptyState();
    return;
  }

  if (!force && isLoading && requestedModelId === modelId) return;

  log.info('Viewer update requested', { modelId, force });
  const manifest = await loadManifest();
  if (!manifest) {
    showErrorState(getModelTitle(modelId), ERROR_COPY);
    return;
  }

  const config = resolveViewerConfig(manifest, modelId);
  const renderableParts = getRenderableParts(config || {});
  if (!config || !renderableParts.length) {
    showErrorState(getModelTitle(modelId), MISSING_CONFIGURATION_MODEL_COPY);
    return;
  }
  const renderSignature = getRenderSignature(config);

  const title = getModelTitle(modelId, config);
  requestedModelId = modelId;
  log.info('Viewer config resolved', {
    modelId,
    title,
    assetPaths: getRenderAssetPaths(config),
    renderSignature,
    camera: getCameraSettings(config)
  });

  if (!force && currentRenderRoot && displayedModelId === modelId && displayedRenderSignature === renderSignature) {
    const previousMetrics = getModelFramingMetrics(currentRenderRoot);
    const previousTarget = previousMetrics ? previousMetrics.target.clone() : controls.target.clone();
    applyConfiguredPartTransforms(currentRenderRoot, config);
    const framing = frameModel(currentRenderRoot, config, { preserveView: true, previousTarget });
    log.info('Reused existing viewer asset for same model', { modelId, framing });
    showReadyState(modelId, config, manifest);
    return;
  }

  if (!force && currentRenderRoot && displayedRenderSignature === renderSignature) {
    displayedModelId = modelId;
    const previousMetrics = getModelFramingMetrics(currentRenderRoot);
    const previousTarget = previousMetrics ? previousMetrics.target.clone() : controls.target.clone();
    applyConfiguredPartTransforms(currentRenderRoot, config);
    const framing = frameModel(currentRenderRoot, config, { preserveView: true, previousTarget });
    log.info('Reused existing viewer asset across model mapping', { modelId, framing });
    showReadyState(modelId, config, manifest);
    return;
  }

  const requestToken = ++pendingRequestToken;
  isLoading = true;
  setViewerState('loading');
  showStatusBox({
    title: VIEWER_LOADING_STATUS.title,
    copy: VIEWER_LOADING_STATUS.copy,
    loading: true
  });
  setLiveStatus(`Loading ${title} 3D preview.`);

  try {
    // Keep the user's camera when the preview is rebuilt for same-model option changes.
    const preserveView = !!currentRenderRoot && displayedModelId === modelId && !!controls;
    const previousMetrics = preserveView ? getModelFramingMetrics(currentRenderRoot) : null;
    const previousTarget = previousMetrics ? previousMetrics.target.clone() : null;
    log.info('Starting GLB load', { modelId, assetPaths: getRenderAssetPaths(config) });
    const nextRoot = await buildRenderRoot(config);
    if (requestToken !== pendingRequestToken) {
      disposeObject3D(nextRoot);
      return;
    }

    replaceCurrentRenderRoot(nextRoot);
    displayedModelId = modelId;
    displayedRenderSignature = renderSignature;
    const framing = frameModel(nextRoot, config, preserveView ? { preserveView: true, previousTarget } : {});
    log.info('GLB load succeeded', {
      modelId,
      assetPaths: getRenderAssetPaths(config),
      framing
    });
    showReadyState(modelId, config, manifest);
  } catch (error) {
    log.warn('Failed to load 3D preview', { modelId, error });
    if (requestToken !== pendingRequestToken) return;
    showErrorState(title, ERROR_COPY);
  } finally {
    if (requestToken === pendingRequestToken) isLoading = false;
  }
}

function orbitCamera(direction = 1) {
  if (!camera || !controls || !currentRenderRoot) return;
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta += (Math.PI / 8) * direction;
  const nextOffset = new THREE.Vector3().setFromSpherical(spherical);
  camera.position.copy(controls.target.clone().add(nextOffset));
  controls.update();
  syncTabletopGlareLight();
}

function zoomCamera(direction = 1) {
  if (!camera || !controls || !currentRenderRoot) return;
  const offset = camera.position.clone().sub(controls.target);
  const currentDistance = offset.length();
  const zoomScale = direction > 0 ? 0.84 : 1.18;
  const nextDistance = THREE.MathUtils.clamp(
    currentDistance * zoomScale,
    controls.minDistance || 0.5,
    controls.maxDistance || currentDistance
  );
  offset.setLength(nextDistance);
  camera.position.copy(controls.target.clone().add(offset));
  controls.update();
  syncTabletopGlareLight();
}

export function resetView() {
  if (!camera || !controls || !currentRenderRoot) return;
  camera.position.copy(defaultCameraPosition);
  controls.target.copy(defaultCameraTarget);
  controls.reset();
  controls.update();
  syncTabletopGlareLight();
}

export function resizeViewer() {
  if (!renderer || !camera || !dom.canvas) return;
  const width = dom.canvas.clientWidth;
  const height = dom.canvas.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

export function initViewerControls() {
  const actions = {
    'viewer-orbit-left': () => orbitCamera(-1),
    'viewer-orbit-right': () => orbitCamera(1),
    'viewer-zoom-in': () => zoomCamera(1),
    'viewer-zoom-out': () => zoomCamera(-1),
    'reset-view': () => resetView()
  };

  Object.entries(actions).forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (!button || button.dataset.viewerBound === 'true') return;
    button.addEventListener('click', handler);
    button.dataset.viewerBound = 'true';
  });

  const retryButton = document.getElementById('viewer-retry');
  if (retryButton && retryButton.dataset.viewerBound !== 'true') {
    retryButton.addEventListener('click', () => {
      const modelId = (state && state.selections && state.selections.model) || requestedModelId;
      if (!modelId) return;
      void updateModel(modelId, { force: true });
    });
    retryButton.dataset.viewerBound = 'true';
  }
}

export async function initViewer() {
  dom.surface = document.getElementById('viewer');
  dom.canvas = document.getElementById('viewer-canvas');
  dom.statusBox = document.getElementById('viewer-status-box');
  dom.statusTitle = document.getElementById('viewer-status-box-title');
  dom.statusCopy = document.getElementById('viewer-status-box-copy');
  dom.statusSpinner = document.getElementById('viewer-status-spinner');
  dom.empty = document.getElementById('viewer-empty-state');
  dom.error = document.getElementById('viewer-error-state');
  dom.errorCopy = document.getElementById('viewer-error-copy');
  dom.liveRegion = document.getElementById('viewer-status');
  dom.retryButton = document.getElementById('viewer-retry');

  if (!dom.surface || !dom.canvas) {
    log.warn('Viewer shell not found. Viewer initialization deferred.');
    return;
  }

  log.info('Initializing viewer shell', {
    hasSurface: !!dom.surface,
    hasCanvas: !!dom.canvas,
    hasEmptyState: !!dom.empty,
    hasControls: !!document.getElementById('viewer-controls')
  });

  if (initialized) {
    log.info('Viewer already initialized, refreshing size and state');
    resizeViewer();
    initViewerControls();
    await updateModel(state && state.selections ? state.selections.model : null);
    return;
  }

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.copy(defaultCameraPosition);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'viewer-webgl';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  dom.canvas.appendChild(renderer.domElement);
  log.info('Viewer renderer mounted', {
    canvasWidth: dom.canvas.clientWidth,
    canvasHeight: dom.canvas.clientHeight
  });

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  // Keep the PMREM blur below Three's sample cap so the environment map does not log clipping warnings.
  scene.environment = pmremGenerator.fromScene(roomEnvironment, ROOM_ENVIRONMENT_BLUR).texture;
  roomEnvironment.dispose();
  pmremGenerator.dispose();

  const ambientLight = new THREE.HemisphereLight(0xffffff, 0xcfd8e3, 1.15);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
  keyLight.position.set(24, 34, 18);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -80;
  keyLight.shadow.camera.right = 80;
  keyLight.shadow.camera.top = 80;
  keyLight.shadow.camera.bottom = -80;
  keyLight.shadow.bias = -0.00005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xdfe9f7, 0.8);
  fillLight.position.set(-22, 14, 18);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
  rimLight.position.set(-12, 20, -18);
  scene.add(rimLight);

  tabletopGlareLight = new THREE.DirectionalLight(TABLETOP_GLARE_LIGHT_COLOR, TABLETOP_GLARE_LIGHT_INTENSITY.default);
  tabletopGlareLight.name = 'tabletop-glare-light';
  tabletopGlareLight.visible = false;
  scene.add(tabletopGlareLight);
  scene.add(tabletopGlareLight.target);

  floorMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 80),
    new THREE.MeshStandardMaterial({
      color: 0xe7eef6,
      roughness: 0.98,
      metalness: 0.02
    })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.01;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.target.copy(defaultCameraTarget);
  controls.addEventListener('change', () => syncTabletopGlareLight());
  controls.update();

  applyViewerTheme();
  renderer.setAnimationLoop(() => {
    if (!renderer || !scene || !camera) return;
    if (controls) controls.update();
    updateResinPreviewMaterialsForView();
    renderer.render(scene, camera);
  });

  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => resizeViewer());
    resizeObserver.observe(dom.canvas);
  }

  if (typeof MutationObserver === 'function' && document.body) {
    themeObserver = new MutationObserver(() => applyViewerTheme());
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-resolved-theme'] });
  }

  initialized = true;
  initViewerControls();
  resizeViewer();
  showEmptyState();
  await updateModel(state && state.selections ? state.selections.model : null);
}

window.addEventListener('resize', () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => resizeViewer(), 120);
});

document.addEventListener('statechange', () => {
  if (!initialized) return;
  const nextModelId = state && state.selections ? state.selections.model : null;
  const nextDesignId = state && state.selections ? state.selections.design || null : null;
  const nextMaterialId = state && state.selections && state.selections.options
    ? state.selections.options.material || null
    : null;
  const nextFinishSheenId = state && state.selections && state.selections.options
    ? state.selections.options['finish-sheen'] || null
    : null;
  const nextFinishTintId = state && state.selections && state.selections.options
    ? state.selections.options['finish-tint'] || null
    : null;
  const nextColorId = state && state.selections && state.selections.options
    ? state.selections.options.color || null
    : null;
  const nextColorGradientId = state && state.selections && state.selections.options
    ? state.selections.options['color-gradient'] || null
    : null;
  const nextLegId = state && state.selections && state.selections.options
    ? state.selections.options.legs || null
    : null;
  const nextTubeId = state && state.selections && state.selections.options
    ? state.selections.options['tube-size'] || null
    : null;
  const nextLegFinishId = state && state.selections && state.selections.options
    ? state.selections.options['leg-finish'] || null
    : null;
  const nextAddonsSignature = JSON.stringify(
    state && state.selections && state.selections.options
      ? (state.selections.options.addon || null)
      : null
  );
  const nextDimensionsSignature = JSON.stringify(
    state && state.selections ? (state.selections.dimensionsDetail || null) : null
  );
  const modelChanged = nextModelId !== lastObservedModelId;
  const designChanged = nextDesignId !== lastObservedDesignId;
  const materialChanged = nextMaterialId !== lastObservedMaterialId;
  const finishSheenChanged = nextFinishSheenId !== lastObservedFinishSheenId;
  const finishTintChanged = nextFinishTintId !== lastObservedFinishTintId;
  const colorChanged = nextColorId !== lastObservedColorId;
  const colorGradientChanged = nextColorGradientId !== lastObservedColorGradientId;
  const legChanged = nextLegId !== lastObservedLegId;
  const tubeChanged = nextTubeId !== lastObservedTubeId;
  const legFinishChanged = nextLegFinishId !== lastObservedLegFinishId;
  const addonsChanged = nextAddonsSignature !== lastObservedAddonsSignature;
  const dimensionsChanged = nextDimensionsSignature !== lastObservedDimensionsSignature;

  if (nextModelId !== lastObservedModelId) {
    log.info('Viewer observed model selection change', {
      previousModelId: lastObservedModelId,
      nextModelId
    });
  }
  if (designChanged) {
    log.info('Viewer observed design selection change', {
      previousDesignId: lastObservedDesignId,
      nextDesignId
    });
  }
  if (materialChanged) {
    log.info('Viewer observed material selection change', {
      previousMaterialId: lastObservedMaterialId,
      nextMaterialId
    });
  }
  if (finishSheenChanged) {
    log.info('Viewer observed finish sheen selection change', {
      previousFinishSheenId: lastObservedFinishSheenId,
      nextFinishSheenId
    });
  }
  if (finishTintChanged) {
    log.info('Viewer observed finish tint selection change', {
      previousFinishTintId: lastObservedFinishTintId,
      nextFinishTintId
    });
  }
  if (colorChanged) {
    log.info('Viewer observed resin color selection change', {
      previousColorId: lastObservedColorId,
      nextColorId
    });
  }
  if (colorGradientChanged) {
    log.info('Viewer observed resin gradient selection change', {
      previousColorGradientId: lastObservedColorGradientId,
      nextColorGradientId
    });
  }
  if (legChanged) {
    log.info('Viewer observed leg selection change', {
      previousLegId: lastObservedLegId,
      nextLegId
    });
  }
  if (tubeChanged) {
    log.info('Viewer observed tube selection change', {
      previousTubeId: lastObservedTubeId,
      nextTubeId
    });
  }
  if (legFinishChanged) {
    log.info('Viewer observed leg finish selection change', {
      previousLegFinishId: lastObservedLegFinishId,
      nextLegFinishId
    });
  }
  if (addonsChanged) {
    log.info('Viewer observed addon selection change', {
      previousAddonsSignature: lastObservedAddonsSignature,
      nextAddonsSignature
    });
  }
  if (dimensionsChanged) {
    log.info('Viewer observed dimensions change', {
      previousDimensionsSignature: lastObservedDimensionsSignature,
      nextDimensionsSignature
    });
  }

  lastObservedModelId = nextModelId;
  lastObservedDesignId = nextDesignId;
  lastObservedMaterialId = nextMaterialId;
  lastObservedFinishSheenId = nextFinishSheenId;
  lastObservedFinishTintId = nextFinishTintId;
  lastObservedColorId = nextColorId;
  lastObservedColorGradientId = nextColorGradientId;
  lastObservedLegId = nextLegId;
  lastObservedTubeId = nextTubeId;
  lastObservedLegFinishId = nextLegFinishId;
  lastObservedAddonsSignature = nextAddonsSignature;
  lastObservedDimensionsSignature = nextDimensionsSignature;

  if (modelChanged) {
    void updateModel(nextModelId);
    return;
  }

  if ((materialChanged || finishSheenChanged || finishTintChanged || colorChanged || colorGradientChanged || legFinishChanged) && nextModelId) {
    void updateModel(nextModelId, { force: true });
    return;
  }

  if ((legChanged || tubeChanged || addonsChanged) && nextModelId) {
    void updateModel(nextModelId);
    return;
  }

  if ((designChanged || dimensionsChanged) && nextModelId) {
    void updateModel(nextModelId);
    return;
  }

});
