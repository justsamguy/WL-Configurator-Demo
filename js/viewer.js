// WoodLab Configurator - viewer.js
// Persistent Three.js viewer with empty, loading, ready, and error states.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { loadData } from './dataLoader.js';
import { state } from './state.js';
import { createLogger } from './logger.js';

const log = createLogger('Viewer');

const VIEWER_MANIFEST_PATH = 'data/viewer-models.json';
const FALLBACK_CAMERA_OFFSET = Object.freeze([1.65, 0.94, 1.95]);
const ERROR_COPY = 'The selected 3D preview could not be loaded. Try again.';

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
let displayedAssetPath = null;
let pendingRequestToken = 0;
let isLoading = false;
let defaultCameraPosition = new THREE.Vector3(32, 22, 40);
let defaultCameraTarget = new THREE.Vector3(0, 10, 0);
let hasLoggedManifestSummary = false;

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
  displayedAssetPath = null;
}

function frameModel(root, config = {}) {
  if (!root || !camera || !controls) return;

  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) throw new Error('Loaded model has no visible bounds.');

  const size = bounds.getSize(new THREE.Vector3());
  const target = bounds.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const cameraSettings = getCameraSettings(config);
  const offset = new THREE.Vector3(
    Number(cameraSettings.offset[0]) || FALLBACK_CAMERA_OFFSET[0],
    Number(cameraSettings.offset[1]) || FALLBACK_CAMERA_OFFSET[1],
    Number(cameraSettings.offset[2]) || FALLBACK_CAMERA_OFFSET[2]
  );
  const cameraPosition = target.clone().add(offset.multiplyScalar(maxDim));

  camera.position.copy(cameraPosition);
  camera.near = Math.max(0.1, maxDim / 100);
  camera.far = Math.max(120, maxDim * 20);
  camera.updateProjectionMatrix();

  controls.target.copy(target);
  controls.minDistance = Math.max(0.5, maxDim * cameraSettings.minDistanceMultiplier);
  controls.maxDistance = Math.max(controls.minDistance + 1, maxDim * cameraSettings.maxDistanceMultiplier);
  controls.update();
  controls.saveState();

  defaultCameraPosition = camera.position.clone();
  defaultCameraTarget = controls.target.clone();

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

  return {
    ...defaults,
    ...modelEntry,
    camera: {
      ...(defaults.camera && typeof defaults.camera === 'object' ? defaults.camera : {}),
      ...(modelEntry.camera && typeof modelEntry.camera === 'object' ? modelEntry.camera : {})
    }
  };
}

async function buildRenderRoot(config) {
  if (!loader) loader = new GLTFLoader();
  const assetPath = config && typeof config.assetPath === 'string' ? config.assetPath : '';
  if (!assetPath) throw new Error('No asset path configured for viewer model.');

  const gltf = await loader.loadAsync(assetPath);
  const sourceRoot = gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null);
  if (!sourceRoot) throw new Error('GLB did not contain a scene.');

  const renderRoot = new THREE.Group();
  renderRoot.name = `viewer-model-${requestedModelId || 'selection'}`;
  renderRoot.add(sourceRoot);
  renderRoot.scale.copy(getScaleVector(config.scale));

  if (Array.isArray(config.rotation) && config.rotation.length === 3) {
    renderRoot.rotation.set(
      Number(config.rotation[0]) || 0,
      Number(config.rotation[1]) || 0,
      Number(config.rotation[2]) || 0
    );
  }

  configureModelMeshes(renderRoot, config);

  const initialBounds = new THREE.Box3().setFromObject(renderRoot);
  if (initialBounds.isEmpty()) throw new Error('Loaded model has no mesh bounds.');

  const center = initialBounds.getCenter(new THREE.Vector3());
  renderRoot.position.set(-center.x, -initialBounds.min.y, -center.z);

  if (Array.isArray(config.positionOffset) && config.positionOffset.length === 3) {
    renderRoot.position.x += Number(config.positionOffset[0]) || 0;
    renderRoot.position.y += Number(config.positionOffset[1]) || 0;
    renderRoot.position.z += Number(config.positionOffset[2]) || 0;
  }

  return renderRoot;
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
  if (!config || !config.assetPath) {
    showErrorState(getModelTitle(modelId), 'No local 3D asset is mapped for the selected model yet.');
    return;
  }

  const title = getModelTitle(modelId, config);
  requestedModelId = modelId;
  log.info('Viewer config resolved', {
    modelId,
    title,
    assetPath: config.assetPath,
    camera: getCameraSettings(config)
  });

  if (!force && currentRenderRoot && displayedModelId === modelId && displayedAssetPath === config.assetPath) {
    const framing = frameModel(currentRenderRoot, config);
    log.info('Reused existing viewer asset for same model', { modelId, framing });
    showReadyState(modelId, config);
    return;
  }

  if (!force && currentRenderRoot && displayedAssetPath === config.assetPath) {
    displayedModelId = modelId;
    const framing = frameModel(currentRenderRoot, config);
    log.info('Reused existing viewer asset across model mapping', { modelId, framing });
    showReadyState(modelId, config);
    return;
  }

  const requestToken = ++pendingRequestToken;
  isLoading = true;
  setViewerState('loading');
  setLiveStatus(`Loading ${title} 3D preview.`);

  try {
    log.info('Starting GLB load', { modelId, assetPath: config.assetPath });
    const nextRoot = await buildRenderRoot(config);
    if (requestToken !== pendingRequestToken) {
      disposeObject3D(nextRoot);
      return;
    }

    replaceCurrentRenderRoot(nextRoot);
    displayedModelId = modelId;
    displayedAssetPath = config.assetPath;
    const framing = frameModel(nextRoot, config);
    log.info('GLB load succeeded', {
      modelId,
      assetPath: config.assetPath,
      framing
    });
    showReadyState(modelId, config);
  } catch (error) {
    log.warn('Failed to load 3D preview', { modelId, error });
    if (requestToken !== pendingRequestToken) return;
    showErrorState(title, 'The local placeholder model could not be loaded. Try again.');
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
  if (nextModelId !== lastObservedModelId) {
    log.info('Viewer observed model selection change', {
      previousModelId: lastObservedModelId,
      nextModelId
    });
    lastObservedModelId = nextModelId;
  }
  void updateModel(nextModelId);
});
