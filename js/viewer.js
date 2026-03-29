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

const VIEWER_DEBUG_ENABLED = false;
const log = VIEWER_DEBUG_ENABLED
  ? createLogger('Viewer')
  : { debug() {}, info() {}, warn() {}, error() {} };

const VIEWER_MANIFEST_PATH = 'data/viewer-models.json';
const LEG_FINISH_DATA_PATH = 'data/leg-finish.json';
const COLOR_DATA_PATH = 'data/colors.json';
const FINISH_DATA_PATH = 'data/finish.json';
const FALLBACK_CAMERA_OFFSET = Object.freeze([1.65, 0.94, 1.95]);
const ERROR_COPY = 'The selected 3D preview could not be loaded. Try again.';
const SPALTED_MAPLE_MATERIAL_ID = 'mat-02';
const SPALTED_MAPLE_TEXTURE_PATH = 'assets/models/textures/Gemini_Generated_Image_otflgaotflgaotfl.png';
const EPOXY_PREVIEW_PART_NAME = 'tabletop-epoxy';
const LIVE_EDGE_ADDON_ID = 'addon-live-edge';
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
const EPOXY_VERTICAL_INSET = 0.0015;
const GLASS_TOP_ADDON_ID = 'addon-glass-top';
const GLASS_TOP_PART_NAME = 'tabletop-glass';
const GLASS_TOP_THICKNESS_IN = 0.25;
const GLASS_TOP_AXIS_REDUCTION_IN = 0.125;
const GLASS_TOP_SURFACE_GAP = 0.0007;
const GLASS_TOP_MATERIAL_THICKNESS = GLASS_TOP_THICKNESS_IN * 0.0254;
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
const LIVE_EDGE_RESIN_SAMPLE_COUNT = 15;
const LIVE_EDGE_RESIN_MIN_GAP = 0.01;
const LIVE_EDGE_RESIN_NORMAL_Y_MIN = 0.7;
const LIVE_EDGE_RESIN_INNER_OVERDRAW = 0.0015;
const LIVE_EDGE_RESIN_OUTER_CLEARANCE = 0.0015;
const RESIN_PREVIEW_TOP_VIEW_TRANSMISSION = 0.78;
const RESIN_PREVIEW_END_VIEW_TRANSMISSION = 0.54;
const RESIN_PREVIEW_TOP_VIEW_ATTENUATION_DISTANCE = 0.82;
const RESIN_PREVIEW_END_VIEW_ATTENUATION_DISTANCE = 0.5;
const RESIN_PREVIEW_VIEW_BLEND_MIN = 0.18;
const RESIN_PREVIEW_VIEW_BLEND_MAX = 0.78;

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
let materialSourcePromises = new Map();
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
let activeResinPreviewMaterials = [];
const cameraViewDirection = new THREE.Vector3();

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
      ? Number(sourceMaterial.opacity)
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
  activeResinPreviewMaterials = [];

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
    setActiveResinPreviewMaterialsFromRoot(renderRoot);
    updateResinPreviewMaterialsForView();

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
