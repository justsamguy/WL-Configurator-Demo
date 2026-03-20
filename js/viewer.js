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
import { getLegEndSetbackValue, getLegWidthForTable } from './legGeometry.js';

const log = createLogger('Viewer');

const VIEWER_MANIFEST_PATH = 'data/viewer-models.json';
const LEG_FINISH_DATA_PATH = 'data/leg-finish.json';
const COLOR_DATA_PATH = 'data/colors.json';
const FINISH_DATA_PATH = 'data/finish.json';
const FALLBACK_CAMERA_OFFSET = Object.freeze([1.65, 0.94, 1.95]);
const ERROR_COPY = 'The selected 3D preview could not be loaded. Try again.';
const SPALTED_MAPLE_MATERIAL_ID = 'mat-02';
const SPALTED_MAPLE_TEXTURE_PATH = 'assets/models/textures/Gemini_Generated_Image_otflgaotflgaotfl.png';
const EPOXY_PREVIEW_PART_NAME = 'tabletop-epoxy';
const AXIS_COMPONENTS = ['x', 'y', 'z'];
const LEG_NONE_ID = 'leg-none';
const LEG_CUSTOM_ID = 'leg-sample-07';
const LEG_SIGNATURE_ID = 'leg-signature';
const LEG_CUBE_ID = 'leg-sample-02';
const LEG_TRIPOD_ID = 'leg-sample-08';
const LEG_PAIR_COUNT_THRESHOLD = 130;
const TRIPOD_EDGE_SETBACK_IN = 13;
const CUBE_EDGE_SETBACK_IN = 0.25;
const DEFAULT_SURFACE_INSET_OFFSET = Object.freeze([0, 0, 0]);
const DEFAULT_RESIN_VIEWER_TINT = '#d2d7df';
const GLASS_TOP_ADDON_ID = 'addon-glass-top';
const GLASS_TOP_PART_NAME = 'tabletop-glass';
const GLASS_TOP_THICKNESS_IN = 0.25;
const GLASS_TOP_AXIS_REDUCTION_IN = 0.125;
const GLASS_TOP_SURFACE_GAP = 0.0007;
const GLASS_TOP_MATERIAL_THICKNESS = GLASS_TOP_THICKNESS_IN * 0.0254;
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

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let loader = null;
let floorMesh = null;
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
let tabletopTexturePromise = null;
let legFinishDataPromise = null;
let colorDataPromise = null;
let finishDataPromise = null;

const dom = {
  surface: null,
  canvas: null,
  empty: null,
  loading: null,
  error: null,
  errorCopy: null,
  liveRegion: null,
  retryButton: null
};

let lastObservedModelId = null;
let lastObservedDesignId = null;
let lastObservedMaterialId = null;
let lastObservedFinishSheenId = null;
let lastObservedColorId = null;
let lastObservedLegFinishId = null;
let lastObservedDimensionsSignature = '';
let lastObservedLegId = null;
let lastObservedTubeId = null;
let lastObservedAddonsSignature = '';

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
  const selectionContext = getCurrentViewerSelectionContext(modelId);
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
  const baseDimensions = rules.baseDimensions || {};
  const rawLengthScale = Number.isFinite(selectedDimensions.length) && Number.isFinite(Number(baseDimensions.length)) && Number(baseDimensions.length) > 0
    ? selectedDimensions.length / Number(baseDimensions.length)
    : 1;
  const rawWidthScale = Number.isFinite(selectedDimensions.width) && Number.isFinite(Number(baseDimensions.width)) && Number(baseDimensions.width) > 0
    ? selectedDimensions.width / Number(baseDimensions.width)
    : 1;
  const heightScale = Number.isFinite(selectedDimensions.height) && Number.isFinite(Number(baseDimensions.height)) && Number(baseDimensions.height) > 0
    ? selectedDimensions.height / Number(baseDimensions.height)
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
    spanX: getLegWidthForTable(width),
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
  const desiredLegHeight = Number.isFinite(selectedUndersideY) ? selectedUndersideY : baseSpanY;
  const scaleY = Number.isFinite(baseSpanY) && baseSpanY > 0 && Number.isFinite(desiredLegHeight)
    ? desiredLegHeight / baseSpanY
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

  const glassWidth = Number.isFinite(tabletopWidth) ? Math.max(tabletopWidth - shrinkAmount, thickness * 3) : null;
  const glassLength = Number.isFinite(tabletopLength) ? Math.max(tabletopLength - shrinkAmount, thickness * 3) : null;
  if (!Number.isFinite(glassWidth) || !Number.isFinite(glassLength) || !Number.isFinite(thickness)) {
    glassRoot.visible = false;
    return;
  }

  glassRoot.visible = true;
  glassRoot.scale.set(glassWidth, thickness, glassLength);
  glassRoot.position.set(
    tabletopMetrics.center.x,
    tabletopMetrics.max.y + (thickness / 2) + GLASS_TOP_SURFACE_GAP,
    tabletopMetrics.center.z
  );
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
  const baseHeight = rules && rules.baseDimensions ? Number(rules.baseDimensions.height) : NaN;
  const unitsPerInch = Number.isFinite(Number(rules.unitsPerInch)) ? Number(rules.unitsPerInch) : 0.0254;
  const heightDeltaUnits = Number.isFinite(selectedHeight) && Number.isFinite(baseHeight)
    ? (selectedHeight - baseHeight) * unitsPerInch
    : 0;
  const tabletopBaseState = basePartStates.tabletop && basePartStates.tabletop.metrics
    ? basePartStates.tabletop
    : null;
  const selectedUndersideY = tabletopBaseState
    ? tabletopBaseState.metrics.min.y + heightDeltaUnits
    : null;

  Object.entries(basePartStates).forEach(([partName, baseState]) => {
    const partRoot = renderRoot.getObjectByName(partName);
    if (!partRoot || !baseState) return;

    partRoot.position.copy(baseState.position);
    partRoot.scale.copy(baseState.scale);
    partRoot.visible = true;

    const partConfig = getPartConfig(partRoot);
    const role = partConfig.role || '';

    if (role === 'tabletop' || partName.startsWith('tabletop')) {
      computeTabletopTransform(partRoot, baseState, scaleMap, selectedUndersideY);
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

function resolvePartAssetPath(partConfig = {}) {
  const defaultAssetPath = typeof partConfig.assetPath === 'string' ? partConfig.assetPath.trim() : '';
  const addonAssetPaths = partConfig.addonAssetPaths && typeof partConfig.addonAssetPaths === 'object'
    ? partConfig.addonAssetPaths
    : null;
  if (!addonAssetPaths) return defaultAssetPath;

  const selectedAddons = getSelectedAddons();
  const selectedAddonOverride = selectedAddons.find((addonId) => (
    typeof addonId === 'string'
    && typeof addonAssetPaths[addonId] === 'string'
    && addonAssetPaths[addonId].trim()
  ));

  return selectedAddonOverride
    ? addonAssetPaths[selectedAddonOverride].trim()
    : defaultAssetPath;
}

function normalizeRenderablePart(partConfig = {}, index = 0) {
  const assetPath = resolvePartAssetPath(partConfig);
  return {
    name: typeof partConfig.name === 'string' && partConfig.name.trim()
      ? partConfig.name.trim()
      : `part-${index + 1}`,
    role: typeof partConfig.role === 'string' && partConfig.role.trim()
      ? partConfig.role.trim()
      : '',
    placement: typeof partConfig.placement === 'string' && partConfig.placement.trim()
      ? partConfig.placement.trim()
      : '',
    layout: typeof partConfig.layout === 'string' && partConfig.layout.trim()
      ? partConfig.layout.trim()
      : '',
    legId: typeof partConfig.legId === 'string' && partConfig.legId.trim()
      ? partConfig.legId.trim()
      : '',
    tubeFallbackScale: Number.isFinite(Number(partConfig.tubeFallbackScale))
      ? Number(partConfig.tubeFallbackScale)
      : 1,
    assetPath,
    scale: Array.isArray(partConfig.scale) && partConfig.scale.length === 3
      ? partConfig.scale.map((entry) => Number(entry) || 1)
      : (Number.isFinite(Number(partConfig.scale)) ? Number(partConfig.scale) || 1 : 1),
    surfaceInsetScale: Array.isArray(partConfig.surfaceInsetScale) && partConfig.surfaceInsetScale.length === 3
      ? partConfig.surfaceInsetScale.map((entry) => Number(entry) || 1)
      : null,
    surfaceInsetOffset: Array.isArray(partConfig.surfaceInsetOffset) && partConfig.surfaceInsetOffset.length === 3
      ? partConfig.surfaceInsetOffset.map((entry) => Number(entry) || 0)
      : DEFAULT_SURFACE_INSET_OFFSET,
    rotation: getVectorTriplet(partConfig.rotation),
    positionOffset: getVectorTriplet(partConfig.positionOffset),
    receiveModelShadows: partConfig.receiveModelShadows === true
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
  glassMesh.castShadow = false;
  glassMesh.receiveShadow = false;
  glassMesh.renderOrder = 12;
  glassRoot.add(glassMesh);
  glassRoot.visible = false;
  return glassRoot;
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

async function loadTabletopTexture() {
  if (!tabletopTexturePromise) {
    const textureLoader = new THREE.TextureLoader();
    tabletopTexturePromise = textureLoader.loadAsync(SPALTED_MAPLE_TEXTURE_PATH).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      if (renderer && renderer.capabilities) {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      return texture;
    }).catch((error) => {
      tabletopTexturePromise = null;
      throw error;
    });
  }

  return tabletopTexturePromise;
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
  previewMaterial.transparent = true;
  previewMaterial.opacity = sourceMaterial && Number.isFinite(Number(sourceMaterial.opacity))
    ? Number(sourceMaterial.opacity)
    : 0.98;
  if ('metalness' in previewMaterial) previewMaterial.metalness = 0.03;
  if ('roughness' in previewMaterial) previewMaterial.roughness = 0.16;
  if ('transmission' in previewMaterial) previewMaterial.transmission = 0.78;
  if ('thickness' in previewMaterial) previewMaterial.thickness = 1.1;
  if ('ior' in previewMaterial) previewMaterial.ior = 1.46;
  if ('envMapIntensity' in previewMaterial) previewMaterial.envMapIntensity = 1.08;
  if ('clearcoat' in previewMaterial) previewMaterial.clearcoat = 0.24;
  if ('clearcoatRoughness' in previewMaterial) previewMaterial.clearcoatRoughness = 0.18;
  if ('attenuationDistance' in previewMaterial) previewMaterial.attenuationDistance = 0.82;
  if ('attenuationColor' in previewMaterial) previewMaterial.attenuationColor = new THREE.Color(resinTint);
  previewMaterial.needsUpdate = true;
  return previewMaterial;
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

async function applySelectedTabletopMaterial(renderRoot) {
  if (!renderRoot) return;

  const selectedMaterialId = state && state.selections && state.selections.options
    ? state.selections.options.material
    : null;
  if (selectedMaterialId !== SPALTED_MAPLE_MATERIAL_ID) return;

  const tabletopRoot = renderRoot.getObjectByName('tabletop');
  if (!tabletopRoot) return;

  try {
    const texture = await loadTabletopTexture();
    tabletopRoot.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => cloneMaterialWithTexture(material, texture));
      } else {
        child.material = cloneMaterialWithTexture(child.material, texture);
      }
    });
    log.info('Applied spalted maple tabletop material override', {
      materialId: selectedMaterialId,
      texturePath: SPALTED_MAPLE_TEXTURE_PATH
    });
  } catch (error) {
    log.warn('Failed to apply spalted maple tabletop texture', {
      materialId: selectedMaterialId,
      texturePath: SPALTED_MAPLE_TEXTURE_PATH,
      error
    });
  }
}

async function applySelectedResinPreview(renderRoot) {
  if (!renderRoot) return;

  const selectedColorId = state && state.selections && state.selections.options
    ? state.selections.options.color || null
    : null;
  if (!selectedColorId) return;

  const epoxyRoot = renderRoot.getObjectByName(EPOXY_PREVIEW_PART_NAME);
  if (!epoxyRoot) return;

  try {
    const colorDefinitions = await loadColorDefinitions();
    const selectedColor = colorDefinitions.find((entry) => entry && entry.id === selectedColorId);
    const texturePath = selectedColor && typeof selectedColor.image === 'string'
      ? selectedColor.image.trim()
      : '';
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

    log.info('Applied resin preview test material override', {
      colorId: selectedColorId,
      texturePath,
      epoxyPartName: EPOXY_PREVIEW_PART_NAME
    });
  } catch (error) {
    log.warn('Failed to apply resin preview test material override', {
      colorId: selectedColorId,
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

function setViewerState(mode, { errorCopy } = {}) {
  if (dom.surface) dom.surface.dataset.viewerState = mode;
  if (dom.empty) dom.empty.hidden = mode !== 'empty';
  if (dom.loading) dom.loading.hidden = mode !== 'loading';
  if (dom.error) dom.error.hidden = mode !== 'error';
  if (typeof errorCopy === 'string' && dom.errorCopy) dom.errorCopy.textContent = errorCopy;
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
}

function clearCurrentRenderRoot() {
  if (currentRenderRoot && currentRenderRoot.parent) {
    currentRenderRoot.parent.remove(currentRenderRoot);
    disposeObject3D(currentRenderRoot);
  }
  currentRenderRoot = null;
  displayedModelId = null;
  displayedRenderSignature = null;
}

function getModelFramingMetrics(root) {
  if (!root) return null;
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) throw new Error('Loaded model has no visible bounds.');

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
  return applyFramingMetrics(metrics, config, options);
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
  await applySelectedTabletopMaterial(renderRoot);
  await applySelectedTabletopSheen(renderRoot);
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
  showReadyState(modelId, config);
}

function showEmptyState() {
  pendingRequestToken += 1;
  isLoading = false;
  requestedModelId = null;
  clearCurrentRenderRoot();
  log.info('Showing viewer empty state');
  setViewerState('empty');
  setLiveStatus('3D preview ready. Choose a model to begin.');
}

function showErrorState(title, errorCopy = ERROR_COPY) {
  isLoading = false;
  log.warn('Showing viewer error state', { title, errorCopy });
  setViewerState('error', { errorCopy });
  setLiveStatus(`3D preview unavailable for ${title}.`);
}

function showReadyState(modelId, config = {}) {
  const title = getModelTitle(modelId, config);
  log.info('Showing viewer ready state', { modelId, title });
  setViewerState('ready');
  setLiveStatus(`${title} 3D preview loaded.`);
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
    showErrorState(getModelTitle(modelId), 'The local viewer manifest could not be loaded.');
    return;
  }

  const config = resolveViewerConfig(manifest, modelId);
  const renderableParts = getRenderableParts(config || {});
  if (!config || !renderableParts.length) {
    showErrorState(getModelTitle(modelId), 'No local 3D asset is mapped for the selected model yet.');
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
    showReadyState(modelId, config);
    return;
  }

  if (!force && currentRenderRoot && displayedRenderSignature === renderSignature) {
    displayedModelId = modelId;
    const previousMetrics = getModelFramingMetrics(currentRenderRoot);
    const previousTarget = previousMetrics ? previousMetrics.target.clone() : controls.target.clone();
    applyConfiguredPartTransforms(currentRenderRoot, config);
    const framing = frameModel(currentRenderRoot, config, { preserveView: true, previousTarget });
    log.info('Reused existing viewer asset across model mapping', { modelId, framing });
    showReadyState(modelId, config);
    return;
  }

  const requestToken = ++pendingRequestToken;
  isLoading = true;
  setViewerState('loading');
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
    showReadyState(modelId, config);
  } catch (error) {
    log.warn('Failed to load 3D preview', { modelId, error });
    if (requestToken !== pendingRequestToken) return;
    showErrorState(title, 'The selected tabletop and leg preview could not be loaded. Try again.');
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
}

export function resetView() {
  if (!camera || !controls || !currentRenderRoot) return;
  camera.position.copy(defaultCameraPosition);
  controls.target.copy(defaultCameraTarget);
  controls.reset();
  controls.update();
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
  dom.empty = document.getElementById('viewer-empty-state');
  dom.loading = document.getElementById('viewer-loading-state');
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
  scene.environment = pmremGenerator.fromScene(roomEnvironment, 0.05).texture;
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
  controls.update();

  applyViewerTheme();
  renderer.setAnimationLoop(() => {
    if (!renderer || !scene || !camera) return;
    if (controls) controls.update();
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
  const nextColorId = state && state.selections && state.selections.options
    ? state.selections.options.color || null
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
  const colorChanged = nextColorId !== lastObservedColorId;
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
  if (colorChanged) {
    log.info('Viewer observed resin color selection change', {
      previousColorId: lastObservedColorId,
      nextColorId
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
  lastObservedColorId = nextColorId;
  lastObservedLegId = nextLegId;
  lastObservedTubeId = nextTubeId;
  lastObservedLegFinishId = nextLegFinishId;
  lastObservedAddonsSignature = nextAddonsSignature;
  lastObservedDimensionsSignature = nextDimensionsSignature;

  if (modelChanged) {
    void updateModel(nextModelId);
    return;
  }

  if ((materialChanged || finishSheenChanged || colorChanged || legFinishChanged) && nextModelId) {
    void updateModel(nextModelId, { force: true });
    return;
  }

  if ((legChanged || tubeChanged || addonsChanged) && nextModelId) {
    void updateModel(nextModelId);
    return;
  }

  if ((designChanged || dimensionsChanged) && nextModelId) {
    void updateModel(nextModelId);
  }
});
