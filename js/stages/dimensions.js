// Dimensions stage module — handles length, width, height controls
// Dispatches 'option-selected' events; main.js handles state mutation
// Also dispatches 'request-stage-change' for Apply & Next button

import { state } from '../state.js';
import { createLogger } from '../logger.js';
import { requiresCenterLeg } from '../pricing.js';

const log = createLogger('Dimensions');
const CUSTOM_DIMENSIONS_IMAGE = 'assets/images/Custom Dimensions.png';
const CUSTOM_HEIGHT_IMAGE = 'assets/images/Generated Custom Height.png';

let dimensionsData = null;
let currentDimensions = {
  length: null,
  width: null,
  height: 'standard',
  heightCustom: null
};
let selectedTileId = null; // Track which tile is currently selected (preset id or 'custom')
let lastKnownModel = null; // Track the model to detect changes
let lastKnownDesign = null; // Track the design to detect round/non-round changes
let axisSteps = { length: 12, width: 6, 'height-custom': 6 };
let controlsWired = false;



// Load dimensions data from JSON
async function loadDimensionsData() {
  if (dimensionsData) return dimensionsData;
  try {
    const response = await fetch('./data/dimensions.json');
    dimensionsData = await response.json();
    return dimensionsData;
  } catch (e) {
    log.error('Failed to load dimensions data', e);
    return null;
  }
}

function getSelectedModelId() {
  return state && state.selections && state.selections.model;
}

function getSelectedDesignId() {
  return state && state.selections && state.selections.design;
}

function isRoundDesignSelected() {
  return getSelectedDesignId() === 'des-round';
}

// Reset dimensions to default state
function resetDimensions() {
  currentDimensions = {
    length: null,
    width: null,
    height: 'standard',
    heightCustom: null
  };
  selectedTileId = null;
  
  // Clear UI selections
  document.querySelectorAll('.option-card').forEach(t => t.classList.remove('selected'));
  
  // Clear validation messages and banners
  const bannersContainer = document.getElementById('dimensions-banners');
  if (bannersContainer) bannersContainer.innerHTML = '';
  
  document.querySelectorAll('.control-validation').forEach(el => el.textContent = '');
  
  // Reset input fields
  const lengthInput = document.getElementById('dim-length-input');
  const widthInput = document.getElementById('dim-width-input');
  const heightCustomInput = document.getElementById('dim-height-custom-input');
  if (lengthInput) lengthInput.value = '';
  if (widthInput) widthInput.value = '';
  if (heightCustomInput) heightCustomInput.value = '';
  
  log.debug('Reset dimensions state');
}

// Initialize current dimensions from preset if available
function initializeFromState(appState) {
  try {
    // Check if model has changed since last initialization
    const currentModel = appState && appState.selections && appState.selections.model;
    if (currentModel !== lastKnownModel) {
      log.debug('Model changed, resetting dimensions', { from: lastKnownModel, to: currentModel });
      resetDimensions();
      lastKnownModel = currentModel;
      return; // Don't restore old dimensions when model changes
    }
    
    const dimSel = appState && appState.selections && appState.selections.options && appState.selections.options.dimensions;
    const dimDetail = appState && appState.selections && appState.selections.dimensionsDetail;
    if ((dimSel || dimDetail) && dimensionsData) {
      const presetById = dimDetail && dimDetail.presetId
        ? dimensionsData.presets.find(p => p.id === dimDetail.presetId)
        : null;
      const presetBySize = dimDetail
        ? dimensionsData.presets.find(p => p.length === dimDetail.length && p.width === dimDetail.width)
        : null;
      const explicitCustom = dimSel === 'dimensions-custom' || (dimDetail && dimDetail.presetId === 'custom');
      const resolvedPreset = explicitCustom ? null : (presetById || presetBySize);
      if (dimDetail && typeof dimDetail === 'object') {
        // Restore from stored detail payload first
        currentDimensions = { ...currentDimensions, ...dimDetail };
        if (resolvedPreset && typeof dimDetail.height !== 'string') {
          currentDimensions.height = resolvedPreset.height;
        }
        selectedTileId = resolvedPreset ? resolvedPreset.id : 'custom';
      } else if (typeof dimSel === 'string') {
        if (dimSel === 'dimensions-custom') {
          selectedTileId = 'custom';
          return;
        }
        const preset = dimensionsData.presets.find(p => p.id === dimSel);
        if (preset) {
          currentDimensions.length = preset.length;
          currentDimensions.width = preset.width;
          currentDimensions.height = preset.height;
          currentDimensions.heightCustom = preset.height === 'custom' ? preset.heightCustom : null;
          selectedTileId = preset.id;
        }
      } else if (typeof dimSel === 'object') {
        // Support custom dimension objects (legacy shape)
        currentDimensions = { ...currentDimensions, ...dimSel };
        selectedTileId = 'custom';
      }
    }
    // Note: Do NOT auto-select first preset if no selection exists.
    // Stages should require explicit user selection; this respects the principle
    // that stage modules do not mutate state without user action.
  } catch (e) {
    log.warn('Failed to initialize dimensions from state', e);
  }
}

// Get model-specific constraints based on selected model
function getConstraints() {
  if (!dimensionsData) return null;
  
  // Get the currently selected model from state
  const selectedModel = getSelectedModelId();
  const selectedDesign = getSelectedDesignId();
  
  // Define model-specific constraints
  const modelConstraints = {
    'mdl-coffee': {
      length: { min: 24, max: 100, step: 12, unit: "in" },
      width: { min: 20, max: 60, step: 6, unit: "in" },
      height: { min: 14, max: 22, standard: 18, bar: 20, unit: "in" }
    },
    'mdl-dining': {
      length: { min: 72, max: 144, step: 12, unit: "in" },
      width: { min: 30, max: 70, step: 6, unit: "in" },
      height: { min: 26, max: 46, standard: 30, bar: 42, unit: "in" }
    },
    'mdl-conference': {
      length: { min: 72, max: 200, step: 12, unit: "in" },
      width: { min: 36, max: 75, step: 6, unit: "in" },
      height: { min: 26, max: 42, standard: 30, bar: 36, unit: "in" }
    }
  };

  const roundConstraints = {
    'mdl-coffee': {
      length: { min: 30, max: 60, step: 6, unit: 'in' },
      width: { min: 30, max: 60, step: 6, unit: 'in' }
    },
    'mdl-dining': {
      length: { min: 42, max: 60, step: 6, unit: 'in' },
      width: { min: 42, max: 60, step: 6, unit: 'in' }
    },
    'mdl-conference': {
      length: { min: 54, max: 72, step: 6, unit: 'in' },
      width: { min: 54, max: 72, step: 6, unit: 'in' }
    }
  };
  
  // Return model-specific constraints if model is selected, otherwise use default
  if (selectedModel && modelConstraints[selectedModel]) {
    if (selectedDesign === 'des-round' && roundConstraints[selectedModel]) {
      return {
        ...modelConstraints[selectedModel],
        ...roundConstraints[selectedModel],
        height: modelConstraints[selectedModel].height
      };
    }
    return modelConstraints[selectedModel];
  }
  
  // Fallback to default constraints from data
  return dimensionsData.constraints;
}

function getHeightOptionCards() {
  const constraints = getConstraints();
  const heightConstraints = constraints && constraints.height ? constraints.height : {};
  const selectedModel = getSelectedModelId();
  const standardHeight = Number(heightConstraints.standard);
  const barHeight = Number(heightConstraints.bar);
  const options = [{
    id: 'standard',
    title: 'Standard',
    subtitle: Number.isFinite(standardHeight) ? `(${standardHeight}″)` : '',
    price: 0,
    image: 'assets/images/Generated Sitting Height.png'
  }];

  if (
    selectedModel !== 'mdl-coffee'
    && Number.isFinite(barHeight)
    && barHeight > 0
  ) {
    options.push({
      id: 'bar',
      title: 'Bar Height',
      subtitle: `(${barHeight}″)`,
      price: 120,
      image: 'assets/images/Generated Standing Height.png'
    });
  }

  options.push({
    id: 'custom',
    title: 'Custom',
    subtitle: '(+$250)',
    price: 250,
    image: CUSTOM_HEIGHT_IMAGE
  });

  return options;
}

function getDefaultCustomHeightValue() {
  const constraints = getConstraints();
  const heightConstraints = constraints && constraints.height ? constraints.height : {};
  const barHeight = Number(heightConstraints.bar);
  const standardHeight = Number(heightConstraints.standard);
  const minHeight = Number(heightConstraints.min);
  const maxHeight = Number(heightConstraints.max);

  if (Number.isFinite(barHeight)) return barHeight;
  if (Number.isFinite(standardHeight)) return standardHeight;
  if (Number.isFinite(minHeight) && Number.isFinite(maxHeight)) {
    return Math.round((minHeight + maxHeight) / 2);
  }
  return 40;
}

function normalizeHeightSelectionForModel() {
  const availableOptions = getHeightOptionCards();
  const availableIds = new Set(availableOptions.map((option) => option.id));
  const currentHeight = currentDimensions.height;

  if (currentHeight === 'custom' && !Number.isFinite(Number(currentDimensions.heightCustom))) {
    currentDimensions.heightCustom = getDefaultCustomHeightValue();
    return;
  }

  if (availableIds.has(currentHeight)) return;

  if (currentHeight === 'bar' && availableIds.has('custom')) {
    currentDimensions.height = 'custom';
    currentDimensions.heightCustom = Number.isFinite(Number(currentDimensions.heightCustom))
      ? Number(currentDimensions.heightCustom)
      : getDefaultCustomHeightValue();
    return;
  }

  currentDimensions.height = availableIds.has('standard') ? 'standard' : (availableOptions[0]?.id || 'standard');
  if (currentDimensions.height === 'custom') {
    currentDimensions.heightCustom = Number.isFinite(Number(currentDimensions.heightCustom))
      ? Number(currentDimensions.heightCustom)
      : getDefaultCustomHeightValue();
  }
}

function updateAxisInputConstraints() {
  const constraints = getConstraints();
  if (!constraints) return;

  const lengthInput = document.getElementById('dim-length-input');
  const widthInput = document.getElementById('dim-width-input');
  const heightCustomInput = document.getElementById('dim-height-custom-input');

  if (constraints.length && lengthInput) {
    lengthInput.min = constraints.length.min;
    lengthInput.max = constraints.length.max;
    // Keep +/- controls on fixed increments while allowing free numeric input.
    lengthInput.step = 'any';
    axisSteps.length = constraints.length.step;
  }

  if (constraints.width && widthInput) {
    widthInput.min = constraints.width.min;
    widthInput.max = constraints.width.max;
    // Keep +/- controls on fixed increments while allowing free numeric input.
    widthInput.step = 'any';
    axisSteps.width = constraints.width.step;
  }

  if (heightCustomInput) {
    heightCustomInput.min = 16;
    heightCustomInput.max = 50;
    heightCustomInput.step = 'any';
  }
}

function updateAxisValidationDescriptions(axis, validationEl) {
  if (!validationEl || !validationEl.id) return;
  const hasMessage = validationEl.textContent.trim().length > 0;
  document.querySelectorAll(`.control-button[data-axis="${axis}"]`).forEach(btn => {
    if (hasMessage) btn.setAttribute('aria-describedby', validationEl.id);
    else btn.removeAttribute('aria-describedby');
  });
}

// Validate a single axis value
function validateAxisValue(axis, value) {
  const constraints = getConstraints();
  if (!constraints) return true;
  
  if (axis === 'length' || axis === 'width') {
    const range = constraints[axis];
    if (!range) return true;
    return value >= range.min && value <= range.max;
  }
  if (axis === 'height-custom') {
    // Custom height range: 16" to 50"
    return value >= 16 && value <= 50;
  }
  return true;
}

// Check if dimension exceeds oversize threshold
function checkOversizeThreshold(axis, value) {
  const constraints = getConstraints();
  const thresholds = (constraints && constraints.oversizeThresholds) || (dimensionsData && dimensionsData.oversizeThresholds);
  if (!thresholds) return null;
  const threshold = thresholds[axis];
  if (!threshold) return null;
  if (value > threshold.threshold) {
    return threshold.message;
  }
  return null;
}

// Update validation message for an axis
function updateValidationMessage(axis) {
  const validationEl = document.querySelector(`.control-validation[data-axis="${axis}"]`);
  if (!validationEl) return;
  
  let value = null;
  if (axis === 'length') value = currentDimensions.length;
  else if (axis === 'width') value = currentDimensions.width;
  else if (axis === 'height-custom') value = currentDimensions.heightCustom;
  
  if (value === null) {
    validationEl.textContent = '';
    updateAxisValidationDescriptions(axis, validationEl);
    return;
  }
  
  if (!validateAxisValue(axis, value)) {
    const constraints = getConstraints();
    const range = constraints[axis];
    validationEl.textContent = `Must be between ${range.min} and ${range.max}″`;
  } else {
    validationEl.textContent = '';
  }

  updateAxisValidationDescriptions(axis, validationEl);
}

// Render oversize banners
function updateOversizeBanners() {
  const bannersContainer = document.getElementById('dimensions-banners');
  if (!bannersContainer) return;

  bannersContainer.innerHTML = '';

  const appendBanner = (titleText, subtitleText) => {
    const banner = document.createElement('div');
    banner.className = 'summary-shipping-warning';
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-atomic', 'true');

    const textWrap = document.createElement('div');
    textWrap.className = 'summary-shipping-warning-text';

    const title = document.createElement('span');
    title.className = 'summary-shipping-warning-title';
    title.textContent = titleText;

    const subtitle = document.createElement('span');
    subtitle.className = 'summary-shipping-warning-subtitle';
    subtitle.textContent = subtitleText;

    textWrap.appendChild(title);
    textWrap.appendChild(subtitle);
    banner.appendChild(textWrap);
    bannersContainer.appendChild(banner);
  };

  if (currentDimensions.width !== null) {
    const oversizeWidthMessage = checkOversizeThreshold('width', currentDimensions.width);
    if (oversizeWidthMessage) appendBanner('Oversize width', oversizeWidthMessage);
  }

  const dimensionsState = {
    selections: {
      dimensionsDetail: {
        length: currentDimensions.length,
        width: currentDimensions.width,
        height: currentDimensions.height,
        heightCustom: currentDimensions.heightCustom
      }
    }
  };
  if (requiresCenterLeg(dimensionsState)) {
    appendBanner('Center leg required', 'Tables over 130" long require a center leg.');
  }
}

// Show/hide custom dimension controls based on selection
function updateCustomFieldVisibility() {
  const wrapper = document.getElementById('dimensions-custom-wrapper');
  
  // Show length/width fields only if "custom" tile is selected
  if (selectedTileId === 'custom') {
    if (wrapper) wrapper.classList.remove('hidden');
  } else {
    if (wrapper) wrapper.classList.add('hidden');
  }
}

function syncPresetTileSelection() {
  const presetsContainer = document.getElementById('dimensions-presets');
  if (!presetsContainer) return;

  const tiles = presetsContainer.querySelectorAll('.option-card[data-preset-id]');
  let selectedTile = null;
  tiles.forEach((tile) => {
    tile.classList.remove('selected');
    tile.setAttribute('aria-pressed', 'false');
    if (selectedTileId && tile.getAttribute('data-preset-id') === selectedTileId) {
      selectedTile = tile;
    }
  });

  if (selectedTile) {
    selectedTile.classList.add('selected');
    selectedTile.setAttribute('aria-pressed', 'true');
  }
}

// Update UI controls to reflect current state
function updateUIControls() {
  const lengthInput = document.getElementById('dim-length-input');
  const widthInput = document.getElementById('dim-width-input');
  const heightCustomInput = document.getElementById('dim-height-custom-input');
  const customHeightContainer = document.getElementById('custom-height-container');

  if (isRoundDesignSelected() && Number.isFinite(currentDimensions.length) && Number.isFinite(currentDimensions.width)) {
    currentDimensions.width = currentDimensions.length;
  }

  updateAxisInputConstraints();
  normalizeHeightSelectionForModel();
  
  if (lengthInput && currentDimensions.length !== null) {
    lengthInput.value = currentDimensions.length;
  }
  if (widthInput && currentDimensions.width !== null) {
    widthInput.value = currentDimensions.width;
  }
  
  if (currentDimensions.height === 'custom') {
    if (customHeightContainer) customHeightContainer.classList.remove('hidden');
    if (heightCustomInput && currentDimensions.heightCustom) {
      heightCustomInput.value = currentDimensions.heightCustom;
    }
  } else {
    if (customHeightContainer) customHeightContainer.classList.add('hidden');
  }
  
  updateValidationMessage('length');
  updateValidationMessage('width');
  updateValidationMessage('height-custom');
  updateOversizeBanners();
  syncPresetTileSelection();
  updateCustomFieldVisibility();
  updateHeightButtonSelection();
  updateApplyButtonState();
}

// Check if all required values are valid
function isComplete() {
  const roundDimensionsValid = !isRoundDesignSelected() || currentDimensions.length === currentDimensions.width;
  return (
    !hasVisibleRangeInvalidInput() &&
    roundDimensionsValid &&
    currentDimensions.length !== null && validateAxisValue('length', currentDimensions.length) &&
    currentDimensions.width !== null && validateAxisValue('width', currentDimensions.width) &&
    currentDimensions.height !== null &&
    (currentDimensions.height !== 'custom' || (currentDimensions.heightCustom !== null && validateAxisValue('height-custom', currentDimensions.heightCustom)))
  );
}

function hasVisibleRangeInvalidInput() {
  const panel = document.getElementById('dimensions-stage-panel');
  if (!panel) return false;

  const inputs = panel.querySelectorAll('.control-input');
  return Array.from(inputs).some((input) => {
    if (input.closest('.hidden') || input.offsetParent === null) return false;
    const validity = input.validity;
    if (!validity) return false;
    return validity.rangeUnderflow || validity.rangeOverflow || validity.badInput;
  });
}

// Update apply button state
function updateApplyButtonState() {
  const applyBtn = document.getElementById('dim-apply-next-btn');
  if (applyBtn) {
    applyBtn.disabled = !isComplete();
  }
}

// Calculate height price adjustment based on current height selection
function getHeightPrice() {
  if (currentDimensions.height === 'bar') {
    return 120;
  } else if (currentDimensions.height === 'custom') {
    return 250;
  }
  return 0; // standard
}

// Dispatch option-selected event to trigger state update in main.js
function getDimensionOptionId() {
  if (selectedTileId && selectedTileId !== 'custom') return selectedTileId;
  return 'dimensions-custom';
}

function dispatchDimensionSelection(price = 0) {
  const optionId = getDimensionOptionId();
  const payload = {
    ...currentDimensions,
    length: currentDimensions.length,
    width: currentDimensions.width,
    height: currentDimensions.height,
    heightCustom: currentDimensions.heightCustom,
    presetId: selectedTileId || null
  };

  document.dispatchEvent(new CustomEvent('option-selected', {
    detail: {
      id: optionId,
      price: price,
      category: 'dimensions',
      payload
    }
  }));

  // Announce to screen readers
  const liveRegion = document.getElementById('dim-live-region');
  if (liveRegion) {
    liveRegion.textContent = `Dimensions set to ${currentDimensions.length}″ × ${currentDimensions.width}″, height ${currentDimensions.height}`;
  }
}

// Filter presets based on model-specific constraints
function filterPresetsByModel(presets) {
  const constraints = getConstraints();
  if (!constraints) return presets;

  const selectedModel = getSelectedModelId();
  const selectedDesign = getSelectedDesignId();
  const roundDesignActive = selectedDesign === 'des-round';

  // Model-specific preset exclusions
  const modelExclusions = {
    'mdl-coffee': ['dim-preset-01', 'dim-preset-02', 'dim-preset-03'], // Hide 4-6, 6-8, 8-10 seaters for coffee tables
    'mdl-conference': ['dim-preset-01'] // Hide 4-6 seater for conference tables
  };

  const excludedIds = modelExclusions[selectedModel] || [];

  return presets.filter(preset => {
    const designScope = Array.isArray(preset.designScope) ? preset.designScope : null;
    const modelScope = Array.isArray(preset.modelScope) ? preset.modelScope : null;

    if (roundDesignActive) {
      if (!designScope || !designScope.includes('des-round')) return false;
    } else if (designScope && designScope.includes('des-round')) {
      return false;
    }

    if (modelScope && !modelScope.includes(selectedModel)) return false;

    // Check model-specific exclusions first
    if (!roundDesignActive && excludedIds.includes(preset.id)) return false;

    // Then check technical constraints
    const lengthValid = preset.length >= constraints.length.min && preset.length <= constraints.length.max;
    const widthValid = preset.width >= constraints.width.min && preset.width <= constraints.width.max;
    return lengthValid && widthValid;
  });
}

// Wire up preset selection
function initPresets() {
  const presetsContainer = document.getElementById('dimensions-presets');
  if (!presetsContainer || !dimensionsData) return;
  
  presetsContainer.innerHTML = '';
  
  // Filter presets based on selected model constraints
  const filteredPresets = filterPresetsByModel(dimensionsData.presets);
  
  // Add preset tiles (only those valid for the selected model)
  filteredPresets.forEach(preset => {
    const presetTitle = preset.displayTitle || preset.title;
    const tile = document.createElement('button');
    tile.className = 'option-card flex-shrink-0';
    tile.setAttribute('data-preset-id', preset.id);
    tile.setAttribute('data-ignore-placeholder', 'true');
    tile.setAttribute('aria-label', `${presetTitle}: ${preset.length}″ × ${preset.width}″`);

    tile.innerHTML = `
      ${preset.image ? `<img src="${preset.image}" alt="${presetTitle}" class="w-full h-24 object-cover rounded-t mb-2">` : ''}
      <div class="title">${presetTitle}</div>
      <div class="description">${preset.length}″ × ${preset.width}″${preset.description ? ' — ' + preset.description : ''}</div>
    `;

    tile.addEventListener('click', () => {
      selectPreset(preset, tile);
    });

    presetsContainer.appendChild(tile);
  });
  
  // Add "Custom" tile
  const customTile = document.createElement('button');
  customTile.className = 'option-card flex-shrink-0';
  customTile.setAttribute('data-preset-id', 'custom');
  customTile.setAttribute('data-ignore-placeholder', 'true');
  customTile.setAttribute('aria-label', 'Custom dimensions');
  
  customTile.innerHTML = `
    <img src="${CUSTOM_DIMENSIONS_IMAGE}" alt="Custom dimensions" class="w-full h-24 object-cover rounded-t mb-2">
    <div class="title">Custom</div>
    <div class="description">Your custom size</div>
  `;
  
  customTile.addEventListener('click', () => {
    // Custom tile selection
    selectedTileId = 'custom';
    syncPresetTileSelection();
    updateCustomFieldVisibility();
  });
  
  presetsContainer.appendChild(customTile);
  syncPresetTileSelection();
}

// Update custom field visibility based on manual tile selection
function updateTileSelection() {
  updateCustomFieldVisibility();
}

// Select a preset and apply its values
function selectPreset(preset, tileElement) {
  currentDimensions.length = preset.length;
  currentDimensions.width = preset.width;
  currentDimensions.height = preset.height;
  currentDimensions.heightCustom = preset.height === 'custom' ? preset.heightCustom : null;

  // Mark this preset as selected
  selectedTileId = preset.id;
  if (tileElement) tileElement.setAttribute('aria-pressed', 'true');
  syncPresetTileSelection();

  // Update UI and dispatch
  updateUIControls();
  const totalPrice = preset.price + getHeightPrice();
  dispatchDimensionSelection(totalPrice);

  // Update field visibility
  updateCustomFieldVisibility();
}

// Wire up increment/decrement buttons
function initAxisControls() {
  const constraints = getConstraints();
  if (!constraints) return;
  
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.control-button');
    if (!btn) return;
    
    const axis = btn.getAttribute('data-axis');
    if (!axis) return;
    
    const isIncrement = btn.classList.contains('increment');
    const step = axisSteps[axis] || 5;
    
    if (axis === 'length') {
      const newVal = currentDimensions.length + (isIncrement ? step : -step);
      if (isRoundDesignSelected()) {
        if (validateAxisValue('length', newVal) && validateAxisValue('width', newVal)) {
          currentDimensions.length = newVal;
          currentDimensions.width = newVal;
          document.getElementById('dim-length-input').value = newVal;
          document.getElementById('dim-width-input').value = newVal;
          updateValidationMessage('length');
          updateValidationMessage('width');
          updateOversizeBanners();
          updateApplyButtonState();
          updateCustomFieldVisibility();
          dispatchDimensionSelection();
        }
      } else if (validateAxisValue('length', newVal)) {
        currentDimensions.length = newVal;
        document.getElementById('dim-length-input').value = newVal;
        updateValidationMessage('length');
        updateOversizeBanners();
        updateApplyButtonState();
        updateCustomFieldVisibility();
        dispatchDimensionSelection();
      }
    } else if (axis === 'width') {
      const newVal = currentDimensions.width + (isIncrement ? step : -step);
      if (isRoundDesignSelected()) {
        if (validateAxisValue('length', newVal) && validateAxisValue('width', newVal)) {
          currentDimensions.length = newVal;
          currentDimensions.width = newVal;
          document.getElementById('dim-length-input').value = newVal;
          document.getElementById('dim-width-input').value = newVal;
          updateValidationMessage('length');
          updateValidationMessage('width');
          updateOversizeBanners();
          updateApplyButtonState();
          updateCustomFieldVisibility();
          dispatchDimensionSelection();
        }
      } else if (validateAxisValue('width', newVal)) {
        currentDimensions.width = newVal;
        document.getElementById('dim-width-input').value = newVal;
        updateValidationMessage('width');
        updateOversizeBanners();
        updateApplyButtonState();
        updateCustomFieldVisibility();
        dispatchDimensionSelection();
      }
    } else if (axis === 'height-custom') {
      const newVal = currentDimensions.heightCustom + (isIncrement ? step : -step);
      if (validateAxisValue('height-custom', newVal)) {
        currentDimensions.heightCustom = newVal;
        document.getElementById('dim-height-custom-input').value = newVal;
        updateValidationMessage('height-custom');
        updateApplyButtonState();
        dispatchDimensionSelection();
      }
    }
  });
}

// Wire up numeric inputs
function initNumericInputs() {
  document.addEventListener('input', (ev) => {
    const input = ev.target.closest('.control-input');
    if (!input) return;
    
    const axis = input.getAttribute('data-axis');
    const value = parseInt(input.value, 10);
    
    if (isNaN(value)) return;
    
    if (axis === 'length') {
      if (isRoundDesignSelected()) {
        if (validateAxisValue('length', value) && validateAxisValue('width', value)) {
          currentDimensions.length = value;
          currentDimensions.width = value;
          const widthInput = document.getElementById('dim-width-input');
          if (widthInput) widthInput.value = value;
          dispatchDimensionSelection();
        }
      } else if (validateAxisValue('length', value)) {
        currentDimensions.length = value;
        dispatchDimensionSelection();
      }
      updateValidationMessage('length');
      updateValidationMessage('width');
      updateOversizeBanners();
      updateApplyButtonState();
      updateCustomFieldVisibility();
    } else if (axis === 'width') {
      if (isRoundDesignSelected()) {
        if (validateAxisValue('length', value) && validateAxisValue('width', value)) {
          currentDimensions.length = value;
          currentDimensions.width = value;
          const lengthInput = document.getElementById('dim-length-input');
          if (lengthInput) lengthInput.value = value;
          dispatchDimensionSelection();
        }
      } else if (validateAxisValue('width', value)) {
        currentDimensions.width = value;
        dispatchDimensionSelection();
      }
      updateValidationMessage('length');
      updateValidationMessage('width');
      updateOversizeBanners();
      updateApplyButtonState();
      updateCustomFieldVisibility();
    } else if (axis === 'height-custom') {
      if (validateAxisValue('height-custom', value)) {
        currentDimensions.heightCustom = value;
        dispatchDimensionSelection();
      }
      updateValidationMessage('height-custom');
      updateApplyButtonState();
    }
  });
}

// Wire up height buttons
function initHeightButtons() {
  const heightOptions = document.getElementById('height-options');
  if (!heightOptions) return;

  normalizeHeightSelectionForModel();
  const heights = getHeightOptionCards();
  heightOptions.innerHTML = '';
  
  heights.forEach(height => {
    const button = document.createElement('button');
    button.className = 'option-card';
    button.setAttribute('data-height-id', height.id);
    button.setAttribute('aria-label', `${height.title}${height.subtitle ? ' ' + height.subtitle : ''}`);
    
    button.innerHTML = `
      ${height.image ? `<img src="${height.image}" alt="${height.title}" class="w-full h-24 object-cover rounded-t mb-2">` : ''}
      <div class="title">${height.title} ${height.subtitle}</div>
      <div class="description">+$${height.price}</div>
    `;
    
    button.addEventListener('click', () => {
      selectHeight(height.id);
    });
    
    heightOptions.appendChild(button);
  });
  
  // Update selection on init
  updateHeightButtonSelection();
}

// Select a height option
function selectHeight(heightId) {
  const previousCustomHeight = currentDimensions.heightCustom;
  currentDimensions.height = heightId;
  currentDimensions.heightCustom = null;

  const customContainer = document.getElementById('custom-height-container');
  if (heightId === 'custom') {
    const defaultCustomHeight = Number.isFinite(Number(previousCustomHeight))
      ? Number(previousCustomHeight)
      : getDefaultCustomHeightValue();
    if (customContainer) customContainer.classList.remove('hidden');
    currentDimensions.heightCustom = defaultCustomHeight;
    const customInput = document.getElementById('dim-height-custom-input');
    if (customInput) customInput.value = defaultCustomHeight;
  } else {
    if (customContainer) customContainer.classList.add('hidden');
  }

  updateHeightButtonSelection();
  updateValidationMessage('height-custom');
  updateApplyButtonState();
  dispatchDimensionSelection();
}

// Update height button selection state
function updateHeightButtonSelection() {
  document.querySelectorAll('[data-height-id]').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  const activeBtn = document.querySelector(`[data-height-id="${currentDimensions.height}"]`);
  if (activeBtn) {
    activeBtn.classList.add('selected');
  }
}

// Wire up "Cut to" checkboxes

// Wire up Reset button
function initResetButton() {
  const resetBtn = document.getElementById('dim-reset-btn');
  if (!resetBtn) return;
  
  resetBtn.addEventListener('click', () => {
    currentDimensions = {
      length: null,
      width: null,
      height: 'standard',
      heightCustom: null
    };
    
    updateUIControls();
    
    // Clear tile selections
    selectedTileId = null;
    syncPresetTileSelection();
  });
}

// Wire up Apply & Next button
function initApplyButton() {
  const applyBtn = document.getElementById('dim-apply-next-btn');
  if (!applyBtn) return;
  
  applyBtn.addEventListener('click', () => {
    if (isComplete()) {
      // Dispatch stage change event
      document.dispatchEvent(new CustomEvent('request-stage-change', {
        detail: { direction: 'next' }
      }));
    }
  });
}

// Initialize the dimensions stage
// This is called after the DimensionsPanel component is loaded into the DOM
export async function init() {
  // Load data first
  const data = await loadDimensionsData();
  if (!data) {
    log.error('Failed to load dimensions data');
    return;
  }
  
  // Check if panel is already in DOM; if not, this will be called again when it is
  if (!document.getElementById('dimensions-stage-panel')) {
    // Wait a bit and retry
    setTimeout(init, 200);
    return;
  }
  
  // Initialize from current state
  initializeFromState(state);
  lastKnownDesign = getSelectedDesignId();
  
  // Wire up controls
  initPresets();
  initHeightButtons();
  if (!controlsWired) {
    initAxisControls();
    initNumericInputs();
    initResetButton();
    initApplyButton();
    controlsWired = true;
  }
  
  // Initial UI update
  updateUIControls();
}

// Restore state when dimensions stage becomes active
export function restoreFromState(appState) {
  try {
    // Check if model has changed and reset if needed
    const currentModel = appState && appState.selections && appState.selections.model;
    const currentDesign = appState && appState.selections && appState.selections.design;
    const modelChanged = currentModel !== lastKnownModel;
    const designChanged = currentDesign !== lastKnownDesign;

    if (modelChanged) {
      log.debug('Model changed in restoreFromState, resetting');
      resetDimensions();
    }

    if (modelChanged || designChanged) {
      lastKnownModel = currentModel;
      lastKnownDesign = currentDesign;
      initPresets();
      initHeightButtons();
    }
    
    initializeFromState(appState);
    updateUIControls();
  } catch (e) {
    log.warn('Failed to restore dimensions from state', e);
  }
}

export default { init, restoreFromState };
