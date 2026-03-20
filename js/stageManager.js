// Minimal stage manager for WL Configurator
// Responsibilities:
// - Track current stage index
// - Enable/disable stage buttons
// - Prev/Next navigation with simple gating rules
// - React to model selection events to set price and mark stage complete

const STAGES = [
  'Models',
  'Designs',
  'Tabletop',
  'Finish',
  'Dimensions',
  'Legs',
  'Add-ons',
  'Summary & Export'
];

import { loadComponent } from './app.js';
import { state as appState, setState } from './state.js';
// helper from placeholders to recompute finish constraints when selections are set programmatically
import { recomputeFinishConstraints } from './ui/placeholders.js';
import { applyFinishDefaults } from './stages/finish.js';
import { computePrice } from './pricing.js';
import { showBanner } from './ui/banner.js';
import { showConfirmDialog } from './ui/confirmDialog.js';
import { init as initModelsStage } from './stages/models.js';
import { init as initDesignsStage } from './stages/designs.js';
import materialsStage, { init as initMaterialsStage } from './stages/materials.js';
import finishStage, { init as initFinishStage } from './stages/finish.js';
import dimensionsStage from './stages/dimensions.js';
import legsStage from './stages/legs.js';
import addonsStage from './stages/addons.js';
import summaryStage from './stages/summary.js';
import modelsStageModule from './stages/models.js';
import designsStageModule from './stages/designs.js';
import { createLogger } from './logger.js';

const log = createLogger('StageManager');

const managerState = {
  current: 0,
  completed: new Array(STAGES.length).fill(false),
  opened: new Array(STAGES.length).fill(false),
  config: {
    model: null,
    material: null,
    finish: null,
    dimensions: {},
    legs: null,
    addons: [],
    price: 0
  }
};

// Stages that are optional (no selection required to advance)
const OPTIONAL_STAGES = [6]; // index 6 = 'Add-ons'
const DIMENSIONS_STAGE_INDEX = 4;
const LEGS_STAGE_INDEX = 5;
const SUMMARY_STAGE_INDEX = 7;
const SUMMARY_FULL_LABEL = 'Summary & Export';
const SUMMARY_SHORT_LABEL = 'Summary';
const VALIDATION_ERROR_CLASS = 'has-validation-error';
const VALIDATION_MESSAGE_CLASS = 'stage-required-message';
let summaryLabelObserver = null;
let summaryLabelHandlersBound = false;
let activeValidationPrompt = null;

function $(sel) {
  return document.querySelector(sel);
}

function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function shouldUseShortSummaryLabel(btn) {
  if (!btn) return false;
  const prevLabel = btn.textContent || '';
  if (prevLabel !== SUMMARY_FULL_LABEL) btn.textContent = SUMMARY_FULL_LABEL;
  const style = window.getComputedStyle(btn);
  const lineHeight = parseFloat(style.lineHeight);
  const fontSize = parseFloat(style.fontSize) || 16;
  const computedLineHeight = Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.2;
  const verticalPadding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const maxSingleLineHeight = Math.ceil(computedLineHeight + verticalPadding + 1);
  const wraps = btn.scrollHeight > maxSingleLineHeight;
  if (prevLabel !== SUMMARY_FULL_LABEL) btn.textContent = prevLabel;
  return wraps;
}

function updateSummaryStageButtonLabel() {
  const btn = document.querySelector(`#stage-bar .stage-btn[data-stage-index='${SUMMARY_STAGE_INDEX}']`);
  if (!btn) return;
  const shortLabelNeeded = shouldUseShortSummaryLabel(btn);
  const targetLabel = shortLabelNeeded ? SUMMARY_SHORT_LABEL : SUMMARY_FULL_LABEL;
  if ((btn.textContent || '') !== targetLabel) btn.textContent = targetLabel;
  btn.setAttribute('aria-label', SUMMARY_FULL_LABEL);
  btn.setAttribute('title', SUMMARY_FULL_LABEL);
}

function scheduleSummaryStageButtonLabelUpdate() {
  requestAnimationFrame(() => {
    updateSummaryStageButtonLabel();
  });
}

function bindSummaryStageButtonLabelHandlers() {
  if (summaryLabelHandlersBound) return;
  summaryLabelHandlersBound = true;
  window.addEventListener('resize', scheduleSummaryStageButtonLabelUpdate);
  if (typeof ResizeObserver === 'function') {
    const stageBar = document.getElementById('stage-bar');
    if (stageBar) {
      summaryLabelObserver = new ResizeObserver(() => scheduleSummaryStageButtonLabelUpdate());
      summaryLabelObserver.observe(stageBar);
    }
  }
}

function formatPrice(centsOrUnits) {
  // Input is USD in whole units in this repo; keep simple formatting
  return `$${Number(centsOrUnits).toLocaleString()}`;
}

function isStageCompleteForNav(index) {
  if (OPTIONAL_STAGES.includes(index)) return true;
  if (index === DIMENSIONS_STAGE_INDEX) return hasSelectedDimensions(appState);
  return !!managerState.completed[index];
}

function hasSelectedDimensions(appState) {
  const dimSelected = !!(appState && appState.selections && appState.selections.options && appState.selections.options.dimensions);
  if (dimSelected) return true;
  const detail = appState && appState.selections && appState.selections.dimensionsDetail;
  return Number.isFinite(detail && detail.length) && Number.isFinite(detail && detail.width);
}

function getSelectedOptions(source = appState) {
  return source && source.selections && source.selections.options ? source.selections.options : {};
}

function isMaterialsStageComplete(source = appState) {
  const options = getSelectedOptions(source);
  return !!(options.material && options.color && options['color-gradient']);
}

function isFinishStageComplete(source = appState) {
  const options = getSelectedOptions(source);
  return !!(options['finish-coating'] && options['finish-sheen'] && options['finish-tint']);
}

function getLegSelectionState(source = appState) {
  const options = getSelectedOptions(source);
  const legId = options.legs || null;
  const designId = source && source.selections ? source.selections.design : null;
  const isNoneLeg = legId === 'leg-none';
  const isCustomLeg = legId === 'leg-sample-07';
  const isSignatureLeg = legId === 'leg-signature';
  const isSignatureDesign = designId === 'des-signature';
  const tubeSizeRequired = !!legId && !isNoneLeg && !isCustomLeg && !isSignatureLeg && !isSignatureDesign;

  return {
    legId,
    isNoneLeg,
    tubeSizeRequired,
    hasLegs: !!legId,
    hasTubeSize: !!options['tube-size'],
    hasLegFinish: !!options['leg-finish']
  };
}

function isLegStageComplete(source = appState) {
  const legState = getLegSelectionState(source);
  if (!legState.hasLegs) return false;
  if (legState.isNoneLeg) return true;
  return (!legState.tubeSizeRequired || legState.hasTubeSize) && legState.hasLegFinish;
}

function getDirectHeadingChild(container) {
  if (!container || !container.children) return null;
  return Array.from(container.children).find((child) => /^H[1-6]$/i.test(child.tagName)) || null;
}

function ensureValidationMessage(anchorEl, key) {
  if (!anchorEl) return null;

  let messageEl = anchorEl.querySelector(`.${VALIDATION_MESSAGE_CLASS}[data-validation-key="${key}"]`);
  if (!messageEl) {
    messageEl = document.createElement('div');
    messageEl.className = VALIDATION_MESSAGE_CLASS;
    messageEl.dataset.validationKey = key;
    messageEl.setAttribute('aria-live', 'polite');
    messageEl.setAttribute('aria-atomic', 'true');
    messageEl.hidden = true;

    const headingChild = getDirectHeadingChild(anchorEl);
    if (headingChild) headingChild.insertAdjacentElement('afterend', messageEl);
    else anchorEl.prepend(messageEl);
  }

  return messageEl;
}

function clearActiveValidationPrompt() {
  if (!activeValidationPrompt) return;

  const { messageEl, messageText, useExistingMessageEl, highlightEl } = activeValidationPrompt;
  if (highlightEl) highlightEl.classList.remove(VALIDATION_ERROR_CLASS);

  if (messageEl) {
    if (useExistingMessageEl) {
      if ((messageEl.textContent || '').trim() === (messageText || '').trim()) messageEl.textContent = '';
    } else {
      messageEl.textContent = '';
      messageEl.hidden = true;
    }
  }

  activeValidationPrompt = null;
}

function refreshActiveValidationPrompt() {
  if (!activeValidationPrompt) return;

  const { stageIndex, isResolved, messageEl } = activeValidationPrompt;
  if (stageIndex !== managerState.current || (messageEl && !document.contains(messageEl))) {
    clearActiveValidationPrompt();
    return;
  }

  if (typeof isResolved === 'function' && isResolved()) clearActiveValidationPrompt();
}

function setDropdownExpanded(dropdown, shouldExpand) {
  if (!dropdown) return;
  const header = dropdown.querySelector('.stage-subsection-header');
  const content = dropdown.querySelector('.stage-subsection-content');
  dropdown.classList.toggle('expanded', shouldExpand);
  if (header) header.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
  if (content) {
    content.hidden = !shouldExpand;
    content.style.maxHeight = shouldExpand ? 'none' : '0px';
  }
}

function expandExclusiveDropdown(dropdown) {
  if (!dropdown) return;
  const list = dropdown.closest('.stage-subsection-list');
  if (!list) {
    setDropdownExpanded(dropdown, true);
    return;
  }

  list.querySelectorAll('.stage-subsection-dropdown').forEach((item) => {
    setDropdownExpanded(item, item === dropdown);
  });
}

function focusValidationTarget(target) {
  if (!target || typeof target.focus !== 'function') return;
  requestAnimationFrame(() => {
    try {
      target.focus({ preventScroll: true });
    } catch (e) {
      target.focus();
    }
  });
}

function showValidationPrompt(requirement) {
  if (!requirement || !requirement.anchorEl) return false;

  clearActiveValidationPrompt();

  if (requirement.dropdownEl) expandExclusiveDropdown(requirement.dropdownEl);

  const messageEl = requirement.useExistingMessageEl
    ? requirement.anchorEl
    : ensureValidationMessage(requirement.anchorEl, requirement.key);
  if (!messageEl) return false;

  messageEl.textContent = requirement.message;
  if (!requirement.useExistingMessageEl) messageEl.hidden = false;

  const highlightEl = requirement.highlightEl || requirement.anchorEl;
  if (highlightEl) highlightEl.classList.add(VALIDATION_ERROR_CLASS);

  const scrollTarget = requirement.scrollEl || requirement.dropdownEl || requirement.highlightEl || requirement.anchorEl;
  if (scrollTarget && typeof scrollTarget.scrollIntoView === 'function') {
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  focusValidationTarget(requirement.focusEl || scrollTarget);

  activeValidationPrompt = {
    stageIndex: managerState.current,
    messageEl,
    messageText: requirement.message,
    useExistingMessageEl: !!requirement.useExistingMessageEl,
    highlightEl,
    isResolved: requirement.isResolved
  };

  return true;
}

function buildDropdownRequirement({ key, dropdownSelector, message, isResolved }) {
  if (isResolved()) return null;

  const dropdown = document.querySelector(dropdownSelector);
  const anchorEl = dropdown && dropdown.querySelector('.stage-subsection-body');
  const header = dropdown && dropdown.querySelector('.stage-subsection-header');
  return {
    key,
    message,
    anchorEl: anchorEl || dropdown,
    dropdownEl: dropdown,
    highlightEl: dropdown,
    focusEl: header || dropdown,
    scrollEl: dropdown,
    isResolved
  };
}

function getNumericInputValue(input) {
  if (!input) return null;
  if (input.value === '' || input.value == null) return null;
  const parsed = Number(input.value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidInputValue(input) {
  const value = getNumericInputValue(input);
  if (value === null) return false;
  if (!input || !input.validity) return true;
  return !(input.validity.rangeUnderflow || input.validity.rangeOverflow || input.validity.badInput);
}

function getDimensionsRequirement() {
  const presetRow = document.querySelector('#dimensions-stage-panel .presets-row');
  const selectedPreset = document.querySelector('#dimensions-presets .option-card[aria-pressed="true"], #dimensions-presets .option-card.selected');
  const selectedPresetId = selectedPreset ? selectedPreset.getAttribute('data-preset-id') : null;

  if (!selectedPresetId && !hasSelectedDimensions(appState)) {
    return {
      key: 'dimensions-preset',
      message: 'Select a popular option or choose Custom to continue.',
      anchorEl: presetRow || document.getElementById('dimensions-stage-panel'),
      highlightEl: presetRow,
      focusEl: selectedPreset || document.querySelector('#dimensions-presets .option-card'),
      scrollEl: presetRow,
      isResolved: () => {
        const currentSelectedPreset = document.querySelector('#dimensions-presets .option-card[aria-pressed="true"], #dimensions-presets .option-card.selected');
        return !!currentSelectedPreset || hasSelectedDimensions(appState);
      }
    };
  }

  if (selectedPresetId !== 'custom') return null;

  const lengthInput = document.getElementById('dim-length-input');
  const widthInput = document.getElementById('dim-width-input');
  const customHeightInput = document.getElementById('dim-height-custom-input');
  const customHeightContainer = document.getElementById('custom-height-container');
  const selectedHeight = document.querySelector('#height-options .option-card.selected,[data-height-id].selected');
  const selectedHeightId = selectedHeight ? selectedHeight.getAttribute('data-height-id') : null;

  if (!isValidInputValue(lengthInput)) {
    const validationEl = document.getElementById('dim-length-validation');
    return {
      key: 'dimensions-length',
      message: (validationEl && validationEl.textContent.trim()) || 'Enter a valid length to continue.',
      anchorEl: validationEl,
      useExistingMessageEl: true,
      highlightEl: document.getElementById('length-control-row'),
      focusEl: lengthInput,
      scrollEl: document.getElementById('length-control-row'),
      isResolved: () => isValidInputValue(document.getElementById('dim-length-input'))
    };
  }

  if (!isValidInputValue(widthInput)) {
    const validationEl = document.getElementById('dim-width-validation');
    return {
      key: 'dimensions-width',
      message: (validationEl && validationEl.textContent.trim()) || 'Enter a valid width to continue.',
      anchorEl: validationEl,
      useExistingMessageEl: true,
      highlightEl: document.getElementById('width-control-row'),
      focusEl: widthInput,
      scrollEl: document.getElementById('width-control-row'),
      isResolved: () => isValidInputValue(document.getElementById('dim-width-input'))
    };
  }

  if (selectedHeightId === 'custom' && !isValidInputValue(customHeightInput)) {
    const validationEl = document.getElementById('dim-height-custom-validation');
    return {
      key: 'dimensions-height-custom',
      message: (validationEl && validationEl.textContent.trim()) || 'Enter a valid custom height to continue.',
      anchorEl: validationEl,
      useExistingMessageEl: true,
      highlightEl: customHeightContainer,
      focusEl: customHeightInput,
      scrollEl: customHeightContainer,
      isResolved: () => isValidInputValue(document.getElementById('dim-height-custom-input'))
    };
  }

  return null;
}

function getFirstMissingRequirement() {
  if (managerState.current === 0 && !appState.selections.model) {
    const section = document.getElementById('models-stage-section') || document.getElementById('stage-panel-0');
    return {
      key: 'model',
      message: 'Select a model to continue.',
      anchorEl: section,
      highlightEl: section,
      focusEl: document.querySelector('.option-card[data-id^="mdl-"]'),
      scrollEl: section,
      isResolved: () => !!appState.selections.model
    };
  }

  if (managerState.current === 1 && !appState.selections.design) {
    const groups = Array.from(document.querySelectorAll('#designs-stage-section .designs-stage-group'));
    const group = groups.find((item) => item.querySelector('.option-card')) || groups[0] || document.getElementById('designs-stage-section');
    const isGroupOpen = !!(group && group.classList && group.classList.contains('is-open'));
    return {
      key: 'design',
      message: 'Select a design to continue.',
      anchorEl: group,
      highlightEl: group,
      focusEl: group && (isGroupOpen ? group.querySelector('.option-card') : group.querySelector('.designs-stage-toggle')),
      scrollEl: group,
      isResolved: () => !!appState.selections.design
    };
  }

  if (managerState.current === 2) {
    return buildDropdownRequirement({
      key: 'material',
      dropdownSelector: '#tabletop-subsection-wood',
      message: 'Select a wood option to continue.',
      isResolved: () => !!getSelectedOptions(appState).material
    }) || buildDropdownRequirement({
      key: 'color',
      dropdownSelector: '#tabletop-subsection-color',
      message: 'Select a color option to continue.',
      isResolved: () => !!getSelectedOptions(appState).color
    }) || buildDropdownRequirement({
      key: 'color-gradient',
      dropdownSelector: '#tabletop-subsection-color-gradient',
      message: 'Select a color gradient to continue.',
      isResolved: () => !!getSelectedOptions(appState)['color-gradient']
    });
  }

  if (managerState.current === 3) {
    return buildDropdownRequirement({
      key: 'finish-coating',
      dropdownSelector: '#finish-subsection-coating',
      message: 'Select a coating to continue.',
      isResolved: () => !!getSelectedOptions(appState)['finish-coating']
    }) || buildDropdownRequirement({
      key: 'finish-sheen',
      dropdownSelector: '#finish-subsection-sheen',
      message: 'Select a sheen to continue.',
      isResolved: () => !!getSelectedOptions(appState)['finish-sheen']
    }) || buildDropdownRequirement({
      key: 'finish-tint',
      dropdownSelector: '#finish-subsection-tint',
      message: 'Select a tint to continue.',
      isResolved: () => !!getSelectedOptions(appState)['finish-tint']
    });
  }

  if (managerState.current === DIMENSIONS_STAGE_INDEX) return getDimensionsRequirement();

  if (managerState.current === LEGS_STAGE_INDEX) {
    const legState = getLegSelectionState(appState);
    return buildDropdownRequirement({
      key: 'legs',
      dropdownSelector: '#legs-subsection-style',
      message: 'Select a leg style to continue.',
      isResolved: () => getLegSelectionState(appState).hasLegs
    }) || (legState.tubeSizeRequired ? buildDropdownRequirement({
      key: 'tube-size',
      dropdownSelector: '#legs-subsection-tube-size',
      message: 'Select a tube size to continue.',
      isResolved: () => getLegSelectionState(appState).hasTubeSize
    }) : null) || buildDropdownRequirement({
      key: 'leg-finish',
      dropdownSelector: '#legs-subsection-leg-finish',
      message: 'Select a leg finish to continue.',
      isResolved: () => getLegSelectionState(appState).hasLegFinish
    });
  }

  return null;
}

function revealFirstMissingRequiredSelection() {
  return showValidationPrompt(getFirstMissingRequirement());
}

function updateNextButton() {
  const nextBtn = document.getElementById('next-stage-btn');
  if (!nextBtn) return;
  const isLastStage = managerState.current >= STAGES.length - 1;
  nextBtn.disabled = isLastStage;
  nextBtn.setAttribute('aria-disabled', isLastStage ? 'true' : 'false');
}

function updateStageButtons() {
  const currentCompleted = isStageCompleteForNav(managerState.current);

  $all('#stage-bar .stage-btn').forEach(btn => {
    const idx = Number(btn.getAttribute('data-stage-index'));
    let shouldDisable = false;

    if (idx === managerState.current) {
      btn.setAttribute('aria-current', 'step');
    } else {
      btn.removeAttribute('aria-current');
      if (idx < managerState.current) {
        shouldDisable = false;
      } else {
        const canOpenFirstTime = idx === managerState.current + 1;
        shouldDisable = !(managerState.opened[idx] || canOpenFirstTime);
      }
    }

    btn.disabled = shouldDisable;
    btn.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
  });

  if (currentCompleted) refreshActiveValidationPrompt();
}

async function updateLivePrice() {
  // Primary price container: footer #price-bar. Keep fallback to legacy header #live-price
  const footerPrice = document.getElementById('price-bar');
  if (footerPrice) {
    // compute authoritative price using shared state where possible
    try {
      const p = await computePrice(appState);
      footerPrice.textContent = formatPrice(p.total || (managerState.config.price || 0));
      return;
    } catch (e) {
      // fallback
      footerPrice.textContent = formatPrice(managerState.config.price || 0);
      return;
    }
    return;
  }
  const elAmount = $('#live-price .price-amount');
  if (!elAmount) return;
  elAmount.textContent = formatPrice(managerState.config.price || 0);
}

async function setStage(index, options = {}) {
  // options: { allowSkip: boolean, skipConfirm: boolean }
  if (index < 0 || index >= STAGES.length) return;

  // If the configurator was reset (no model selected), clear unlocked/completed progress.
  if (index === 0 && !(appState && appState.selections && appState.selections.model)) {
    for (let i = 1; i < STAGES.length; i++) {
      managerState.completed[i] = false;
      managerState.opened[i] = false;
    }
  }
  
  // Special handling: if navigating back to Models (index 0) and design is already selected,
  // show confirmation dialog unless skipConfirm is true
  if (index === 0 && appState.selections.design && !options.skipConfirm) {
    const confirmed = await showConfirmDialog(
      'Changing models will clear your current selection. Continue?',
      'Cancel',
      'Change Model'
    );
    if (!confirmed) return;
    // User confirmed, clear current selection immediately so reset does not wait for a new model click.
    setState({
      selections: { model: null, design: null, options: {}, dimensionsDetail: null, techCableLength: null }
    });
    document.dispatchEvent(new CustomEvent('request-price-refresh', { detail: { reason: 'model-change-confirmed' } }));
  }
  
  // gating: normally prevent jumping forward past first incomplete required stage
  // but callers can pass { allowSkip: true } to bypass the gating (used by Next button)
  const isAlreadyOpened = !!managerState.opened[index];
  if (index > managerState.current && !options.allowSkip && !isAlreadyOpened) {
    // require model selected to advance beyond stage 0 (Models)
    if (managerState.current <= 0 && !appState.selections.model) {
      revealFirstMissingRequiredSelection();
      return;
    }
    // require design selected to advance beyond stage 1 (Designs)
    // But only gate if we're trying to advance PAST the Designs stage (stage 1)
    if (managerState.current === 1 && index > 1 && !appState.selections.design) {
      revealFirstMissingRequiredSelection();
      return;
    }
    // If attempting to move to the Materials stage (index 2), validate as before
    try {
      if (index >= 3) {
        const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
        const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
        const hasColorGradient = !!(appState.selections && appState.selections.options && appState.selections.options['color-gradient']);
        if (!hasMaterial || !hasColor || !hasColorGradient) {
          revealFirstMissingRequiredSelection();
          return;
        }
        // Ensure Finish stage has sensible defaults: select 2K Poly coating and Satin sheen if
        // they are not already selected. This updates the shared app state and triggers UI restoration.
        try {
          // delegate finish defaults to dedicated module
          applyFinishDefaults(appState);
          // Ensure visual state is updated on DOM after defaults applied
          setTimeout(() => {
            try {
              const coatingEl = document.querySelector('.option-card[data-id="fin-coat-02"]');
              const sheenEl = document.querySelector('.option-card[data-id="fin-sheen-01"]');
              if (coatingEl && !appState.selections.options?.['finish-coating']) {
                coatingEl.setAttribute('aria-pressed', 'true');
              }
              if (sheenEl && !appState.selections.options?.['finish-sheen']) {
                sheenEl.setAttribute('aria-pressed', 'true');
              }
            } catch (e) { /* ignore */ }
          }, 100);
        } catch (e) {
          log.warn('Failed to apply finish defaults via module', e);
        }
      }
      // Require dimensions selection before accessing Legs.
      if (index >= LEGS_STAGE_INDEX && !hasSelectedDimensions(appState)) {
        revealFirstMissingRequiredSelection();
        return;
      }
      // If attempting to move past Legs or beyond (index > 5), require legs, tube-size, and leg-finish
      // (unless "none" leg is selected, which doesn't require tube-size or leg-finish)
      // (or custom leg is selected, which makes tube-size optional)
      if (index > 5) {
        const hasLegs = !!(appState.selections && appState.selections.options && appState.selections.options.legs);
        const legId = appState.selections && appState.selections.options && appState.selections.options.legs;
        const designId = appState.selections && appState.selections.design;
        const isNoneLeg = legId === 'leg-none';
        const isCustomLeg = legId === 'leg-sample-07';
        const isSignatureLeg = legId === 'leg-signature';
        const isSignatureDesign = designId === 'des-signature';

        if (!hasLegs) {
          revealFirstMissingRequiredSelection();
          return;
        }

        // If not "none" leg, require tube-size (unless custom leg) and leg-finish
        if (!isNoneLeg) {
          const hasTubeSize = !!(appState.selections && appState.selections.options && appState.selections.options['tube-size']);
          const hasLegFinish = !!(appState.selections && appState.selections.options && appState.selections.options['leg-finish']);
          const tubeSizeRequired = !isCustomLeg && !isSignatureLeg && !isSignatureDesign;
          if ((tubeSizeRequired && !hasTubeSize) || !hasLegFinish) {
            revealFirstMissingRequiredSelection();
            return;
          }
        }
      }
      // Once all required selections through stage 5 (Legs) are complete, stages 6 (Add-ons) and 7 (Summary)
      // are fully unlocked and can be freely navigated between and back to previous stages.
      // No additional gating is needed for indices 6 and 7.
    } catch (e) {
      // if anything goes wrong reading appState, be conservative and block advance
      revealFirstMissingRequiredSelection();
      return;
    }
  }
  if (index !== managerState.current) clearActiveValidationPrompt();
  managerState.current = index;
  managerState.opened[index] = true;
  updateStageButtons();
  scheduleSummaryStageButtonLabelUpdate();
  updateNextButton();

  // Models and Designs use a dedicated host inside #app-main so the viewer shell
  // stays mounted even when those first two stages take over the main area.
  const sidebar = document.getElementById('app-sidebar');
  const viewerFrame = document.getElementById('viewer-frame');
  const viewer = document.getElementById('viewer');
  const viewerControls = document.getElementById('viewer-controls-container');
  const mainStageHost = document.getElementById('main-stage-host');
  if (managerState.current === 0 || managerState.current === 1) {
    log.info('Entering stage with dedicated main-stage host', { stage: managerState.current });
    if (sidebar) sidebar.style.display = 'none';
    if (viewerFrame) viewerFrame.style.display = 'none';
    if (viewer) viewer.style.display = 'none';
    if (viewerControls) viewerControls.style.display = 'none';
    if (mainStageHost) mainStageHost.hidden = false;

    try {
      const panelId = `stage-panel-${managerState.current}`;
      let panel = document.getElementById(panelId);
      const root = document.getElementById('stage-panels-root');
      const host = document.getElementById('main-stage-host');

      if (!panel && host) {
        panel = host.querySelector(`#${panelId}`);
      }

      if (root && host) {
        const displacedPanel = host.querySelector('[id^="stage-panel-"]');
        if (displacedPanel && displacedPanel.id !== panelId) {
          log.info('Restoring displaced stage panel before showing current stage', {
            panelId: displacedPanel.id
          });
          root.appendChild(displacedPanel);
        }
      }

      if (panel && host && panel.parentElement !== host) {
        log.info('Moving stage panel into main-stage host', {
          panelId,
          from: panel.parentElement?.id || null
        });
        if (!panel.dataset.wlOrigParent) panel.dataset.wlOrigParent = 'stage-panels-root';
        host.innerHTML = '';
        host.appendChild(panel);
      }

      if (!panel) {
        log.warn('Stage panel missing while entering models/designs stage', {
          stage: managerState.current,
          panelId
        });
      }

      const componentPath = 'components/ModelSelection.html';
      await new Promise(resolve => requestAnimationFrame(resolve));

      const placeholderId = `stage-${managerState.current}-placeholder`;
      let placeholder = document.getElementById(placeholderId);
      if (!placeholder && panel) {
        log.info('Creating missing stage placeholder inside sidebar panel', { placeholderId });
        panel.innerHTML = `<div id="${placeholderId}"></div>`;
        placeholder = document.getElementById(placeholderId);
      }

      const hasGrid = placeholder && placeholder.querySelector('.model-row-grid');
      if (placeholder && !hasGrid) {
        log.info('Loading selection component into sidebar stage panel', {
          stage: managerState.current,
          placeholderId
        });
        await loadComponent(placeholderId, componentPath);
      } else if (placeholder) {
        log.info('Selection component already present for stage', {
          stage: managerState.current,
          placeholderId
        });
      } else {
        log.warn('Could not find or create stage placeholder', {
          stage: managerState.current,
          placeholderId
        });
      }

      setTimeout(async () => {
        try {
          if (managerState.current === 0) {
            modelsStageModule.restoreFromState && modelsStageModule.restoreFromState(appState);
          } else if (managerState.current === 1) {
            try {
              const selectedModel = appState.selections && appState.selections.model;
              if (typeof window.__wlRenderDesignOptions === 'function') {
                await window.__wlRenderDesignOptions(selectedModel);
              }
            } catch (e) {
              log.warn('Failed to re-render designs on stage entry', e);
            }
            designsStageModule.restoreFromState && designsStageModule.restoreFromState(appState);
          }
        } catch (e) {
          log.warn('Failed to restore selections on stage change', e);
        }
      }, 100); // Small delay to ensure DOM is ready
    } catch (e) {
      log.warn('Failed to prepare stage 0/1 with persistent viewer', e);
    }
  } else {
    log.debug(`[setStage] Exiting stages 0/1, restoring sidebar (now at stage ${managerState.current})`);
    // restore sidebar and viewer/chrome visibility
    if (sidebar) sidebar.style.display = '';
    if (viewerFrame) viewerFrame.style.display = '';
    if (viewer) viewer.style.display = '';
    if (viewerControls) viewerControls.style.display = '';
    if (mainStageHost) mainStageHost.hidden = true;
    // Clean up the stage placeholders to avoid duplicates and restore panels
    try {
      for (let i = 0; i <= 1; i++) {
        const panelId = `stage-panel-${i}`;
        const ph = document.getElementById(`stage-${i}-placeholder`);
        // Do NOT clear innerHTML here if we are just switching between stage 0 and 1,
        // as they share the same component and clearing it might cause flicker or issues
        // if the DOM hasn't fully updated.
        // However, when exiting to stage 2+, we should clean up.
        if (ph && managerState.current > 1) ph.innerHTML = '';
        
        // If we previously moved stage panel out of the sidebar, put it back
        let panel = document.getElementById(panelId);
        const root = document.getElementById('stage-panels-root');
        const host = document.getElementById('main-stage-host');
        
        log.debug(`[setStage restore] Checking panel ${panelId}`, { found: !!panel, parentId: panel?.parentElement?.id });
        
        // Check both locations for the panel
        if (!panel && host) {
          panel = host.querySelector(`#${panelId}`);
          log.debug(`[setStage restore] Found ${panelId} in main-stage host`, { found: !!panel });
        }
        
        // Restore panel to root if it's not there already
        if (panel && root) {
          if (panel.parentElement !== root) {
            log.debug(`[setStage restore] Restoring ${panelId} from ${panel.parentElement?.id} to root`);
            root.appendChild(panel);
          } else {
            log.debug(`[setStage restore] ${panelId} already in root`);
          }
          delete panel.dataset.wlOrigParent;
        } else {
          log.warn(`[setStage restore] Could not restore ${panelId}`, { hasPanel: !!panel, hasRoot: !!root });
        }
      }
    } catch (e) { 
      log.error('[setStage restore] Error', e);
    }
    // Restore UI for non-model stages
    try {
      const s = appState;
      log.debug('Restoring stage', { stage: managerState.current, selections: s.selections });
      if (managerState.current === 2) materialsStage.restoreFromState && materialsStage.restoreFromState(s);
      if (managerState.current === 3) finishStage.restoreFromState && finishStage.restoreFromState(s);
      if (managerState.current === 4) {
        // Load dimensions panel component if not already loaded
        const dimPh = document.getElementById('dimensions-panel-placeholder');
        if (dimPh && dimPh.innerHTML === '') {
          await loadComponent('dimensions-panel-placeholder', 'components/DimensionsPanel.html');
          // Initialize dimensions stage now that the panel is loaded
          if (dimensionsStage.init) await dimensionsStage.init();
        }
        dimensionsStage.restoreFromState && dimensionsStage.restoreFromState(s);
      }
      if (managerState.current === 5) {
        log.debug('Entering Legs stage (5)', { model: s.selections.model });
        legsStage.restoreFromState && legsStage.restoreFromState(s);
      }
      if (managerState.current === 6) addonsStage.restoreFromState && addonsStage.restoreFromState(s);
      if (managerState.current === 7) summaryStage.restoreFromState && summaryStage.restoreFromState(s);
    } catch (e) { /* ignore */ }
  }

  // NOW toggle visibility classes for all panels (after moving them if needed)
  // show/hide stage content panels if present (convention: panels use id stage-panel-<index>)
  $all('[id^="stage-panel-"]').forEach(panel => {
    const idx = Number(panel.id.replace('stage-panel-', ''));
    panel.classList.toggle('is-hidden', idx !== managerState.current);
  });

  // Also hide/show the MaterialsPanel (containing materials-options and color-options containers)
  // only visible on stage 2 (Materials stage, now shifted due to Models/Designs)
  try {
    const materialsPanel = document.getElementById('materials-panel');
    if (materialsPanel) {
      materialsPanel.style.display = managerState.current === 2 ? '' : 'none';
    }
  } catch (e) {
    // ignore if materials panel not present
  }

  // Add a body-level class so CSS can easily show/hide model tiles across the app.
  // When not on the Models stage (now index 0), model tiles are hidden by default.
  try {
    document.body.classList.toggle('show-model-tiles', managerState.current === 0 || managerState.current === 1);
    // Add stage-specific classes for CSS visibility control
    for (let i = 0; i < STAGES.length; i++) {
      document.body.classList.toggle(`stage-${i}`, managerState.current === i);
    }
  } catch (e) {
    // document.body might not be available in some test contexts; ignore.
  }

  // Recompute and set accurate header height so main content doesn't tuck under it.
  try {
    const header = document.getElementById('app-header');
    if (header) {
      const h = header.offsetHeight || 0;
      document.documentElement.style.setProperty('--header-height', `${h}px`);
    }
  } catch (e) {
    // ignore
  }

  // Show only the sidebar info section that corresponds to the active stage (if present)
  try {
    const infos = document.querySelectorAll('#stage-info-root .sidebar-info');
    infos.forEach(sec => { sec.style.display = 'none'; });
    const active = document.getElementById(`info-stage-${managerState.current}`);
    if (active) active.style.display = '';
  } catch (e) {
    // ignore if stage info root not present
  }
  
  // After entering a stage, check if pre-selected options make it complete
  // This ensures stages with defaults (like Finish) are properly marked as complete
  // setTimeout(() => { // REMOVED: This causes infinite loop when combined with setStage calls
    try {
      if (managerState.current === 2) {
        // Materials stage: check if material, color, and color gradient are selected
        markCompleted(2, isMaterialsStageComplete(appState));
      } else if (managerState.current === 3) {
        // Finish stage: check if coating, sheen, and tint are all selected
        markCompleted(3, isFinishStageComplete(appState));
      } else if (managerState.current === 4) {
        // Dimensions stage: check if dimensions are selected
        markCompleted(4, hasSelectedDimensions(appState));
      } else if (managerState.current === 5) {
        markCompleted(5, isLegStageComplete(appState));
      }
      // Update button states after checking completion (buttons are updated via markCompleted)
    } catch (e) {
      log.warn('Failed to check stage completion after entering stage', e);
    }
  // }, 150);
}

function nextStage() {
  // If current stage isn't completed (and isn't optional), block advancing
  if (!isStageCompleteForNav(managerState.current)) {
    revealFirstMissingRequiredSelection();
    return;
  }
  setStage(Math.min(managerState.current + 1, STAGES.length - 1));
}

function prevStage() {
  setStage(Math.max(managerState.current - 1, 0));
}

function getCurrentStage() {
  return managerState.current;
}

function markCompleted(index, completed = true) {
  if (index < 0 || index >= STAGES.length) return;
  managerState.completed[index] = completed;
  updateStageButtons();
  updateNextButton();
}

function wireStageButtons() {
  $all('#stage-bar .stage-btn').forEach(btn => {
    const idx = Number(btn.getAttribute('data-stage-index'));
    btn.addEventListener('click', () => setStage(idx));
  });
}

export function initStageManager() {
  // initial wiring
  wireStageButtons();
  bindSummaryStageButtonLabelHandlers();
  const nextBtn = document.getElementById('next-stage-btn');
  if (nextBtn) nextBtn.addEventListener('click', () => nextStage());
  // Initialize models and designs stage modules which wire option-card clicks
  try {
    initModelsStage();
  } catch (e) {
    log.warn('Failed to initialize models stage module', e);
  }
  try {
    initDesignsStage();
  } catch (e) {
    log.warn('Failed to initialize designs stage module', e);
  }
  // Initialize remaining stage modules
  try { initMaterialsStage(); } catch (e) { log.warn('Failed to init materials stage', e); }
  try { initFinishStage(); } catch (e) { log.warn('Failed to init finish stage', e); }
  try { dimensionsStage.init && dimensionsStage.init(); } catch (e) { /* ignore */ }
  try { legsStage.init && legsStage.init(); } catch (e) { /* ignore */ }
  try { addonsStage.init && addonsStage.init(); } catch (e) { /* ignore */ }
  try { summaryStage.init && summaryStage.init(); } catch (e) { /* ignore */ }
  // Mark stages completed only when ALL required selections are made
  document.addEventListener('option-selected', (ev) => {
    const { category, id } = ev.detail || {};
    
    try {
      // Models stage (index 0): mark complete only when model is selected
      if (category === 'model') {
        const hasModel = !!(id || (appState.selections && appState.selections.model));
        markCompleted(0, !!hasModel);
        
        // When model changes, all other selections are cleared by main.js
        // Reset completion/opened status for all dependent stages (1-7)
        for (let i = 1; i < STAGES.length; i++) {
          managerState.completed[i] = false;
          managerState.opened[i] = false;
        }
        
        if (managerState.current === 0 && hasModel) {
          setStage(1, { skipConfirm: true });
        }
        return;
      }
      
      // Designs stage (index 1): mark complete only when design is selected
      if (category === 'design') {
        const hasDesign = !!(id || (appState.selections && appState.selections.design));
        markCompleted(1, !!hasDesign);
        return;
      }
      
      // For all other stages, validate completion based on current stage and update accordingly
      if (managerState.current === 2) {
        // Materials stage (index 2): require material, color, and color gradient
        markCompleted(2, isMaterialsStageComplete(appState));
      } else if (managerState.current === 3) {
        // Finish stage (index 3): require coating, sheen, and tint
        markCompleted(3, isFinishStageComplete(appState));
      } else if (managerState.current === 4) {
        // Dimensions stage (index 4): require a preset or custom dimensions selection
        // Check if a preset tile is selected or custom dimensions are provided
        markCompleted(4, hasSelectedDimensions(appState));
      } else if (managerState.current === 5) {
        markCompleted(5, isLegStageComplete(appState));
      }
      
      // Also check legs stage completion if any legs-related category is selected (for button enable/disable on transitions)
      if (category === 'legs' || category === 'tube-size' || category === 'leg-finish') {
        markCompleted(5, isLegStageComplete(appState));
      }
      // Stage 6 (Add-ons) is optional, so it's never marked as requiring completion
      // Stage 7 (Summary) is terminal; completion not tracked here
      
      // run a UI update to refresh Next/Prev/button states
      // setStage(managerState.current); // REMOVED: This causes infinite loop when triggered by state changes
    } catch (e) {
      log.warn('Error in option-selected handler', e);
    }

    refreshActiveValidationPrompt();
  });

  // Handle addon-toggled events (addons are optional, so this just updates UI)
  document.addEventListener('addon-toggled', () => {
    // Addons stage is optional, but update UI state in case user is on that stage
    if (managerState.current === 6) {
      setStage(managerState.current);
    }
  });
  document.addEventListener('statechange', refreshActiveValidationPrompt);
  document.addEventListener('input', refreshActiveValidationPrompt);
  document.addEventListener('change', refreshActiveValidationPrompt);
  document.addEventListener('click', refreshActiveValidationPrompt);

  updateLivePrice();
  setStage(0);
  scheduleSummaryStageButtonLabelUpdate();
}

// Use shared showBanner from ui/banner.js for consistent styling and accessibility.

// expose for debugging
window.__wlStage = { state: managerState, setStage, nextStage, prevStage, initStageManager };

export default { initStageManager, state: managerState, setStage, getCurrentStage };
