// WoodLab Configurator - main.js
// App bootstrap and global state management

import { loadComponent } from './app.js';
import { loadIcon } from './ui/icon.js';
import { initPlaceholderInteractions } from './ui/placeholders.js';
import { initViewer, initViewerControls, resizeViewer } from './viewer.js'; // Import viewer functions
import { state, setState } from './state.js';
import { computePrice, getLegPriceMultiplier, getVisibleLegCount, getWaterfallEdgeCount, requiresCenterLeg } from './pricing.js';
import * as dataLoader from './dataLoader.js';
import { buildExportJSON } from './export.js';
import { createLogger, setLevel } from './logger.js';
import { scrollElementToTop } from './ui/scrollAlignment.js';
import {
  getLowerShelfCompatibilityTooltip,
  isLowerShelfCompatibleContext
} from './legGeometry.js';

const log = createLogger('Main');
const addonsLog = createLogger('Addons');
const THEME_STORAGE_KEY = 'wl-theme-mode';
const THEME_MODES = ['system', 'light', 'dark'];
let systemThemeMediaQuery = null;
let systemThemeListenerBound = false;
let footerMetricsObserver = null;

if (typeof window !== 'undefined' && typeof window.WL_LOG_LEVEL !== 'string') {
  // Reset any persisted debug logger state unless this page explicitly opts into another level.
  setLevel('info');
}

function normalizeThemeMode(mode) {
  return THEME_MODES.includes(mode) ? mode : 'system';
}

function getStoredThemeMode() {
  try {
    return normalizeThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
  } catch (e) {
    return 'system';
  }
}

function saveThemeMode(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (e) {
    // ignore storage failures in private browsing / strict privacy modes
  }
}

function resolveThemeMode(mode) {
  const normalizedMode = normalizeThemeMode(mode);
  if (normalizedMode !== 'system') return normalizedMode;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function getNextThemeMode(mode) {
  const normalizedMode = normalizeThemeMode(mode);
  const currentIndex = THEME_MODES.indexOf(normalizedMode);
  const nextIndex = (currentIndex + 1) % THEME_MODES.length;
  return THEME_MODES[nextIndex];
}

function formatThemeModeLabel(mode) {
  if (mode === 'system') return 'System';
  if (mode === 'light') return 'Light';
  if (mode === 'dark') return 'Dark';
  return 'System';
}

function getThemeIconClass(mode) {
  if (mode === 'light') return 'fa-solid fa-sun';
  if (mode === 'dark') return 'fa-regular fa-moon';
  return 'fa-solid fa-computer';
}

function updateThemeToggleUI(mode, resolvedTheme) {
  const button = document.getElementById('theme-cycle-toggle');
  const label = document.getElementById('theme-cycle-label');
  const icon = document.getElementById('theme-cycle-icon');
  if (!button) return;
  const nextMode = getNextThemeMode(mode);
  const modeLabel = formatThemeModeLabel(mode);
  const nextModeLabel = formatThemeModeLabel(nextMode);

  button.dataset.themeMode = mode;
  button.dataset.resolvedTheme = resolvedTheme;
  button.setAttribute('aria-label', `Theme mode: ${modeLabel}. Activate to switch to ${nextModeLabel}.`);
  button.setAttribute('title', `Theme: ${modeLabel} (next: ${nextModeLabel})`);

  if (icon) {
    icon.className = `${getThemeIconClass(mode)} theme-cycle-icon-glyph`;
  }

  if (label) {
    label.textContent = mode === 'system'
      ? `${modeLabel} (${formatThemeModeLabel(resolvedTheme)})`
      : modeLabel;
  }
}

function announceThemeStatus(mode, resolvedTheme) {
  const status = document.getElementById('theme-toggle-status');
  if (!status) return;
  const modeLabel = formatThemeModeLabel(mode);
  if (mode === 'system') {
    status.textContent = `Theme set to System. Using ${formatThemeModeLabel(resolvedTheme)} appearance.`;
    return;
  }
  status.textContent = `Theme set to ${modeLabel}.`;
}

function applyThemeMode(mode, { persist = false, announce = false } = {}) {
  const normalizedMode = normalizeThemeMode(mode);
  const resolvedTheme = resolveThemeMode(normalizedMode);

  document.documentElement.setAttribute('data-theme-mode', normalizedMode);
  document.documentElement.setAttribute('data-resolved-theme', resolvedTheme);
  if (document.body) {
    document.body.setAttribute('data-theme-mode', normalizedMode);
    document.body.setAttribute('data-resolved-theme', resolvedTheme);
  }

  updateThemeToggleUI(normalizedMode, resolvedTheme);
  if (persist) saveThemeMode(normalizedMode);
  if (announce) announceThemeStatus(normalizedMode, resolvedTheme);
}

function initThemeToggle() {
  const initialMode = getStoredThemeMode();
  applyThemeMode(initialMode);

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (!systemThemeMediaQuery) {
      systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }
    if (!systemThemeListenerBound) {
      const handleSystemThemeChange = () => {
        const currentMode = normalizeThemeMode(document.documentElement.getAttribute('data-theme-mode'));
        if (currentMode === 'system') applyThemeMode('system');
      };
      if (typeof systemThemeMediaQuery.addEventListener === 'function') {
        systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
      } else if (typeof systemThemeMediaQuery.addListener === 'function') {
        systemThemeMediaQuery.addListener(handleSystemThemeChange);
      }
      systemThemeListenerBound = true;
    }
  }

  const button = document.getElementById('theme-cycle-toggle');
  if (!button || button.dataset.listenerBound === 'true') return;

  button.addEventListener('click', () => {
    const currentMode = normalizeThemeMode(document.documentElement.getAttribute('data-theme-mode'));
    const nextMode = getNextThemeMode(currentMode);
    applyThemeMode(nextMode, { persist: true, announce: true });
  });
  button.dataset.listenerBound = 'true';
}

function parseRgbColor(value) {
  if (!value || typeof value !== 'string') return null;
  const channels = value.match(/[\d.]+/g);
  if (!channels || channels.length < 3) return null;
  return channels.slice(0, 3).map((channel) => Math.max(0, Math.min(255, Math.round(Number(channel)))));
}

function mixRgbColor(a, b, weight = 0.5) {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  const mix = Math.max(0, Math.min(1, Number(weight)));
  return [
    Math.round((a[0] * (1 - mix)) + (b[0] * mix)),
    Math.round((a[1] * (1 - mix)) + (b[1] * mix)),
    Math.round((a[2] * (1 - mix)) + (b[2] * mix))
  ];
}

function syncFooterLayoutVars() {
  const footer = document.getElementById('app-footer');
  const footerBar = footer && footer.querySelector('.footer-bar');
  if (!footer || !footerBar || typeof window === 'undefined') return;

  const footerHeight = Math.ceil(footerBar.getBoundingClientRect().height || footerBar.offsetHeight || 0);
  const footerStyles = window.getComputedStyle(footer);
  const floatingGap = parseFloat(footerStyles.bottom || '0') || 0;

  if (footerHeight > 0) {
    document.documentElement.style.setProperty('--footer-height', `${footerHeight}px`);
  }
  document.documentElement.style.setProperty('--footer-floating-gap', `${floatingGap}px`);
}

function initFooterLayoutVars() {
  syncFooterLayoutVars();

  const footer = document.getElementById('app-footer');
  const footerBar = footer && footer.querySelector('.footer-bar');
  if (!footer || !footerBar) return;

  if (footerMetricsObserver && typeof footerMetricsObserver.disconnect === 'function') {
    footerMetricsObserver.disconnect();
  }

  if (typeof ResizeObserver === 'function') {
    footerMetricsObserver = new ResizeObserver(() => syncFooterLayoutVars());
    footerMetricsObserver.observe(footer);
    footerMetricsObserver.observe(footerBar);
  }
}

function initFooterLiquidGlass() {
  const footerBar = document.querySelector('.footer-bar');
  if (!footerBar || footerBar.dataset.glassBound === 'true') return;
  footerBar.dataset.glassBound = 'true';

  const setGlassVar = (name, value) => footerBar.style.setProperty(name, value);
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resetPointerState = () => {
    setGlassVar('--footer-glass-x', '50%');
    setGlassVar('--footer-glass-y', '45%');
    setGlassVar('--footer-glass-shift', '0px');
  };

  const updatePointerState = (clientX, clientY) => {
    if (reducedMotion) return;
    const rect = footerBar.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const shift = ((xRatio - 0.5) + (0.5 - yRatio)) * 3.4;
    setGlassVar('--footer-glass-x', `${(xRatio * 100).toFixed(1)}%`);
    setGlassVar('--footer-glass-y', `${(yRatio * 100).toFixed(1)}%`);
    setGlassVar('--footer-glass-shift', `${shift.toFixed(2)}px`);
  };

  const updateAmbientTint = () => {
    const bodyColor = parseRgbColor(window.getComputedStyle(document.body).backgroundColor) || [235, 241, 248];
    const mainEl = document.getElementById('app-main');
    const mainColor = mainEl ? parseRgbColor(window.getComputedStyle(mainEl).backgroundColor) || bodyColor : bodyColor;
    const resolvedTheme = document.body.getAttribute('data-resolved-theme') || 'light';
    const tintBase = mixRgbColor(bodyColor, mainColor, 0.5) || bodyColor;
    const tint = mixRgbColor(tintBase, resolvedTheme === 'dark' ? [116, 148, 199] : [255, 255, 255], resolvedTheme === 'dark' ? 0.28 : 0.42) || tintBase;
    const edge = mixRgbColor(tint, [255, 255, 255], resolvedTheme === 'dark' ? 0.2 : 0.62) || tint;
    const shadow = mixRgbColor(bodyColor, [6, 10, 21], resolvedTheme === 'dark' ? 0.85 : 0.56) || [15, 23, 42];
    setGlassVar('--footer-glass-tint-rgb', `${tint.join(', ')}`);
    setGlassVar('--footer-glass-edge-rgb', `${edge.join(', ')}`);
    setGlassVar('--footer-glass-shadow-rgb', `${shadow.join(', ')}`);
    setGlassVar('--footer-glass-ambient-alpha', resolvedTheme === 'dark' ? '0.33' : '0.22');
  };

  const scrollSources = new Set();
  const bindScrollSource = (element, handler) => {
    if (!element || element.dataset.glassScrollBound === 'true') return;
    element.addEventListener('scroll', handler, { passive: true });
    element.dataset.glassScrollBound = 'true';
  };
  const syncScrollSources = () => {
    scrollSources.clear();
    const appMain = document.getElementById('app-main');
    const appSidebar = document.getElementById('app-sidebar');
    if (appMain) scrollSources.add(appMain);
    if (appSidebar) scrollSources.add(appSidebar);
    document.querySelectorAll('.stage-panel, body > #stage-panel-0').forEach((element) => scrollSources.add(element));
  };

  const getScrollSignal = () => {
    let signal = window.scrollY || window.pageYOffset || 0;
    scrollSources.forEach((element) => {
      if (!element || !element.isConnected) return;
      const maxScrollable = element.scrollHeight - element.clientHeight;
      if (maxScrollable <= 1) return;
      signal += element.scrollTop || 0;
    });
    return signal;
  };

  const updateViewportSheen = () => {
    const viewportHeight = Math.max(1, window.innerHeight || 1);
    const ratio = ((getScrollSignal() % viewportHeight) / viewportHeight);
    const sheenPosition = 45 + (ratio * 24);
    setGlassVar('--footer-glass-sheen', `${sheenPosition.toFixed(1)}%`);
  };

  const refreshGlassContext = () => {
    syncScrollSources();
    updateAmbientTint();
    updateViewportSheen();
    scrollSources.forEach((element) => bindScrollSource(element, updateViewportSheen));
  };
  let refreshScheduled = false;
  const scheduleGlassContextRefresh = () => {
    if (refreshScheduled) return;
    refreshScheduled = true;
    const run = () => {
      refreshScheduled = false;
      refreshGlassContext();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  };

  syncScrollSources();

  footerBar.addEventListener('pointermove', (event) => updatePointerState(event.clientX, event.clientY));
  footerBar.addEventListener('pointerdown', (event) => updatePointerState(event.clientX, event.clientY));
  footerBar.addEventListener('pointerleave', resetPointerState);
  window.addEventListener('resize', () => {
    refreshGlassContext();
  }, { passive: true });
  window.addEventListener('scroll', updateViewportSheen, { passive: true });
  scrollSources.forEach((element) => bindScrollSource(element, updateViewportSheen));

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => scheduleGlassContextRefresh());
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-resolved-theme', 'class'] });
    const appMain = document.getElementById('app-main');
    const appSidebar = document.getElementById('app-sidebar');
    if (appMain) observer.observe(appMain, { childList: true, subtree: true });
    if (appSidebar) observer.observe(appSidebar, { childList: true, subtree: true });
  }

  refreshGlassContext();
}

if (typeof document !== 'undefined') {
  applyThemeMode(getStoredThemeMode());
}

if (typeof window !== 'undefined') {
  window.exportConfig = async () => {
    try {
      const payload = await buildExportJSON(state, dataLoader);
      console.log('Configuration exported. Copy the JSON below and paste into your LLM:');
      console.log(JSON.stringify(payload, null, 2));
      return payload;
    } catch (e) {
      log.warn('Export config failed', e);
      console.warn('Configuration export failed. See log for details.');
      return null;
    }
  };
}

function setStageSubsectionExpanded(dropdown, shouldExpand, opts = {}) {
  if (!dropdown) return;
  const { animate = true } = opts;
  const header = dropdown.querySelector('.stage-subsection-header');
  const content = dropdown.querySelector('.stage-subsection-content');
  if (!header || !content) return;

  const isExpanded = dropdown.classList.contains('expanded');
  if (isExpanded === shouldExpand) return;

  header.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');

  if (shouldExpand) {
    dropdown.classList.add('expanded');
    content.hidden = false;
    if (animate) {
      requestAnimationFrame(() => scrollElementToTop(dropdown));
    }
    if (!animate) {
      content.style.maxHeight = 'none';
      return;
    }

    content.style.maxHeight = '0px';
    const targetHeight = content.scrollHeight;
    const expandFrame = () => {
      content.style.maxHeight = `${targetHeight}px`;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(expandFrame);
    else expandFrame();

    const onExpandTransitionEnd = (ev) => {
      if (ev.propertyName !== 'max-height') return;
      if (dropdown.classList.contains('expanded')) {
        content.style.maxHeight = 'none';
      }
      content.removeEventListener('transitionend', onExpandTransitionEnd);
    };
    content.addEventListener('transitionend', onExpandTransitionEnd);
    return;
  }

  if (!animate) {
    dropdown.classList.remove('expanded');
    content.style.maxHeight = '0px';
    content.hidden = true;
    return;
  }

  content.style.maxHeight = `${content.scrollHeight}px`;
  const collapseFrame = () => {
    dropdown.classList.remove('expanded');
    content.style.maxHeight = '0px';
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(collapseFrame);
  else collapseFrame();

  const onCollapseTransitionEnd = (ev) => {
    if (ev.propertyName !== 'max-height') return;
    if (!dropdown.classList.contains('expanded')) {
      content.hidden = true;
    }
    content.removeEventListener('transitionend', onCollapseTransitionEnd);
  };
  content.addEventListener('transitionend', onCollapseTransitionEnd);
}

function initStageSubsectionDropdowns(root = document) {
  if (!root || !root.querySelectorAll) return;
  const dropdowns = root.querySelectorAll('.stage-subsection-dropdown');
  dropdowns.forEach((dropdown, index) => {
    if (dropdown.dataset.dropdownBound === 'true') return;
    const header = dropdown.querySelector('.stage-subsection-header');
    const content = dropdown.querySelector('.stage-subsection-content');
    if (!header || !content) return;

    if (!content.id) content.id = `stage-subsection-content-${index + 1}`;
    header.setAttribute('aria-controls', content.id);
    dropdown.dataset.dropdownBound = 'true';

    const startExpanded = dropdown.dataset.defaultExpanded === 'true';
    setStageSubsectionExpanded(dropdown, startExpanded, { animate: false });

    header.addEventListener('click', () => {
      const shouldExpand = !dropdown.classList.contains('expanded');
      setStageSubsectionExpanded(dropdown, shouldExpand, { animate: true });
    });
  });
}

/**
 * Filter designs by model compatibility
 *
 * This function determines which designs are available for a given model by checking
 * the "prices" object in each design's data (from data/designs.json).
 *
 * Design Availability Rules:
 * - A design is available for a model if it has a price entry for that model's ID
 * - Example: { "prices": { "mdl-coffee": 10800, "mdl-dining": 13200 } }
 *   This design is available for Coffee and Dining tables, but NOT Conference tables
 *
 * To Configure Design Availability:
 * 1. Open data/designs.json
 * 2. For each design, add/remove model IDs in the "prices" object
 * 3. Model IDs: "mdl-coffee", "mdl-dining", "mdl-conference"
 *
 * Examples:
 * - Universal design (all models): { "prices": { "mdl-coffee": X, "mdl-dining": Y, "mdl-conference": Z } }
 * - Exclusive design (one model): { "prices": { "mdl-coffee": X } }
 * - Partial availability: { "prices": { "mdl-coffee": X, "mdl-dining": Y } }
 *
 * @param {Array} designs - Array of design objects from data/designs.json
 * @param {string} modelId - The selected model ID (e.g., "mdl-coffee")
 * @returns {Array} Filtered array of designs compatible with the selected model
 */
function filterDesignsByModel(designs, modelId) {
  const visibleDesigns = Array.isArray(designs)
    ? designs.filter(design => !(design && design.hidden === true))
    : designs;
  if (!modelId) return visibleDesigns; // Show all visible designs if no model selected

  return visibleDesigns.filter(design => {
    // Check if this design has pricing for the selected model
    return design.prices && design.prices[modelId];
  });
}

/**
 * Filter materials by design compatibility
 *
 * This function determines which materials are available for a given design by checking
 * the "designs" array in each material's data (from data/materials.json).
 *
 * Material Availability Rules:
 * - A material is available for all designs if it has no "designs" property
 * - A material is available for specific designs if it has a "designs" array containing the design ID
 * - Example: { "designs": ["des-cookie"] } means only available for Cookie design
 *
 * To Configure Material Availability:
 * 1. Open data/materials.json
 * 2. For each material, add a "designs" array with design IDs to restrict availability
 * 3. Omit "designs" property for universal materials
 *
 * Examples:
 * - Universal material (all designs): no "designs" property
 * - Exclusive material (one design): { "designs": ["des-cookie"] }
 * - Partial availability: { "designs": ["des-river", "des-slab"] }
 *
 * @param {Array} materials - Array of material objects from data/materials.json
 * @param {string} designId - The selected design ID (e.g., "des-cookie")
 * @returns {Array} Filtered array of materials compatible with the selected design
 */
function filterMaterialsByDesign(materials, designId) {
  if (!designId) return materials; // Show all materials if no design selected

  return materials.filter(material => {
    // If material has no designs restriction, it's available for all designs
    if (!material.designs) return true;
    // If material has designs restriction, check if current design is included
    return Array.isArray(material.designs) && material.designs.includes(designId);
  });
}

function filterDesignPresetsByModel(presets, modelId) {
  if (!Array.isArray(presets)) return [];
  if (!modelId) return presets;
  return presets.filter((preset) => preset && preset.modelId === modelId);
}

function getModelDesignBadgeLabel(modelId) {
  const modelLabels = {
    'mdl-coffee': 'Coffee',
    'mdl-dining': 'Dining',
    'mdl-conference': 'Conference'
  };
  return modelLabels[modelId] || 'Model';
}

function getExclusiveDesignModelId(design) {
  const modelIds = design && design.prices && typeof design.prices === 'object'
    ? Object.keys(design.prices).filter(Boolean)
    : [];
  return modelIds.length === 1 ? modelIds[0] : null;
}

function sortDesignsForModel(designs, modelId) {
  return designs
    .map((design, index) => ({ design, index }))
    .sort((a, b) => {
      const aExclusiveRank = getExclusiveDesignModelId(a.design) === modelId ? 0 : 1;
      const bExclusiveRank = getExclusiveDesignModelId(b.design) === modelId ? 0 : 1;
      if (aExclusiveRank !== bExclusiveRank) return aExclusiveRank - bExclusiveRank;
      return a.index - b.index;
    })
    .map(({ design }) => design);
}

async function renderDesignOptionsForModel(modelId = (state.selections && state.selections.model)) {
  const designsSection = document.getElementById('designs-stage-section');
  if (!designsSection) return;

  try {
    const { loadData } = await import('./dataLoader.js');
    const { renderOptionCards } = await import('./stageRenderer.js');
    const [designs, presets] = await Promise.all([
      loadData('data/designs.json'),
      loadData('data/design-presets.json')
    ]);

    const layoutGrid = document.getElementById('design-layout-options') ||
      designsSection.querySelector('.stage-options-grid');
    if (layoutGrid && Array.isArray(designs)) {
      const filteredDesigns = filterDesignsByModel(designs, modelId);
      const seenDesignIds = new Set();
      const dedupedDesigns = filteredDesigns.filter((design) => {
        if (!design || !design.id) return false;
        if (seenDesignIds.has(design.id)) return false;
        seenDesignIds.add(design.id);
        return true;
      });
      const orderedDesigns = sortDesignsForModel(dedupedDesigns, modelId);
      const designsWithPrice = orderedDesigns.map((design) => {
        const exclusiveModelId = getExclusiveDesignModelId(design);
        return {
          ...design,
          price: modelId && design.prices ? design.prices[modelId] : 0,
          badge: exclusiveModelId === modelId
            ? { label: `${getModelDesignBadgeLabel(exclusiveModelId)} Exclusive`, tone: 'exclusive' }
            : { label: 'Layout', tone: 'layout' }
        };
      });
      renderOptionCards(layoutGrid, designsWithPrice, { category: 'design', ignorePlaceholder: true });
    }

    const presetGrid = document.getElementById('design-presets-options');
    if (presetGrid) {
      const filteredPresets = filterDesignPresetsByModel(presets, modelId);
      const presetCards = filteredPresets.map((preset) => ({
        id: preset.id,
        title: preset.title,
        image: preset.image,
        description: preset.description,
        badge: { label: 'Preset', tone: 'preset' },
        attributes: {
          'data-preset-id': preset.id,
          'data-design-id': preset.designId
        }
      }));
      renderOptionCards(presetGrid, presetCards, { category: 'design', showPrice: false, ignorePlaceholder: true });
    }
  } catch (e) {
    log.warn('Failed to render design options', e);
  }
}

async function applyDesignPreset(presetId, selectedDesignId = null) {
  if (!presetId) return;

  try {
    const { loadData } = await import('./dataLoader.js');
    const { renderOptionCards, renderAddonsDropdown } = await import('./stageRenderer.js');
    const presets = await loadData('data/design-presets.json');
    if (!Array.isArray(presets)) return;

    const preset = presets.find((entry) => entry && entry.id === presetId);
    if (!preset) return;

    const modelId = (state.selections && state.selections.model) || preset.modelId;
    const designId = selectedDesignId || preset.designId;
    const nextOptions = preset.selections ? { ...preset.selections } : {};
    nextOptions.addon = Array.isArray(preset.addons) ? [...preset.addons] : [];
    if (!nextOptions.dimensions && preset.dimensionsDetail) {
      nextOptions.dimensions = preset.dimensionsDetail.presetId || 'dimensions-custom';
    }

    setState({
      selections: {
        ...state.selections,
        model: modelId,
        design: designId,
        options: nextOptions,
        dimensionsDetail: preset.dimensionsDetail ? { ...preset.dimensionsDetail } : null,
        techCableLength: preset.techCableLength || null
      }
    });

    const allLegs = window._allLegsData || [];
    const allTubeSizes = window._allTubeSizesData || [];
    if (allLegs.length > 0 && allTubeSizes.length > 0) {
      updateLegsOptionsForModel(modelId, allLegs, allTubeSizes, designId);
      updateLegPricingUI(state, allLegs);
    }
    updateLegsUIVisibility(nextOptions.legs || '');

    const materialsOptionsRoot = document.getElementById('materials-options');
    if (materialsOptionsRoot) {
      const mats = await loadData('data/materials.json');
      if (Array.isArray(mats)) {
        const filteredMaterials = filterMaterialsByDesign(mats, designId);
        renderOptionCards(materialsOptionsRoot, filteredMaterials, { category: 'material' });
      }
    }

    const addonsRoot = document.getElementById('addons-options');
    if (addonsRoot) {
      const addons = await loadData('data/addons.json');
      if (addons) {
        renderAddonsDropdown(addonsRoot, addons, state);
        updateEdgeProfileAddonAvailability(state);
        updateEdgeAddonCompatibility(state);
        updateWaterfallAddonAvailability(state);
        updateLowerShelfAddonAvailability(state);
      }
      try {
        const addonsStage = await import('./stages/addons.js');
        if (addonsStage && typeof addonsStage.restoreFromState === 'function') {
          addonsStage.restoreFromState(state);
        }
      } catch (e) {
        log.warn('Failed to restore addon visuals after preset apply', e);
      }
    }

    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, base: p.base, extras: p.extras, total: p.total } });
  } catch (e) {
    log.warn('Failed to apply design preset', { presetId, error: e });
  }
}

if (typeof window !== 'undefined') {
  window.__wlRenderDesignOptions = renderDesignOptionsForModel;
}

import { populateSummaryPanel } from './stages/summary.js';
import { updateAllIndicators } from './stages/addons.js';
import { getVisibleLegs, getAvailableTubeSizes } from './stages/legCompatibility.js';
import { recomputeTubeSizeConstraints, updateLegsUIVisibility } from './stages/legs.js';

// Listen for state changes to update UI
document.addEventListener('statechange', (ev) => {
  log.debug('State changed', ev.detail.state.selections);
  // main orchestrator can react to state changes here if needed.
  // ev.detail.state contains the latest state object.
  const hasDesign = !!(ev.detail.state.selections && ev.detail.state.selections.design);
  document.body.classList.toggle('has-design', hasDesign);
  // If the summary page is active, refresh its contents
  try {
    const summaryRoot = document.getElementById('summary-panel');
    if (summaryRoot) populateSummaryPanel();
  } catch (e) {
    // ignore
  }
});

// Price animation helper used by the UI when updating the price display
function animatePrice(from, to, duration = 400, onUpdate) {
  const start = performance.now();
  const delta = to - from;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut-like
    const value = Math.round(from + delta * eased);
    onUpdate(value);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updatePriceUI(total) {
  const el = document.getElementById('price-bar');
  if (!el) return;
  el.innerHTML = `$${total.toLocaleString()} <span class="text-xs font-normal">USD</span>`;
}

function isQuotedLabel(value) {
  return typeof value === 'string' && value.trim() && Number.isNaN(Number(value));
}

function formatLegPriceLabel(value) {
  if (isQuotedLabel(value)) return value.trim();
  const numeric = Number(value);
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  return `+$${safeNumber.toLocaleString()}`;
}

function normalizeLegSelection(modelId, designId, options = {}, allLegs = window._allLegsData) {
  const nextOptions = { ...options };
  if (!Array.isArray(allLegs) || !allLegs.length || !modelId) return nextOptions;

  const visibleLegIds = new Set(
    getVisibleLegs(modelId, allLegs, designId)
      .map((leg) => leg && leg.id)
      .filter(Boolean)
  );
  const currentLegId = nextOptions.legs || null;

  if (currentLegId && visibleLegIds.has(currentLegId)) return nextOptions;
  if (visibleLegIds.has(DEFAULT_LEG_ID)) {
    nextOptions.legs = DEFAULT_LEG_ID;
    return nextOptions;
  }
  nextOptions.legs = undefined;
  return nextOptions;
}

function applyLegPriceMultiplier(legs, multiplier) {
  if (!Array.isArray(legs)) return [];
  if (multiplier === 1) return legs;
  return legs.map(leg => {
    if (typeof leg.price === 'number' && Number.isFinite(leg.price)) {
      return { ...leg, price: leg.price * multiplier };
    }
    return leg;
  });
}

function updateLegPricingUI(appState = state, baseLegs = window._allLegsData) {
  const multiplier = getLegPriceMultiplier(appState);
  const banner = document.getElementById('legs-price-banner');
  if (banner) {
    const waterfallCount = getWaterfallEdgeCount(appState);
    const messages = [];
    if (requiresCenterLeg(appState)) {
      messages.push('Leg prices updated automatically because we require 3 legs on tables over 130" long.');
    }
    if (waterfallCount === 1) {
      messages.push('Single waterfall replaces one end leg; leg pricing updated automatically.');
    } else if (waterfallCount >= 2) {
      const visibleLegCount = getVisibleLegCount(appState);
      messages.push(visibleLegCount > 0
        ? 'Two waterfalls replace end legs; center support pricing remains.'
        : 'Two waterfalls replace legs; leg pricing set to $0.');
    }
    banner.classList.toggle('hidden', messages.length === 0);
    if (messages.length) banner.textContent = messages.join(' ');
  }
  if (!Array.isArray(baseLegs) || !baseLegs.length) return;

  const basePriceMap = new Map(baseLegs.map(leg => [leg.id, leg.price]));
  document.querySelectorAll('.option-card[data-category="legs"]').forEach(card => {
    const id = card.getAttribute('data-id');
    if (!id || !basePriceMap.has(id)) return;
    const basePrice = basePriceMap.get(id);
    let adjustedPrice = basePrice;

    if (typeof basePrice === 'number' && Number.isFinite(basePrice)) {
      adjustedPrice = basePrice * multiplier;
      card.setAttribute('data-price', String(adjustedPrice));
    } else if (typeof basePrice === 'string') {
      card.setAttribute('data-price', basePrice);
    }

    const priceEl = card.querySelector('.price-delta');
    if (priceEl) priceEl.textContent = formatLegPriceLabel(adjustedPrice);
  });
}

function updateWaterfallAddonAvailability(appState = state) {
  const root = document.getElementById('addons-options');
  if (!root) return;
  const addons = appState && appState.selections && appState.selections.options
    ? appState.selections.options.addon
    : [];
  const hasSingle = Array.isArray(addons) && addons.includes('addon-waterfall-single');
  const shouldDisableDependentWaterfalls = !hasSingle;
  ['addon-waterfall-second', 'addon-waterfall-art'].forEach((addonId) => {
    const checkbox = root.querySelector(`.addons-dropdown-option-checkbox[data-addon-id="${addonId}"]`);
    const option = root.querySelector(`.addons-dropdown-option[data-addon-id="${addonId}"]`);
    if (!checkbox) return;

    const disabledBy = checkbox.getAttribute('data-disabled-by') || '';
    if (shouldDisableDependentWaterfalls) {
      checkbox.disabled = true;
      checkbox.checked = false;
      checkbox.setAttribute('data-tooltip', 'Select Single Waterfall to enable');
      checkbox.setAttribute('data-disabled-by', 'waterfall');
      if (option) {
        option.classList.add('disabled');
        option.classList.remove('selected');
        option.setAttribute('aria-disabled', 'true');
        option.setAttribute('data-tooltip', 'Select Single Waterfall to enable');
      }
      return;
    }

    if (disabledBy === 'waterfall') {
      checkbox.disabled = false;
      checkbox.removeAttribute('data-tooltip');
      checkbox.removeAttribute('data-disabled-by');
      if (option) {
        option.classList.remove('disabled');
        option.removeAttribute('aria-disabled');
        if (option.getAttribute('data-disabled-by') === 'waterfall') {
          option.removeAttribute('data-disabled-by');
        }
        if (option.getAttribute('data-tooltip') === 'Select Single Waterfall to enable') {
          option.removeAttribute('data-tooltip');
        }
      }
    }
  });

  updateAllIndicators();
}

function updateEdgeAddonCompatibility(appState = state) {
  const root = document.getElementById('addons-options');
  if (!root) return;
  const addons = appState && appState.selections && appState.selections.options
    ? appState.selections.options.addon
    : [];
  const hasSquoval = Array.isArray(addons) && addons.includes('addon-squoval');
  const ids = ['addon-live-edge', 'addon-waterfall-single', 'addon-waterfall-second', 'addon-waterfall-art'];
  ids.forEach(id => {
    const checkbox = root.querySelector(`.addons-dropdown-option-checkbox[data-addon-id="${id}"]`);
    const option = root.querySelector(`.addons-dropdown-option[data-addon-id="${id}"]`);
    if (!checkbox) return;
    const disabledBy = checkbox.getAttribute('data-disabled-by') || '';
    if (hasSquoval) {
      checkbox.disabled = true;
      checkbox.checked = false;
      checkbox.setAttribute('data-disabled-by', 'squoval');
      checkbox.setAttribute('data-tooltip', 'Not compatible with Squoval');
      if (option) {
        option.classList.add('disabled');
        option.classList.remove('selected');
        option.setAttribute('aria-disabled', 'true');
        option.setAttribute('data-tooltip', 'Not compatible with Squoval');
        option.setAttribute('data-disabled-by', 'squoval');
      }
      return;
    }
    if (disabledBy === 'squoval') {
      checkbox.disabled = false;
      checkbox.removeAttribute('data-disabled-by');
      if (checkbox.getAttribute('data-tooltip') === 'Not compatible with Squoval') {
        checkbox.removeAttribute('data-tooltip');
      }
      if (option) {
        option.classList.remove('disabled');
        option.removeAttribute('aria-disabled');
        if (option.getAttribute('data-disabled-by') === 'squoval') {
          option.removeAttribute('data-disabled-by');
        }
        if (option.getAttribute('data-tooltip') === 'Not compatible with Squoval') {
          option.removeAttribute('data-tooltip');
        }
      }
    }
  });

  updateAllIndicators();
}

const EDGE_PROFILE_ADDONS = ['addon-chamfered-edges', 'addon-rounded-corners', 'addon-angled-corners', 'addon-squoval'];
const EDGE_PROFILE_COMPATIBLE_PAIRS = new Set([
  'addon-angled-corners:addon-chamfered-edges',
  'addon-chamfered-edges:addon-angled-corners'
]);
const LOWER_SHELF_ADDON_ID = 'addon-lower-shelf';
const DEFAULT_LEG_ID = 'leg-sample-04';
const EDGE_CORNER_ADDONS = [
  'addon-live-edge',
  'addon-waterfall-single',
  'addon-waterfall-second',
  'addon-chamfered-edges',
  'addon-squoval',
  'addon-rounded-corners',
  'addon-angled-corners'
];

function isLowerShelfAddonContextValid(appState) {
  const modelId = appState && appState.selections && appState.selections.model;
  const legId = appState && appState.selections && appState.selections.options && appState.selections.options.legs;
  return isLowerShelfCompatibleContext({ modelId, legId });
}

function stripInvalidLowerShelfAddon(appState) {
  const addons = appState && appState.selections && appState.selections.options && Array.isArray(appState.selections.options.addon)
    ? appState.selections.options.addon
    : [];
  if (!addons.includes(LOWER_SHELF_ADDON_ID)) return false;
  if (isLowerShelfAddonContextValid(appState)) return false;
  const nextAddons = addons.filter(id => id !== LOWER_SHELF_ADDON_ID);
  setState({
    selections: {
      ...state.selections,
      options: {
        ...state.selections.options,
        addon: nextAddons
      }
    }
  });
  return true;
}

function updateLowerShelfAddonAvailability(appState) {
  const root = document.getElementById('addons-options');
  if (!root) return;
  const checkbox = root.querySelector(`.addons-dropdown-option-checkbox[data-addon-id="${LOWER_SHELF_ADDON_ID}"]`);
  const option = root.querySelector(`.addons-dropdown-option[data-addon-id="${LOWER_SHELF_ADDON_ID}"]`);
  if (!checkbox || !option) return;
  const disabledBy = checkbox.getAttribute('data-disabled-by') || '';
  const shouldDisable = !isLowerShelfAddonContextValid(appState);
  const lowerShelfTooltip = getLowerShelfCompatibilityTooltip();

  if (shouldDisable) {
    checkbox.disabled = true;
    checkbox.checked = false;
    checkbox.setAttribute('data-disabled-by', 'lower-shelf');
    checkbox.setAttribute('data-tooltip', lowerShelfTooltip);
    option.classList.add('disabled');
    option.classList.remove('selected');
    option.setAttribute('aria-disabled', 'true');
    option.setAttribute('data-disabled-by', 'lower-shelf');
    option.setAttribute('data-tooltip', lowerShelfTooltip);
  } else if (disabledBy === 'lower-shelf') {
    checkbox.disabled = false;
    checkbox.removeAttribute('data-disabled-by');
    if (checkbox.getAttribute('data-tooltip') === lowerShelfTooltip) {
      checkbox.removeAttribute('data-tooltip');
    }
    option.classList.remove('disabled');
    option.removeAttribute('aria-disabled');
    if (option.getAttribute('data-disabled-by') === 'lower-shelf') {
      option.removeAttribute('data-disabled-by');
    }
    if (option.getAttribute('data-tooltip') === lowerShelfTooltip) {
      option.removeAttribute('data-tooltip');
    }
  }

  updateAllIndicators();
}
const EDGE_PROFILE_TOOLTIP = 'Not compatible with selected edge profile';

function setAddonTileDisabled(tile, shouldDisable, tooltip = '', disabledBy = '') {
  if (!tile) return;
  tile.disabled = shouldDisable;
  tile.classList.toggle('disabled', shouldDisable);
  if (shouldDisable) {
    tile.setAttribute('aria-disabled', 'true');
    tile.setAttribute('aria-pressed', 'false');
    tile.classList.remove('selected');
    if (tooltip) tile.setAttribute('data-tooltip', tooltip);
    if (disabledBy) tile.setAttribute('data-disabled-by', disabledBy);
    return;
  }
  tile.removeAttribute('aria-disabled');
  tile.removeAttribute('data-disabled-by');
  tile.removeAttribute('data-tooltip');
}

function areEdgeProfilesCompatible(firstAddonId, secondAddonId) {
  if (!firstAddonId || !secondAddonId || firstAddonId === secondAddonId) return true;
  return EDGE_PROFILE_COMPATIBLE_PAIRS.has(`${firstAddonId}:${secondAddonId}`);
}

function getEdgeProfileBaseIncompatibility(addonId, currentDesign, currentAddons) {
  if (addonId === 'addon-rounded-corners') {
    const incompatible = currentDesign === 'des-cookie' || currentDesign === 'des-round';
    return { incompatible, tooltip: incompatible ? 'Not compatible with Cookie or Round designs' : '' };
  }
  if (addonId === 'addon-angled-corners') {
    const incompatible = currentDesign === 'des-cookie' || currentDesign === 'des-round';
    return { incompatible, tooltip: incompatible ? 'Not compatible with Cookie or Round designs' : '' };
  }
  if (addonId === 'addon-chamfered-edges') {
    const incompatible = currentDesign === 'des-cookie' || currentDesign === 'des-round' || currentAddons.includes('addon-live-edge');
    return { incompatible, tooltip: incompatible ? 'Not compatible with Cookie or Round designs or Live Edge' : '' };
  }
  if (addonId === 'addon-squoval') {
    const hasWaterfall = currentAddons.includes('addon-waterfall-single') || currentAddons.includes('addon-waterfall-second');
    const incompatible = currentAddons.includes('addon-live-edge') || hasWaterfall;
    return { incompatible, tooltip: incompatible ? 'Not compatible with Live Edge or Waterfall Edge' : '' };
  }
  return { incompatible: false, tooltip: '' };
}

function updateEdgeProfileAddonAvailability(appState = state) {
  const root = document.getElementById('addons-options');
  if (!root) return;
  const addons = appState && appState.selections && appState.selections.options
    ? appState.selections.options.addon
    : [];
  const currentAddons = Array.isArray(addons) ? addons : [];
  const currentDesign = appState && appState.selections ? appState.selections.design : null;
  const selectedEdges = EDGE_PROFILE_ADDONS.filter(id => currentAddons.includes(id));

  EDGE_PROFILE_ADDONS.forEach((addonId) => {
    const checkbox = root.querySelector(`.addons-dropdown-option-checkbox[data-addon-id="${addonId}"]`);
    const option = root.querySelector(`.addons-dropdown-option[data-addon-id="${addonId}"]`);
    const tile = root.querySelector(`.addons-tile[data-addon-id="${addonId}"]`);
    if ((!checkbox || !option) && !tile) return;

    const base = getEdgeProfileBaseIncompatibility(addonId, currentDesign, currentAddons);
    const disableBySelection = selectedEdges.some((selectedAddonId) => (
      selectedAddonId !== addonId && !areEdgeProfilesCompatible(addonId, selectedAddonId)
    ));
    const shouldDisable = base.incompatible || disableBySelection;
    const tooltip = base.incompatible ? base.tooltip : EDGE_PROFILE_TOOLTIP;

    if (shouldDisable) {
      if (checkbox && option) {
        checkbox.disabled = true;
        if (disableBySelection) {
          checkbox.checked = false;
        }
        if (tooltip) {
          checkbox.setAttribute('data-tooltip', tooltip);
          option.setAttribute('data-tooltip', tooltip);
        }
        if (disableBySelection) {
          checkbox.setAttribute('data-disabled-by', 'edge-profile');
          option.setAttribute('data-disabled-by', 'edge-profile');
        }
        option.classList.add('disabled');
        option.classList.remove('selected');
        option.setAttribute('aria-disabled', 'true');
      }
      setAddonTileDisabled(tile, true, tooltip, disableBySelection ? 'edge-profile' : '');
      return;
    }

    const disabledBy = checkbox ? checkbox.getAttribute('data-disabled-by') || '' : '';
    if (checkbox && option && disabledBy === 'edge-profile') {
      checkbox.disabled = false;
      checkbox.removeAttribute('data-disabled-by');
      if (checkbox.getAttribute('data-tooltip') === EDGE_PROFILE_TOOLTIP) {
        checkbox.removeAttribute('data-tooltip');
      }
      option.classList.remove('disabled');
      option.removeAttribute('aria-disabled');
      if (option.getAttribute('data-disabled-by') === 'edge-profile') {
        option.removeAttribute('data-disabled-by');
      }
      if (option.getAttribute('data-tooltip') === EDGE_PROFILE_TOOLTIP) {
        option.removeAttribute('data-tooltip');
      }
    }
    if (tile) {
      setAddonTileDisabled(tile, false, tooltip, 'edge-profile');
    }
  });

  updateAllIndicators();
}

/**
 * Update legs and tube size options based on selected model and design
 * Filters legs to only show those compatible with the model and design
 * Filters tube sizes to only show those used by visible legs and compatible with model
 */
async function updateLegsOptionsForModel(modelId, allLegs, allTubeSizes, designId = null) {
  if (!modelId) return;

  const { renderOptionCards } = await import('./stageRenderer.js');
  const legMultiplier = getLegPriceMultiplier(state);

  // Filter legs: only show designs compatible with this model and design (and not hidden)
  const visibleLegs = getVisibleLegs(modelId, allLegs, designId);
  const pricedLegs = applyLegPriceMultiplier(visibleLegs, legMultiplier);

  // Render filtered legs
  const legsRoot = document.getElementById('legs-options');
  if (legsRoot) {
    renderOptionCards(legsRoot, pricedLegs, { category: 'legs' });
    const selectedLegId = state.selections && state.selections.options && state.selections.options.legs;
    if (selectedLegId) {
      const selectedLegCard = legsRoot.querySelector(`.option-card[data-id="${selectedLegId}"]`);
      if (selectedLegCard) selectedLegCard.setAttribute('aria-pressed', 'true');
    }
  }

  // Filter tube sizes: only show if at least one visible leg uses it AND it's compatible with the model
  const availableTubeSizes = getAvailableTubeSizes(modelId, visibleLegs, allTubeSizes);

  // Render filtered tube sizes
  const tubeSizesRoot = document.getElementById('tube-size-options');
  if (tubeSizesRoot) {
    renderOptionCards(tubeSizesRoot, availableTubeSizes, { category: 'tube-size', showPrice: false });
    const selectedTubeId = state.selections && state.selections.options && state.selections.options['tube-size'];
    if (selectedTubeId) {
      const selectedTubeCard = tubeSizesRoot.querySelector(`.option-card[data-id="${selectedTubeId}"]`);
      if (selectedTubeCard) selectedTubeCard.setAttribute('aria-pressed', 'true');
    }
  }

  // Recompute tube size constraints based on current leg selection
  try {
    recomputeTubeSizeConstraints();
  } catch (e) {
    log.warn('Failed to recompute constraints', e);
  }
  updateLegPricingUI(state, allLegs);
  const selectedLegId = state.selections && state.selections.options && state.selections.options.legs;
  updateLegsUIVisibility(selectedLegId || '');
}

// Listen for placeholder selection events dispatched by placeholders.js and stage modules
document.addEventListener('option-selected', async (ev) => {
  const { id, category, price } = ev.detail || { id: null, category: null, price: 0 };
  log.debug('option-selected event', { id, category, price, selections: state.selections });
  
  // Ignore events with null or undefined category (malformed events)
  if (!category) {
    log.warn('Ignoring malformed option-selected event with null/undefined category');
    return;
  }
  
  // Handle model selection (category: 'model')
  if (category === 'model') {
    const stageManager = window.stageManager || null;
    const originStage = stageManager && stageManager.getCurrentStage ? stageManager.getCurrentStage() : null;
    const allLegs = window._allLegsData || [];
    const nextOptions = normalizeLegSelection(id, null, {}, allLegs);
    // When model changes, clear ALL selections (design and all options)
    setState({ 
      selections: { 
        model: id, 
        design: null, 
        options: nextOptions,
        dimensionsDetail: null
      }, 
      pricing: { base: 0, extras: 0, total: 0 } 
    });
    
    // Clear visual state for design tiles
    document.querySelectorAll('.option-card[data-id^="des-"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    
    // Clear visual state for all option cards to reset UI
    document.querySelectorAll('.option-card[data-category]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 420, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, base: p.base, extras: p.extras, total: p.total } });

    // Update legs and tube size options based on the selected model
    try {
      const allTubeSizes = window._allTubeSizesData || [];
      if (allLegs.length > 0 && allTubeSizes.length > 0) {
        updateLegsOptionsForModel(id, allLegs, allTubeSizes);
      }
    } catch (e) {
      log.warn('Failed to update legs options', e);
    }

    try {
      const addonsRoot = document.getElementById('addons-options');
      if (addonsRoot) {
        const { loadData } = await import('./dataLoader.js');
        const { renderAddonsDropdown } = await import('./stageRenderer.js');
        const addons = await loadData('data/addons.json');
        if (addons) renderAddonsDropdown(addonsRoot, addons, state);
        updateEdgeAddonCompatibility(state);
        updateWaterfallAddonAvailability(state);
        updateLowerShelfAddonAvailability(state);
      }
    } catch (e) {
      log.warn('Failed to update addons after model change', e);
    }

    // Re-render design layouts and presets filtered by the selected model
    await renderDesignOptionsForModel(id);

    // If user selected a model from a stage beyond Designs, navigate back to Models stage
    try {
      if (stageManager && typeof stageManager.setStage === 'function' && originStage !== null && originStage > 1) {
        log.debug('Model selected from stage, navigating to stage 0', { originStage });
        await stageManager.setStage(0, { skipConfirm: true });
      }
    } catch (e) {
      log.warn('Failed to navigate back to Models stage', e);
    }
  }
  // Handle design selection (category: 'design')
  else if (category === 'design') {
    if (ev.detail && ev.detail.presetId) {
      await applyDesignPreset(ev.detail.presetId, id);
      return;
    }

    // Check if addons need to be disabled due to design incompatibility
    const existingAddons = state.selections.options.addon || [];
    const nextAddonsSet = new Set(Array.isArray(existingAddons) ? existingAddons : []);
    if (id === 'des-slab') {
      nextAddonsSet.add('addon-live-edge');
    }
    if (id === 'des-round') {
      EDGE_CORNER_ADDONS.forEach(addonId => nextAddonsSet.delete(addonId));
    }
    if (id === 'des-signature') {
      EDGE_CORNER_ADDONS.forEach(addonId => {
        if (addonId !== 'addon-live-edge') nextAddonsSet.delete(addonId);
      });
    }
    if (nextAddonsSet.has('addon-live-edge') || nextAddonsSet.has('addon-waterfall-single') || nextAddonsSet.has('addon-waterfall-second')) {
      nextAddonsSet.delete('addon-squoval');
    }
    const currentAddons = Array.from(nextAddonsSet);
    // (Addons will be shown as disabled in the UI based on stageRenderer incompatibility checks)

    const nextOptions = normalizeLegSelection(
      state.selections.model,
      id,
      { ...state.selections.options, addon: currentAddons },
      window._allLegsData || []
    );
    if (!isLowerShelfCompatibleContext({ modelId: state.selections.model, legId: nextOptions.legs })) {
      nextOptions.addon = currentAddons.filter((addonId) => addonId !== LOWER_SHELF_ADDON_ID);
    }
    if (id === 'des-signature') {
      nextOptions['tube-size'] = undefined;
    }
    setState({
      selections: {
        ...state.selections,
        design: id,
        options: nextOptions
      }
    });
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, base: p.base, extras: p.extras, total: p.total } });

    // Update legs options based on the selected design
    try {
      const allLegs = window._allLegsData || [];
      const allTubeSizes = window._allTubeSizesData || [];
      if (allLegs.length > 0 && allTubeSizes.length > 0) {
        updateLegsOptionsForModel(state.selections.model, allLegs, allTubeSizes, id);
      }
    } catch (e) {
      log.warn('Failed to update legs options after design change', e);
    }

    // Update addon compatibility based on the selected design
    try {
      const addonsRoot = document.getElementById('addons-options');
      if (addonsRoot) {
        const { loadData } = await import('./dataLoader.js');
        const { renderAddonsDropdown } = await import('./stageRenderer.js');
        const addons = await loadData('data/addons.json');
      if (addons) renderAddonsDropdown(addonsRoot, addons, state);
        updateEdgeAddonCompatibility(state);
        updateWaterfallAddonAvailability(state);
        updateLowerShelfAddonAvailability(state);
      }
    } catch (e) {
      log.warn('Failed to update addon compatibility after design change', e);
    }

    // Update materials based on the selected design
    try {
      const materialsOptionsRoot = document.getElementById('materials-options');
      if (materialsOptionsRoot) {
        const { loadData } = await import('./dataLoader.js');
        const { renderOptionCards } = await import('./stageRenderer.js');
        const mats = await loadData('data/materials.json');
        if (mats) {
          const filteredMaterials = filterMaterialsByDesign(mats, id);
          renderOptionCards(materialsOptionsRoot, filteredMaterials, { category: 'material' });
        }
      }
    } catch (e) {
      log.warn('Failed to update materials after design change', e);
    }
  }
  // Handle other category selections (material, finish, legs, color, etc.)
  else if (category === 'dimensions') {
    const newOptions = { ...state.selections.options, [category]: id };
    const nextSelections = { ...state.selections, options: newOptions };
    if (ev.detail && ev.detail.payload) nextSelections.dimensionsDetail = ev.detail.payload;
    else nextSelections.dimensionsDetail = null;
    setState({ selections: nextSelections });
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
    updateLegPricingUI(state);
    try {
      recomputeTubeSizeConstraints(state);
    } catch (e) {
      log.warn('Failed to recompute tube size constraints after dimensions update', e);
    }
  }
  else if (category) {
    const newOptions = { ...state.selections.options, [category]: id };
    // update selections first and then recompute price via computePrice
    setState({ selections: { ...state.selections, options: newOptions } });
    if (category === 'legs') {
      stripInvalidLowerShelfAddon(state);
      updateLowerShelfAddonAvailability(state);
    }
    const p = await computePrice(state);
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
  }
});

document.addEventListener('custom-color-note-updated', (ev) => {
  const value = ev.detail && typeof ev.detail.value === 'string' ? ev.detail.value : '';
  setState({
    selections: {
      ...state.selections,
      options: {
        ...state.selections.options,
        customColorNote: value
      }
    }
  });
});

document.addEventListener('custom-color-gradient-note-updated', (ev) => {
  const value = ev.detail && typeof ev.detail.value === 'string' ? ev.detail.value : '';
  setState({
    selections: {
      ...state.selections,
      options: {
        ...state.selections.options,
        customColorGradientNote: value
      }
    }
  });
});

// Handle "none" leg selection - clear dependent selections without dispatching events with null ids
document.addEventListener('legs-none-selected', async (ev) => {
  try {
    // Clear tube-size and leg-finish selections without triggering price recomputation loops
    setState({ selections: { ...state.selections, options: { ...state.selections.options, 'tube-size': undefined, 'leg-finish': undefined } } });
    const p = await computePrice(state);
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
  } catch (e) {
    log.warn('Failed to handle legs-none-selected', e);
  }
});

// Handle tube size cleared due to incompatibility with newly selected leg
document.addEventListener('tube-size-cleared-due-to-incompatibility', async (ev) => {
  try {
    // Clear the tube-size selection from state and recompute price
    setState({ selections: { ...state.selections, options: { ...state.selections.options, 'tube-size': undefined } } });
    const p = await computePrice(state);
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
  } catch (e) {
    log.warn('Failed to handle tube-size-cleared-due-to-incompatibility', e);
  }
});

// Handle tube size deselected (when optional and clicked again)
document.addEventListener('tube-size-deselected', async (ev) => {
  try {
    // Clear the tube-size selection from state and recompute price
    setState({ selections: { ...state.selections, options: { ...state.selections.options, 'tube-size': undefined } } });
    const p = await computePrice(state);
    setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
    const from = state.pricing.total || state.pricing.base;
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
  } catch (e) {
    log.warn('Failed to handle tube-size-deselected', e);
  }
});

// Handle addon toggles (multi-select). Expect detail: { id, price, checked }
document.addEventListener('addon-toggled', async (ev) => {
  const { id, price, checked } = ev.detail || { id: null, price: 0, checked: false };
  addonsLog.debug('addon-toggled event', { id, price, checked });
  const selectedAddons = new Set((state.selections.options.addon && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : []);
  if (checked) selectedAddons.add(id);
  else selectedAddons.delete(id);
  if (checked && EDGE_PROFILE_ADDONS.includes(id)) {
    EDGE_PROFILE_ADDONS.forEach((addonId) => {
      if (addonId !== id && !areEdgeProfilesCompatible(id, addonId)) selectedAddons.delete(addonId);
    });
  }
  if (checked && id === 'addon-squoval') {
    selectedAddons.delete('addon-live-edge');
    selectedAddons.delete('addon-waterfall-single');
    selectedAddons.delete('addon-waterfall-second');
    selectedAddons.delete('addon-waterfall-art');
  }
  if (checked && (id === 'addon-live-edge' || id === 'addon-waterfall-single' || id === 'addon-waterfall-second')) {
    selectedAddons.delete('addon-squoval');
  }
  if (id === 'addon-waterfall-single' && !checked) {
    selectedAddons.delete('addon-waterfall-second');
    selectedAddons.delete('addon-waterfall-art');
  }
  const addonsArray = Array.from(selectedAddons);
  // persist selections then compute price via pricing module
  setState({ selections: { ...state.selections, options: { ...state.selections.options, addon: addonsArray } } });
  updateEdgeProfileAddonAvailability(state);
  updateEdgeAddonCompatibility(state);
  const p = await computePrice(state);
  setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
  const from = state.pricing.total || state.pricing.base;
  animatePrice(from, p.total, 320, (val) => updatePriceUI(val));
  updateLegPricingUI(state);
  updateWaterfallAddonAvailability(state);
});

// Handle addon selections (single-select per group). Expect detail: { group, id, price }
document.addEventListener('addon-selected', async (ev) => {
  const { group, id, price } = ev.detail || { group: null, id: null, price: 0 };
  addonsLog.debug('addon-selected event', { group, id, price });
  if (!group) return;
  const selectedAddons = new Set((state.selections.options.addon && Array.isArray(state.selections.options.addon)) ? state.selections.options.addon : []);
  // Remove any previous selection in this group
  // Assuming group is like "Power Strips", and ids are like "addon-power-none"
  const groupPrefix = group.toLowerCase().replace(/\s+/g, '-');
  selectedAddons.forEach(addonId => {
    if (addonId.startsWith(`addon-${groupPrefix}`)) {
      selectedAddons.delete(addonId);
    }
  });
  // Add the new selection if not "none"
  if (id && !id.includes('-none')) {
    selectedAddons.add(id);
  }
  const addonsArray = Array.from(selectedAddons);
  setState({ selections: { ...state.selections, options: { ...state.selections.options, addon: addonsArray } } });
  const p = await computePrice(state);
  setState({ pricing: { ...state.pricing, extras: p.extras, total: p.total } });
  const from = state.pricing.total || state.pricing.base;
  animatePrice(from, p.total, 320, (val) => updatePriceUI(val));
  updateLegPricingUI(state);
  updateWaterfallAddonAvailability(state);
});

// Handle tech cable length changes
document.addEventListener('tech-cable-length-changed', (ev) => {
  const { cableLength } = ev.detail || { cableLength: null };
  addonsLog.debug('tech-cable-length-changed event', { cableLength });
  setState({ selections: { ...state.selections, techCableLength: cableLength } });
});

// Request-based restart: stage modules should dispatch 'request-restart' and
// main.js (the canonical mutator) will reset the shared state and navigate to
// the first stage.
document.addEventListener('request-restart', (ev) => {
  try {
    const from = state.pricing.total || state.pricing.base || 0;
    setState({ selections: { model: null, design: null, options: {}, dimensionsDetail: null, techCableLength: null }, pricing: { base: 0, extras: 0, total: 0 } });
    animatePrice(from, 0, 320, (val) => updatePriceUI(val));
    const stageManager = window.stageManager || null;
    if (stageManager && typeof stageManager.setStage === 'function') {
      stageManager.setStage(0);
    } else {
      const ev2 = new CustomEvent('request-stage-change', { detail: { index: 0 } });
      document.dispatchEvent(ev2);
    }
  } catch (e) { /* ignore */ }
});

// Allow non-selection state mutations (e.g., stage manager clears) to refresh pricing with animation.
document.addEventListener('request-price-refresh', async (ev) => {
  try {
    const from = state.pricing.total || state.pricing.base || 0;
    const p = await computePrice(state);
    animatePrice(from, p.total, 300, (val) => updatePriceUI(val));
    setState({ pricing: { ...state.pricing, base: p.base, extras: p.extras, total: p.total } });
  } catch (e) {
    log.warn('Failed to refresh price', e);
  }
});

// Handle stage change requests from UI modules (e.g., Apply & Next buttons)
document.addEventListener('request-stage-change', (ev) => {
  try {
    const stageManager = window.stageManager || null;
    if (!stageManager) return;
    const { direction, index } = ev.detail || {};
    if (typeof index === 'number') {
      stageManager.setStage(index, { allowSkip: true });
    } else if (direction === 'next') {
      stageManager.nextStage && stageManager.nextStage();
    } else if (direction === 'prev') {
      stageManager.prevStage && stageManager.prevStage();
    }
  } catch (e) { /* ignore */ }
});

// initialize displayed price
document.addEventListener('DOMContentLoaded', () => updatePriceUI(state.pricing.total));

// Initialize the application by loading components
document.addEventListener('DOMContentLoaded', async () => {
  // Load main layout components
  await loadComponent('app-header', 'components/Header.html');
  await loadComponent('app-main', 'pages/MainContent.html');
  await loadComponent('app-sidebar', 'components/Sidebar.html');
  // ModelSelection is loaded lazily into the main stage-panel by the stage manager when
  // the Select Model stage becomes active. Do not preload it into the sidebar.
  await loadComponent('app-footer', 'components/Footer.html');
  initFooterLayoutVars();
  initThemeToggle();
  initFooterLiquidGlass();
  initStageSubsectionDropdowns(document);

  // Initialize viewer and controls after MainContent is loaded
  await initViewer();
  initViewerControls();
  resizeViewer(); // Ensure viewer is sized correctly on load

  // Compute and set accurate header height so main content doesn't tuck under it
  const setHeaderVars = () => {
    try {
      const header = document.getElementById('app-header');
      if (!header) return;
      const h = header.offsetHeight || 0;
      document.documentElement.style.setProperty('--header-height', `${h}px`);
      // stage bar lives inside header, so avoid double-subtracting
      document.documentElement.style.setProperty('--stage-bar-height', `0px`);
      const stepper = document.getElementById('top-stepper');
      if (stepper) {
        const styles = window.getComputedStyle(stepper);
        const marginBottom = parseFloat(styles.marginBottom || '0') || 0;
        const navOffset = stepper.getBoundingClientRect().bottom + marginBottom;
        document.documentElement.style.setProperty('--nav-offset', `${Math.round(navOffset)}px`);
      } else {
        document.documentElement.style.setProperty('--nav-offset', `${h}px`);
      }
    } catch (e) {
      // ignore
    }
  };
  setHeaderVars();
  window.addEventListener('resize', setHeaderVars);
  window.addEventListener('resize', syncFooterLayoutVars, { passive: true });

  // Load icons after all components are in the DOM
  const iconPlaceholders = document.querySelectorAll('.icon-placeholder[data-icon]');
  iconPlaceholders.forEach(async (element) => {
    const iconName = element.getAttribute('data-icon');
    const iconTitle = element.getAttribute('data-icon-title') || '';
    await loadIcon(element, iconName, iconTitle);
  });

  // Initialize summary tooltip (after footer/header components exist)
  try {
    const { initSummaryTooltip } = await import('./ui/summaryTooltip.js');
    const sb = document.getElementById('summary-btn');
    if (sb) initSummaryTooltip(sb);
  } catch (e) {
    log.warn('Failed to initialize summary tooltip', e);
  }

  try {
    const { initMaterialsHelpPopover } = await import('./ui/materialsHelpPopover.js');
    const materialsHelpTrigger = document.getElementById('materials-help-trigger');
    if (materialsHelpTrigger) initMaterialsHelpPopover(materialsHelpTrigger);
  } catch (e) {
    log.warn('Failed to initialize materials help popover', e);
  }

  // Render model and materials option cards from data files (if placeholders exist)
  try {
    const { loadData } = await import('./dataLoader.js');
    const { renderOptionCards, renderAddonsDropdown, initOptionCardInfoDialogs } = await import('./stageRenderer.js');
    initOptionCardInfoDialogs(document.body);
    const modelsRoot = document.getElementById('stage-0-placeholder');
    if (modelsRoot) {
      const models = await loadData('data/models.json');
      // The ModelSelection component expects a deeper container; try to find model-row-grid(s)
      const modelGrids = document.querySelectorAll('.model-row-grid');
      if (modelGrids && modelGrids.length && models) {
        // distribute models across the first grid for simplicity
        renderOptionCards(modelGrids[0], models, { category: null, showPrice: false });
      }
    }

    const materialsOptionsRoot = document.getElementById('materials-options');
    if (materialsOptionsRoot) {
      const mats = await loadData('data/materials.json');
      if (mats) {
        // Filter materials based on currently selected design
        const currentDesign = state.selections && state.selections.design;
        const filteredMaterials = filterMaterialsByDesign(mats, currentDesign);
        renderOptionCards(materialsOptionsRoot, filteredMaterials, { category: 'material' });
      }
    }

    // Render color swatches for the Materials stage from data/colors.json
    const colorOptionsRoot = document.getElementById('color-options');
    if (colorOptionsRoot) {
      const colors = await loadData('data/colors.json');
      if (colors) renderOptionCards(colorOptionsRoot, colors, { category: 'color' });
    }

    const colorGradientOptionsRoot = document.getElementById('color-gradient-options');
    if (colorGradientOptionsRoot) {
      const colorGradients = await loadData('data/color-gradients.json');
      if (colorGradients) renderOptionCards(colorGradientOptionsRoot, colorGradients, { category: 'color-gradient' });
    }

    // Render designs stage with presets + layouts filtered by selected model
    await renderDesignOptionsForModel(state.selections && state.selections.model);

    // Render finish stage (coatings + sheens + tints)
    const finishCoatingRoot = document.getElementById('finish-coating-options');
    const finishSheenRoot = document.getElementById('finish-sheen-slider');
    const finishTintRoot = document.getElementById('finish-tint-options');
    if (finishCoatingRoot || finishSheenRoot || finishTintRoot) {
  const finish = await loadData('data/finish.json');
      if (finish) {
        if (finish.coatings && finishCoatingRoot) renderOptionCards(finishCoatingRoot, finish.coatings, { category: 'finish-coating' });
        if (finish.sheens && finishSheenRoot) {
          const { renderSheenSlider } = await import('./stageRenderer.js');
          renderSheenSlider(finishSheenRoot, finish.sheens);
        }
        if (finish.tints && finishTintRoot) renderOptionCards(finishTintRoot, finish.tints, { category: 'finish-tint' });
      }
    }

    // Render dimensions, legs, addons
    // Note: Dimensions stage uses a custom UI panel (DimensionsPanel.html) instead of option cards,
    // so we skip rendering here. The dimensions panel is loaded dynamically by stageManager.
    
    // Load and store legs and tube sizes data for filtering
    let allLegs = [];
    let allTubeSizes = [];
    
    const legsRoot = document.getElementById('legs-options');
    if (legsRoot) {
  allLegs = await loadData('data/legs.json');
      if (allLegs) {
        const legMultiplier = getLegPriceMultiplier(state);
        const pricedLegs = applyLegPriceMultiplier(allLegs, legMultiplier);
        renderOptionCards(legsRoot, pricedLegs, { category: 'legs' });
      }
    }

    const tubeSizesRoot = document.getElementById('tube-size-options');
    if (tubeSizesRoot) {
  allTubeSizes = await loadData('data/tube-sizes.json');
      if (allTubeSizes) renderOptionCards(tubeSizesRoot, allTubeSizes, { category: 'tube-size', showPrice: false });
    }
    
    // Store for use in model-change filtering
    window._allLegsData = allLegs;
    window._allTubeSizesData = allTubeSizes;
    updateLegPricingUI(state, allLegs);

    const legFinishRoot = document.getElementById('leg-finish-options');
    if (legFinishRoot) {
  const legFinish = await loadData('data/leg-finish.json');
      if (legFinish) renderOptionCards(legFinishRoot, legFinish, { category: 'leg-finish' });
    }

    const addonsRoot = document.getElementById('addons-options');
    if (addonsRoot) {
  const addons = await loadData('data/addons.json');
      if (addons) renderAddonsDropdown(addonsRoot, addons, state);
      updateEdgeAddonCompatibility(state);
      updateWaterfallAddonAvailability(state);
      updateLowerShelfAddonAvailability(state);
    }
  } catch (e) {
    log.warn('Failed to render stage data from JSON files', e);
  }

  // Initial state update to render the first stage (use setState to dispatch standardized event)
  setState({});

  // Initialize stage manager after header/sidebar components exist
  try {
    const { default: stageManager } = await import('./stageManager.js');
    stageManager.initStageManager();
  // expose for other modules (summary/restart) to programmatically change stage
  window.stageManager = stageManager;
    log.info('Stage manager initialized from main.js');
    // header height may change when stage changes sticky/static; recalc on next frame
    setTimeout(setHeaderVars, 0);
  } catch (err) {
    log.warn('Failed to initialize stage manager from main.js', err);
  }

  // If we loaded the Summary page markup, populate its panel now
  try {
    const hasSummary = document.getElementById('summary-panel');
    if (hasSummary) populateSummaryPanel();
  } catch (e) { /* ignore */ }

  // Initialize summary action handlers (capture/export/restart) if present
  try {
    const { initSummaryActions } = await import('./stages/summary.js');
    if (document.getElementById('summary-panel')) initSummaryActions();
  } catch (e) { /* ignore */ }

  // Initialize placeholder interactions (generic click handlers and compatibility helpers)
  try { initPlaceholderInteractions(); } catch (e) { log.warn('Failed to init placeholder interactions', e); }

  const loadingScreen = document.getElementById('app-loading');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    loadingScreen.setAttribute('aria-hidden', 'true');
  }

  // Set up beforeunload warning for unsaved customizations
  window.addEventListener('beforeunload', (event) => {
    const { selections } = state;
    // Check if user has made any customizations beyond the initial empty state
    const hasCustomizations = selections.model || selections.design || 
                              Object.keys(selections.options || {}).length > 0 ||
                              selections.dimensionsDetail;
    if (hasCustomizations) {
      // Set returnValue to trigger browser warning dialog
      event.returnValue = '';
      event.preventDefault();
      return '';
    }
  });

  // Log successful app load with timestamp
console.log('%c✓ WoodLab Configurator loaded successfully', 'color: #10b981; font-weight: bold; font-size: 12px;');
console.log('Last updated: 2026-02-06 13:27');
console.log('App ver: 1.0.3');
console.log('Edit ver: 721');
  console.log('Config export: run exportConfig() in the console to print JSON for copy/paste.');
});
