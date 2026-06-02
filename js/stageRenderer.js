import { showOptionCardInfoDialog } from './ui/optionCardInfoDialog.js';
import { scrollElementToTop } from './ui/scrollAlignment.js';
import { DEBUG_MODE_CHANGED_EVENT, isDebugModeEnabled } from './debugMode.js';
import {
  getLowerShelfCompatibilityTooltip,
  isLowerShelfCompatibleContext,
  isLowerShelfCompatibleModel
} from './legGeometry.js';

// Renders option-card buttons from a data array into a container element.
// data: array of { id, title, price, image, description, disabled, disabledForTesting, tooltip }
// opts.showPrice: set false to hide price text for the rendered tiles
function isQuotedLabel(value) {
  return typeof value === 'string' && value.trim() && Number.isNaN(Number(value));
}

function formatPriceLabel(value, opts = {}) {
  if (isQuotedLabel(value)) return value.trim();
  const numeric = Number(value);
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  if (opts.isDesign) {
    return `Starting from: $${safeNumber.toLocaleString()}`;
  }
  return `+$${safeNumber.toLocaleString()}`;
}

let optionCardInfoObserver = null;
let testingDisabledObserver = null;
let testingDisabledSyncQueued = false;

const TESTING_DISABLED_TOOLTIP = 'Coming soon. Enable debug mode to test this option.';

function isTestingDisabledItem(item = {}) {
  return item
    && (item.disabledForTesting === true || item.testingDisabled === true || item.comingSoon === true);
}

function getTestingDisabledLabel(item = {}) {
  const label = item.testingDisabledLabel || item.comingSoonLabel || 'COMING SOON';
  return String(label || 'COMING SOON').trim() || 'COMING SOON';
}

function getTestingDisabledTooltip(item = {}) {
  return String(item.testingDisabledTooltip || item.tooltip || TESTING_DISABLED_TOOLTIP).trim() || TESTING_DISABLED_TOOLTIP;
}

function getDisabledByList(el) {
  const raw = el ? el.getAttribute('data-disabled-by') || '' : '';
  return raw ? raw.split('||').filter(Boolean) : [];
}

function hasHardDisabledState(el) {
  if (!el) return false;
  if (el.getAttribute('data-hard-disabled') === 'true') return true;
  return getDisabledByList(el).length > 0;
}

function setControlDisabled(el, disabled) {
  if (!el) return;
  if ('disabled' in el) {
    if (el.disabled !== disabled) el.disabled = disabled;
  }
  if (disabled) {
    if (!el.hasAttribute('disabled')) el.setAttribute('disabled', 'true');
    if (el.getAttribute('aria-disabled') !== 'true') el.setAttribute('aria-disabled', 'true');
    el.classList.add('disabled');
  } else {
    if (el.hasAttribute('disabled')) el.removeAttribute('disabled');
    if (el.hasAttribute('aria-disabled')) el.removeAttribute('aria-disabled');
    el.classList.remove('disabled');
  }
}

function setHardDisabled(el, tooltip = '') {
  if (!el) return;
  el.setAttribute('data-hard-disabled', 'true');
  setControlDisabled(el, true);
  if (tooltip) el.setAttribute('data-tooltip', tooltip);
}

function setSoftDisabled(el, tooltip = '', disabledBy = 'compatibility') {
  if (!el) return;
  setControlDisabled(el, true);
  if (disabledBy) el.setAttribute('data-disabled-by', disabledBy);
  if (tooltip) el.setAttribute('data-tooltip', tooltip);
}

function setTestingTooltip(el) {
  if (!el || el.getAttribute('data-testing-tooltip-active') === 'true') return;
  el.setAttribute('data-testing-original-tooltip', el.getAttribute('data-tooltip') || '');
  el.setAttribute('data-tooltip', el.getAttribute('data-testing-disabled-tooltip') || TESTING_DISABLED_TOOLTIP);
  el.setAttribute('data-testing-tooltip-active', 'true');
}

function restoreTestingTooltip(el) {
  if (!el || el.getAttribute('data-testing-tooltip-active') !== 'true') return;
  const originalTooltip = el.getAttribute('data-testing-original-tooltip') || '';
  const testingTooltip = el.getAttribute('data-testing-disabled-tooltip') || TESTING_DISABLED_TOOLTIP;
  const currentTooltip = el.getAttribute('data-tooltip') || '';
  if (currentTooltip === testingTooltip) {
    if (originalTooltip) el.setAttribute('data-tooltip', originalTooltip);
    else el.removeAttribute('data-tooltip');
  }
  el.removeAttribute('data-testing-original-tooltip');
  el.removeAttribute('data-testing-tooltip-active');
}

function ensureTestingDisabledOverlay(el, label) {
  if (!el) return;
  let overlay = el.querySelector(':scope > .option-testing-disabled-overlay');
  if (!overlay) {
    overlay = document.createElement('span');
    overlay.className = 'option-testing-disabled-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    el.appendChild(overlay);
  }
  overlay.textContent = label;
}

function syncTestingDisabledControl(el) {
  if (!el || el.getAttribute('data-testing-disabled') !== 'true') return;
  const unlocked = isDebugModeEnabled();
  const hasHardDisable = hasHardDisabledState(el);

  el.classList.toggle('is-testing-disabled-active', !unlocked);
  el.classList.toggle('is-testing-disabled-unlocked', unlocked);

  if (unlocked) {
    el.setAttribute('data-testing-disabled-active', 'false');
    restoreTestingTooltip(el);
    setControlDisabled(el, hasHardDisable);
    return;
  }

  el.setAttribute('data-testing-disabled-active', 'true');
  setControlDisabled(el, true);
  setTestingTooltip(el);
}

export function applyTestingDisabledState(el, item = {}, options = {}) {
  if (!el || !isTestingDisabledItem(item)) return;
  el.setAttribute('data-testing-disabled', 'true');
  el.setAttribute('data-testing-disabled-tooltip', getTestingDisabledTooltip(item));
  el.classList.add('is-testing-disabled');
  if (options.overlay !== false) {
    ensureTestingDisabledOverlay(el, getTestingDisabledLabel(item));
  }
  syncTestingDisabledControl(el);
}

function syncTestingDisabledControls(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-testing-disabled="true"]').forEach((el) => {
    syncTestingDisabledControl(el);
  });
}

function queueTestingDisabledSync(root = document) {
  if (testingDisabledSyncQueued) return;
  testingDisabledSyncQueued = true;
  const run = () => {
    testingDisabledSyncQueued = false;
    syncTestingDisabledControls(root);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else setTimeout(run, 0);
}

function initTestingDisabledSync() {
  if (typeof document === 'undefined') return;
  document.addEventListener(DEBUG_MODE_CHANGED_EVENT, () => syncTestingDisabledControls(document));
  if (typeof MutationObserver === 'undefined') return;

  const startObserver = () => {
    if (testingDisabledObserver || !document.body) return;
    testingDisabledObserver = new MutationObserver((mutations) => {
      const shouldSync = mutations.some((mutation) => (
        mutation.type === 'attributes'
        && mutation.target instanceof Element
        && mutation.target.getAttribute('data-testing-disabled') === 'true'
        && (mutation.attributeName === 'disabled' || mutation.attributeName === 'data-disabled-by' || mutation.attributeName === 'data-hard-disabled')
      ));
      if (shouldSync) queueTestingDisabledSync(document);
    });
    testingDisabledObserver.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['disabled', 'data-disabled-by', 'data-hard-disabled']
    });
  };

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
}

initTestingDisabledSync();

function isAddonTile(card) {
  if (!card) return false;
  if (card.getAttribute('data-category') === 'addon') return true;
  return !!card.closest('#addons-options, #stage-panel-6, .addons-dropdown-list, .addons-dropdown-tile, .addons-tiles-container');
}

function isExcludedStageTile(card) {
  if (!card) return false;
  return !!card.closest('#stage-panel-0, #stage-panel-1, #stage-panel-4, #models-stage-section, #designs-stage-section, #dimensions-stage-panel');
}

function isCustomInputTile(card) {
  if (!card) return false;
  if (card.hasAttribute('data-custom-note')) return true;
  if (card.getAttribute('data-preset-id') === 'custom') return true;
  if (card.getAttribute('data-height-id') === 'custom') return true;
  return !!card.querySelector('input, textarea, select');
}

function consumeEvent(ev) {
  ev.preventDefault();
  ev.stopPropagation();
}

function isActivationEvent(ev) {
  return ev.type === 'click' || (ev.type === 'keydown' && (ev.key === 'Enter' || ev.key === ' '));
}

function applyOptionCardInfoDialogTrigger(card) {
  if (!card || card.dataset.infoEnhanced === 'true') return;
  if (card.hasAttribute('disabled') || card.getAttribute('data-testing-disabled') === 'true') return;
  if (isAddonTile(card) || isExcludedStageTile(card) || isCustomInputTile(card)) return;

  const titleEl = card.querySelector('.title');
  const descriptionEl = card.querySelector('.description');
  const titleText = titleEl ? String(titleEl.textContent || '').trim() : '';
  const descriptionText = descriptionEl ? String(descriptionEl.textContent || '').trim() : '';
  if (!titleText || !descriptionText) return;

  const infoTrigger = document.createElement('span');
  infoTrigger.className = 'option-card-info-trigger';
  infoTrigger.setAttribute('role', 'button');
  infoTrigger.setAttribute('tabindex', '0');
  infoTrigger.setAttribute('aria-label', `Show details for ${titleText}`);
  infoTrigger.setAttribute('aria-expanded', 'false');
  infoTrigger.setAttribute('aria-haspopup', 'dialog');
  infoTrigger.textContent = 'ⓘ';
  card.dataset.infoTitle = titleText;
  card.dataset.infoDescription = descriptionText;
  descriptionEl.remove();
  card.appendChild(infoTrigger);
  card.classList.add('option-card-info-enabled');
  card.dataset.infoEnhanced = 'true';

  const openInfo = () => {
    showOptionCardInfoDialog({
      title: titleText,
      description: descriptionText,
      triggerEl: infoTrigger
    });
  };

  infoTrigger.addEventListener('click', (ev) => {
    if (!isActivationEvent(ev)) return;
    consumeEvent(ev);
    openInfo();
  });
  infoTrigger.addEventListener('keydown', (ev) => {
    if (!isActivationEvent(ev)) return;
    consumeEvent(ev);
    openInfo();
  });
}

export function enhanceOptionCardsWithInfo(root = document) {
  if (!root) return;
  if (root.matches && root.matches('.option-card')) {
    applyOptionCardInfoDialogTrigger(root);
  }
  const cards = root.querySelectorAll ? root.querySelectorAll('.option-card') : [];
  cards.forEach((card) => applyOptionCardInfoDialogTrigger(card));
}

export function initOptionCardInfoDialogs(root = document.body) {
  if (!root) return;
  enhanceOptionCardsWithInfo(root);
  if (optionCardInfoObserver || typeof MutationObserver === 'undefined') return;

  optionCardInfoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        enhanceOptionCardsWithInfo(node);
      });
    });
  });

  optionCardInfoObserver.observe(root, { childList: true, subtree: true });
}

export function renderOptionCards(container, data = [], opts = {}) {
  if (!container) return;
  const fragment = document.createDocumentFragment();
  data.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'option-card';
    btn.type = 'button';
    btn.setAttribute('data-id', item.id);
    if (opts.category) btn.setAttribute('data-category', opts.category);
    if (typeof item.price !== 'undefined') btn.setAttribute('data-price', String(item.price));
    if (item.customNote) btn.setAttribute('data-custom-note', 'true');
    if (item.previewType) btn.setAttribute('data-preview-type', String(item.previewType));
    if (opts.ignorePlaceholder) btn.setAttribute('data-ignore-placeholder', 'true');
    if (item.attributes && typeof item.attributes === 'object') {
      Object.entries(item.attributes).forEach(([name, value]) => {
        if (typeof name !== 'string' || !name || value === null || typeof value === 'undefined') return;
        btn.setAttribute(name, String(value));
      });
    }
    // Use aria-checked for multi-select (addon) category, aria-pressed for single-select
    const isMultiSelect = opts.category === 'addon';
    if (isMultiSelect) {
      btn.setAttribute('aria-checked', 'false');
    } else {
      btn.setAttribute('aria-pressed', 'false');
    }
    if (item.disabled) {
      setHardDisabled(btn, item.tooltip || '');
    }

    if (item.badge) {
      const badgeData = typeof item.badge === 'string' ? { label: item.badge } : item.badge;
      if (badgeData && badgeData.label) {
        const badge = document.createElement('span');
        badge.className = 'option-card-pill';
        if (badgeData.tone) badge.classList.add(`option-card-pill-${badgeData.tone}`);
        badge.textContent = badgeData.label;
        btn.appendChild(badge);
      }
    }

    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.alt || item.title || 'placeholder';
      img.className = 'viewer-placeholder-img';
      img.decoding = 'async';
      img.draggable = false;
      btn.appendChild(img);
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'title';
    titleDiv.textContent = item.title || item.id;
    btn.appendChild(titleDiv);

    if (opts.showPrice !== false) {
      const priceDiv = document.createElement('div');
      priceDiv.className = 'price-delta';
      const isDesign = item.id && item.id.startsWith('des-');
      priceDiv.textContent = formatPriceLabel(item.price, { isDesign });
      btn.appendChild(priceDiv);
    }

    if (item.description) {
      const d = document.createElement('div');
      d.className = 'description';
      d.textContent = item.description;
      btn.appendChild(d);
    }

    applyTestingDisabledState(btn, item);
    fragment.appendChild(btn);
  });
  container.replaceChildren(fragment);
  enhanceOptionCardsWithInfo(container);
}

const DEFAULT_ADDON_INTRO_IMAGE = 'assets/images/model1_placeholder.png';
const LOWER_SHELF_ADDON_ID = 'addon-lower-shelf';
const HIDDEN_ADDON_GROUP_TITLES = new Set(['expedited production', 'installation']);

function reorderAddonGroupsForModel(groups = [], modelId = '') {
  const visibleGroups = groups.filter(group => {
    const title = (group && group.title ? String(group.title) : '').trim().toLowerCase();
    return !HIDDEN_ADDON_GROUP_TITLES.has(title);
  });

  if (!modelId) return visibleGroups;

  const ordered = [...visibleGroups];
  const moveAfter = (titleToMove, afterTitle) => {
    const fromIndex = ordered.findIndex(group => group && group.title === titleToMove);
    const afterIndex = ordered.findIndex(group => group && group.title === afterTitle);
    if (fromIndex === -1 || afterIndex === -1 || fromIndex === afterIndex + 1) return;
    const [moved] = ordered.splice(fromIndex, 1);
    const targetAfterIndex = ordered.findIndex(group => group && group.title === afterTitle);
    ordered.splice(targetAfterIndex + 1, 0, moved);
  };

  const moveToIndex = (titleToMove, targetIndex) => {
    const fromIndex = ordered.findIndex(group => group && group.title === titleToMove);
    if (fromIndex === -1 || fromIndex === targetIndex) return;
    const [moved] = ordered.splice(fromIndex, 1);
    const clampedIndex = Math.max(0, Math.min(targetIndex, ordered.length));
    ordered.splice(clampedIndex, 0, moved);
  };

  if (modelId === 'mdl-conference') {
    moveAfter('Glass Top', 'Tech');
    moveAfter('Waterfall Edge', 'Glass Top');
  } else if (modelId === 'mdl-dining') {
    moveToIndex('Custom River Design', 1);
  }

  return ordered;
}

function buildAddonIntro(group = {}) {
  const introWrapper = document.createElement('div');
  const hasImage = Boolean(group.image);
  introWrapper.className = hasImage ? 'addons-dropdown-intro' : 'addons-dropdown-intro addons-dropdown-intro-no-image';

  if (hasImage) {
    const image = document.createElement('img');
    image.className = 'addons-dropdown-intro-image';
    image.src = group.image || DEFAULT_ADDON_INTRO_IMAGE;
    image.alt = group.title ? `Preview of ${group.title}` : 'Addon preview';
    image.draggable = false;
    introWrapper.appendChild(image);
  }

  const text = document.createElement('p');
  text.className = 'addons-dropdown-intro-text';
  const fallbackTitle = group.title ? group.title.toLowerCase() : 'add-on';
  text.textContent = group.description || `Choose the ${fallbackTitle} enhancements that best fit your space.`;
  introWrapper.appendChild(text);

  return introWrapper;
}

export function renderAddonsDropdown(container, data = [], currentState = {}) {
  if (!container) return;
  container.innerHTML = '';
  const currentDesign = currentState.selections && currentState.selections.design;
  const currentModel = currentState.selections && currentState.selections.model;
  const currentLeg = currentState.selections && currentState.selections.options && currentState.selections.options.legs;
  const edgeAddonIds = [
    'addon-live-edge',
    'addon-waterfall-single',
    'addon-waterfall-second',
    'addon-chamfered-edges',
    'addon-squoval',
    'addon-rounded-corners',
    'addon-angled-corners'
  ];
  const hiddenAddonIds = new Set();
  if (currentDesign === 'des-round') {
    edgeAddonIds.forEach(id => hiddenAddonIds.add(id));
  } else if (currentDesign === 'des-signature') {
    edgeAddonIds.forEach(id => {
      if (id !== 'addon-live-edge') hiddenAddonIds.add(id);
    });
  }

  const orderedGroups = reorderAddonGroupsForModel(Array.isArray(data) ? data : [], currentModel);

  orderedGroups.forEach(group => {
    const hasLowerShelfOption = Array.isArray(group.options) && group.options.some(option => option && option.id === LOWER_SHELF_ADDON_ID);
    if (hasLowerShelfOption && !isLowerShelfCompatibleModel(currentModel)) {
      return;
    }
    if (group.options && group.options.length && group.options.every(option => hiddenAddonIds.has(option.id))) {
      return;
    }
    const resolveTooltip = (option = {}, subsection = {}) => {
      return option.tooltip || subsection.tooltip || group.tooltip || '';
    };
    const tile = document.createElement('div');
    tile.className = 'addons-dropdown-tile';
    tile.setAttribute('data-id', group.title);

    // Header (clickable to expand/collapse)
    const header = document.createElement('button');
    header.className = 'addons-dropdown-header';
    header.setAttribute('aria-expanded', 'false');

    const headerMain = document.createElement('div');
    headerMain.className = 'addons-dropdown-header-main';

    const chevron = document.createElement('svg');
    chevron.className = 'addons-dropdown-chevron';
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';

    const title = document.createElement('div');
    title.className = 'addons-dropdown-title';
    title.textContent = group.title;

    const price = document.createElement('div');
    price.className = 'addons-dropdown-price';

    const indicator = document.createElement('div');
    indicator.className = 'addons-dropdown-indicator';
    indicator.setAttribute('data-group-id', group.title.toLowerCase().replace(/\s+/g, '-'));

    const headerMeta = document.createElement('div');
    headerMeta.className = 'addons-dropdown-header-meta';
    headerMeta.appendChild(price);
    headerMeta.appendChild(indicator);

    headerMain.appendChild(chevron);
    headerMain.appendChild(title);
    headerMain.appendChild(headerMeta);

    header.appendChild(headerMain);

    // Content (expandable)
    const content = document.createElement('div');
    content.className = 'addons-dropdown-content';

    const intro = buildAddonIntro(group);
    content.appendChild(intro);

    // Handle tech group with subsections
    if (group.type === 'tech' && group.subsections) {
      // Add custom cable length input for tech addon
      const cableLengthContainer = document.createElement('div');
      cableLengthContainer.className = 'addons-cable-length-container';

      const cableLengthLabel = document.createElement('label');
      cableLengthLabel.className = 'addons-cable-length-label';
      cableLengthLabel.htmlFor = 'tech-cable-length-input';
      cableLengthLabel.textContent = 'Custom Cable Length (feet)';

      const cableLengthInput = document.createElement('input');
      cableLengthInput.type = 'number';
      cableLengthInput.id = 'tech-cable-length-input';
      cableLengthInput.className = 'addons-cable-length-input';
      cableLengthInput.min = '1';
      cableLengthInput.max = '300';
      cableLengthInput.placeholder = '12';
      cableLengthInput.disabled = true;
      cableLengthInput.setAttribute('data-tooltip', 'Please make a selection');
      cableLengthInput.setAttribute('aria-label', 'Custom cable length for power cables');

      cableLengthContainer.appendChild(cableLengthLabel);
      cableLengthContainer.appendChild(cableLengthInput);
      content.appendChild(cableLengthContainer);
      group.subsections.forEach(subsection => {
        const subContainer = document.createElement('div');
        subContainer.className = 'addons-subsection';

        const subTitle = document.createElement('div');
        subTitle.className = 'addons-subsection-title';
        subTitle.textContent = subsection.title;
        subContainer.appendChild(subTitle);

        if (subsection.type === 'tile') {
          // Render as tiles (buttons)
          const tilesContainer = document.createElement('div');
          tilesContainer.className = 'addons-tiles-container';
          if (group.title === 'Edge Profiles') {
            tilesContainer.classList.add('addons-edge-profile-tiles');
          }
          if (subsection.layout === 'scroll') {
            tilesContainer.classList.add('addons-tiles-scroll');
          }
          const groupId = subsection.groupId || subsection.title;
          subsection.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'addons-tile';
            btn.setAttribute('data-addon-id', option.id);
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('data-price', option.price || 0);
            if (subsection.selection === 'single') {
              btn.setAttribute('data-addon-mode', 'single');
              btn.setAttribute('data-addon-group', groupId);
            }

            // Check for addon compatibility with current design
            const isInnerlightingIncompatible = option.id.startsWith('addon-lighting-') && option.id !== 'addon-lighting-none' &&
              (currentDesign === 'des-slab' || currentDesign === 'des-encasement' || currentDesign === 'des-encased-slab' || currentDesign === 'des-cookie');
            const isIncompatible = isInnerlightingIncompatible;
            const isConfiguredDisabled = group.disabled || subsection.disabled || option.disabled;
            const isDisabled = isConfiguredDisabled || isIncompatible;

            if (isDisabled) {
              let tooltip = resolveTooltip(option, subsection);
              if (isInnerlightingIncompatible) {
                tooltip = 'Not compatible with Slab, Encasement, or Cookie designs';
              }
              if (isConfiguredDisabled) setHardDisabled(btn, tooltip || '');
              else setSoftDisabled(btn, tooltip || '', 'design-compatibility');
            }

            if (option.image) {
              const img = document.createElement('img');
              img.className = 'addons-tile-image';
              img.src = option.image;
              img.alt = option.title ? `Preview of ${option.title}` : 'Tech option';
              img.draggable = false;
              btn.appendChild(img);
            }

            const label = document.createElement('div');
            label.className = 'addons-tile-label';
            label.textContent = option.title;

            const price = document.createElement('div');
            price.className = 'addons-tile-price';
            price.textContent = formatPriceLabel(option.price);

            btn.appendChild(label);
            btn.appendChild(price);
            applyTestingDisabledState(btn, option);
            tilesContainer.appendChild(btn);

          });
          subContainer.appendChild(tilesContainer);
        } else if (subsection.type === 'dropdown') {
          // Render as dropdown
          const select = document.createElement('select');
          select.className = 'addons-dropdown-select';
          const groupId = subsection.groupId || subsection.title;
          select.setAttribute('data-addon-group', groupId);
          if (group.disabled || subsection.disabled) {
            const tooltip = resolveTooltip({}, subsection);
            setHardDisabled(select, tooltip || '');
          }

          subsection.options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            const optionPriceLabel = formatPriceLabel(option.price);
            opt.textContent = `${option.title} (${optionPriceLabel})`;
            opt.setAttribute('data-price', option.price || 0);

            // Check for addon compatibility with current design
            const currentDesign = currentState.selections && currentState.selections.design;
            const isInnerlightingIncompatible = option.id.startsWith('addon-lighting-') && option.id !== 'addon-lighting-none' &&
              (currentDesign === 'des-slab' || currentDesign === 'des-encasement' || currentDesign === 'des-encased-slab' || currentDesign === 'des-cookie');
            const isIncompatible = isInnerlightingIncompatible;
            const isConfiguredDisabled = group.disabled || subsection.disabled || option.disabled;
            const isDisabled = isConfiguredDisabled || isIncompatible;

            if (isDisabled) {
              if (isConfiguredDisabled) setHardDisabled(opt);
              else setSoftDisabled(opt, '', 'design-compatibility');
            }
            applyTestingDisabledState(opt, option, { overlay: false });
            select.appendChild(opt);
          });

          subContainer.appendChild(select);

        }

        content.appendChild(subContainer);
      });
    } else if (group.type === 'tile') {
      const tilesContainer = document.createElement('div');
      tilesContainer.className = 'addons-tiles-container';
      if (group.title === 'Edge Profiles') {
        tilesContainer.classList.add('addons-edge-profile-tiles');
      }
      if (group.layout === 'scroll') {
        tilesContainer.classList.add('addons-tiles-scroll');
      }

      if (group.options) {
        group.options.forEach(option => {
          if (hiddenAddonIds.has(option.id)) return;
          const tooltip = resolveTooltip(option);
          const btn = document.createElement('button');
          btn.className = 'addons-tile';
          btn.setAttribute('data-addon-id', option.id);
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('data-price', option.price || 0);

          const currentAddons = currentState.selections.options && currentState.selections.options.addon ? currentState.selections.options.addon : [];
          const hasSquoval = currentAddons.includes('addon-squoval');
          const hasLiveEdge = currentAddons.includes('addon-live-edge');
          const hasWaterfall = currentAddons.includes('addon-waterfall-single') || currentAddons.includes('addon-waterfall-second');
          const isRoundedCornersIncompatible = option.id === 'addon-rounded-corners' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round');
          const isAngledCornersIncompatible = option.id === 'addon-angled-corners' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round');
          const isChamferedEdgesIncompatible = option.id === 'addon-chamfered-edges' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round' || currentAddons.includes('addon-live-edge'));
          const isSquovalIncompatible = option.id === 'addon-squoval' &&
            (hasLiveEdge || hasWaterfall);
          const isIncompatible = isRoundedCornersIncompatible || isAngledCornersIncompatible || isChamferedEdgesIncompatible || isSquovalIncompatible;
          const isConfiguredDisabled = group.disabled || option.disabled;
          const isDisabled = isConfiguredDisabled || isIncompatible;

          if (isDisabled) {
            let incompatibilityTooltip = tooltip;
            let disabledBySource = 'edge-profile-base';
            if (isRoundedCornersIncompatible || isAngledCornersIncompatible) {
              incompatibilityTooltip = 'Not compatible with Cookie or Round designs';
            } else if (isChamferedEdgesIncompatible) {
              incompatibilityTooltip = 'Not compatible with Cookie or Round designs or Live Edge';
            } else if (isSquovalIncompatible) {
              incompatibilityTooltip = 'Not compatible with Live Edge or Waterfall Edge';
              disabledBySource = 'edge-profile';
            }
            if (isConfiguredDisabled) setHardDisabled(btn, incompatibilityTooltip || '');
            else setSoftDisabled(btn, incompatibilityTooltip || '', disabledBySource);
          }

          const img = document.createElement('img');
          img.className = 'addons-tile-image';
          img.src = option.image || group.image || DEFAULT_ADDON_INTRO_IMAGE;
          img.alt = option.title ? `Preview of ${option.title}` : 'Customization option';
          img.draggable = false;
          btn.appendChild(img);

          const label = document.createElement('div');
          label.className = 'addons-tile-label';
          label.textContent = option.title;

          const optionPrice = document.createElement('div');
          optionPrice.className = 'addons-tile-price';
          optionPrice.textContent = formatPriceLabel(option.price);

          btn.appendChild(label);
          btn.appendChild(optionPrice);
          applyTestingDisabledState(btn, option);
          tilesContainer.appendChild(btn);
        });
      }

      content.appendChild(tilesContainer);
    } else {
      // Original logic for non-tech groups
      const options = document.createElement('div');
      options.className = 'addons-dropdown-options';

      // Options for this group
      if (group.options) {
        group.options.forEach(option => {
          if (hiddenAddonIds.has(option.id)) return;
          const tooltip = resolveTooltip(option);
          const optionDiv = document.createElement('div');
          optionDiv.className = 'addons-dropdown-option';
          optionDiv.setAttribute('data-addon-id', option.id);
          optionDiv.setAttribute('data-price', option.price || 0);

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'addons-dropdown-option-checkbox';
          checkbox.setAttribute('data-addon-id', option.id);
          checkbox.setAttribute('data-price', option.price || 0);

          // Check for addon compatibility with current design
          const currentAddons = currentState.selections.options && currentState.selections.options.addon ? currentState.selections.options.addon : [];
          const hasSquoval = currentAddons.includes('addon-squoval');
          const hasLiveEdge = currentAddons.includes('addon-live-edge');
          const hasWaterfall = currentAddons.includes('addon-waterfall-single') || currentAddons.includes('addon-waterfall-second');
          const isRoundedCornersIncompatible = option.id === 'addon-rounded-corners' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round');
          const isAngledCornersIncompatible = option.id === 'addon-angled-corners' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round');
          const isCustomRiverIncompatible = option.id === 'addon-custom-river' &&
            (currentDesign === 'des-slab' || currentDesign === 'des-encasement' || currentDesign === 'des-encased-slab' || currentDesign === 'des-cookie');
          const isChamferedEdgesIncompatible = option.id === 'addon-chamfered-edges' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round' || currentAddons.includes('addon-live-edge'));
          const isSquovalIncompatible = option.id === 'addon-squoval' &&
            (hasLiveEdge || hasWaterfall);
          const isLiveEdgeIncompatible = option.id === 'addon-live-edge' && hasSquoval;
          const isWaterfallIncompatible = (
            option.id === 'addon-waterfall-single'
            || option.id === 'addon-waterfall-second'
            || option.id === 'addon-waterfall-art'
          ) && hasSquoval;
          const requiresWaterfallSingle = (
            option.id === 'addon-waterfall-second'
            || option.id === 'addon-waterfall-art'
          ) && !currentAddons.includes('addon-waterfall-single');
          const isLiveEdgeRequired = option.id === 'addon-live-edge' && currentDesign === 'des-slab';
          const isLowerShelfLegIncompatible = option.id === LOWER_SHELF_ADDON_ID &&
            isLowerShelfCompatibleModel(currentModel) &&
            !isLowerShelfCompatibleContext({ modelId: currentModel, legId: currentLeg });
          const isIncompatible = isRoundedCornersIncompatible || isAngledCornersIncompatible || isCustomRiverIncompatible || isChamferedEdgesIncompatible || isSquovalIncompatible || isLiveEdgeIncompatible || isWaterfallIncompatible || requiresWaterfallSingle || isLowerShelfLegIncompatible;
          const isConfiguredDisabled = group.disabled || option.disabled;
          const isDisabled = isConfiguredDisabled || isIncompatible || isLiveEdgeRequired;

          if (isDisabled) {
            let incompatibilityTooltip = tooltip;
            let disabledBySource = 'addon-compatibility';
            if (requiresWaterfallSingle) {
              incompatibilityTooltip = 'Select Single Waterfall to enable';
              disabledBySource = 'waterfall';
              checkbox.setAttribute('data-disabled-by', 'waterfall');
              optionDiv.setAttribute('data-disabled-by', 'waterfall');
            } else if (isRoundedCornersIncompatible) {
              incompatibilityTooltip = 'Not compatible with Cookie or Round designs';
            } else if (isAngledCornersIncompatible) {
              incompatibilityTooltip = 'Not compatible with Cookie or Round designs';
            } else if (isCustomRiverIncompatible) {
              incompatibilityTooltip = 'Not compatible with Slab, Encasement, or Cookie designs';
            } else if (isChamferedEdgesIncompatible) {
              incompatibilityTooltip = 'Not compatible with Cookie or Round designs or Live Edge';
            } else if (isSquovalIncompatible) {
              incompatibilityTooltip = 'Not compatible with Live Edge or Waterfall Edge';
              disabledBySource = 'edge-profile-base';
            } else if (isLiveEdgeIncompatible || isWaterfallIncompatible) {
              incompatibilityTooltip = 'Not compatible with Squoval';
              disabledBySource = 'squoval';
            } else if (isLowerShelfLegIncompatible) {
              incompatibilityTooltip = getLowerShelfCompatibilityTooltip();
              disabledBySource = 'lower-shelf';
              checkbox.setAttribute('data-disabled-by', 'lower-shelf');
              optionDiv.setAttribute('data-disabled-by', 'lower-shelf');
            } else if (isLiveEdgeRequired) {
              incompatibilityTooltip = 'Included with Slab design';
              disabledBySource = 'included-with-design';
            }
            if (isConfiguredDisabled) {
              setHardDisabled(checkbox);
              setHardDisabled(optionDiv, incompatibilityTooltip || '');
            } else {
              setSoftDisabled(checkbox, '', disabledBySource);
              setSoftDisabled(optionDiv, incompatibilityTooltip || '', disabledBySource);
            }
          }

          const label = document.createElement('div');
          label.className = 'addons-dropdown-option-label';
          label.textContent = option.title;

          const optionPrice = document.createElement('div');
          optionPrice.className = 'addons-dropdown-option-price';
          optionPrice.textContent = formatPriceLabel(option.price);

          optionDiv.appendChild(checkbox);
          optionDiv.appendChild(label);
          optionDiv.appendChild(optionPrice);
          applyTestingDisabledState(optionDiv, option);
          applyTestingDisabledState(checkbox, option, { overlay: false });

          options.appendChild(optionDiv);
        });
      }

      content.appendChild(options);
    }

    // Handle disabled state
    if (group.disabled) {
      content.querySelectorAll('input, button, select').forEach(el => setHardDisabled(el));
      if (group.tooltip) {
        tile.setAttribute('data-tooltip', group.tooltip);
      }
    }

    // Event listeners
    header.addEventListener('click', () => {
      const isExpanded = tile.classList.contains('expanded');

      if (!isExpanded) {
        // About to expand - measure content height first
        content.style.maxHeight = 'none'; // Temporarily remove max-height to measure
        const scrollHeight = content.scrollHeight;
        content.style.maxHeight = '0'; // Reset for animation

        // Force reflow, then set the measured height
        content.offsetHeight; // Trigger reflow
        content.style.maxHeight = scrollHeight + 'px';
      } else {
        // Collapsing
        content.style.maxHeight = '0';
      }

      tile.classList.toggle('expanded');
      header.setAttribute('aria-expanded', !isExpanded);
      if (!isExpanded) {
        requestAnimationFrame(() => scrollElementToTop(tile));
      }
    });

    tile.appendChild(header);
    tile.appendChild(content);
    container.appendChild(tile);
  });
}

export function renderSheenSlider(container, data = []) {
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(data) || data.length === 0) return;

  const tilesContainer = document.createElement('div');
  tilesContainer.className = 'sheen-tiles-container stage-options-grid';
  tilesContainer.setAttribute('aria-live', 'polite');
  tilesContainer.setAttribute('aria-atomic', 'true');

  const tileElements = [];

  data.forEach((item) => {
    const tile = document.createElement('button');
    tile.className = 'sheen-tile option-card';
    tile.setAttribute('data-id', item.id);
    tile.setAttribute('data-category', 'finish-sheen');
    tile.setAttribute('data-price', String(item.price || 0));
    tile.setAttribute('aria-pressed', 'false');

    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.alt || item.title || 'placeholder';
      img.className = 'viewer-placeholder-img';
      img.draggable = false;
      tile.appendChild(img);
    }

    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = item.title || item.id;
    const p = document.createElement('div');
    p.className = 'price-delta';
    p.textContent = formatPriceLabel(item.price);
    tile.appendChild(t);
    tile.appendChild(p);

    if (item.description) {
      const d = document.createElement('div');
      d.className = 'description';
      d.textContent = item.description;
      tile.appendChild(d);
    }

    if (item.disabled) setHardDisabled(tile, item.tooltip || '');
    applyTestingDisabledState(tile, item);
    tilesContainer.appendChild(tile);
    tileElements.push(tile);
  });

  container.appendChild(tilesContainer);
  enhanceOptionCardsWithInfo(tilesContainer);

  let lastSelectedIndex = -1;

  const updateTileHighlighting = (selectedIndex) => {
    tileElements.forEach((tile, index) => {
      const isSelected = index === selectedIndex;
      tile.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      tile.classList.toggle('selected', isSelected);
    });
  };

  const dispatchSelectionEvent = (selectedIndex) => {
    const selectedItem = data[selectedIndex];
    if (!selectedItem) return;
    document.dispatchEvent(new CustomEvent('option-selected', {
      detail: {
        id: selectedItem.id,
        price: selectedItem.price || 0,
        category: 'finish-sheen'
      }
    }));
  };

  const selectIndex = (selectedIndex, options = {}) => {
    const { dispatch = true } = options;
    if (selectedIndex < 0 || selectedIndex >= data.length) return;
    const wasSelected = selectedIndex === lastSelectedIndex;
    lastSelectedIndex = selectedIndex;
    updateTileHighlighting(selectedIndex);
    container.__sheenSelectedIndex = selectedIndex;
    if (dispatch && !wasSelected) dispatchSelectionEvent(selectedIndex);
  };

  tilesContainer.addEventListener('click', (event) => {
    const tile = event.target.closest('.sheen-tile');
    if (!tile) return;
    if (tile.hasAttribute('disabled')) return;
    const selectedIndex = tileElements.indexOf(tile);
    if (selectedIndex !== -1) {
      selectIndex(selectedIndex);
    }
  });

  container.__setSheenIndex = (index, options = {}) => {
    selectIndex(index, options);
  };
}

export default {
  renderOptionCards,
  renderAddonsDropdown,
  renderSheenSlider,
  enhanceOptionCardsWithInfo,
  initOptionCardInfoDialogs,
  applyTestingDisabledState
};
