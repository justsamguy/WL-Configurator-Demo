// Dimensions stage module — handles length, width, height controls
// Dispatches 'option-selected' events; main.js handles state mutation
// Also dispatches 'request-stage-change' for Apply & Next button

import { state } from '../state.js';

let dimensionsData = null;
let currentDimensions = {
  length: null,
  width: null,
  height: 'standard',
  heightCustom: null
};
let selectedTileId = null; // Track which tile is currently selected (preset id or 'custom')



// Load dimensions data from JSON
async function loadDimensionsData() {
  if (dimensionsData) return dimensionsData;
  try {
    const response = await fetch('./data/dimensions.json');
    dimensionsData = await response.json();
    return dimensionsData;
  } catch (e) {
    console.error('Failed to load dimensions data:', e);
    return null;
  }
}

// Initialize current dimensions from preset if available
function initializeFromState(appState) {
  try {
    const dimSel = appState && appState.selections && appState.selections.options && appState.selections.options.dimensions;
    if (dimSel && dimensionsData) {
      // dimSel is expected to be a preset ID or custom object
      if (typeof dimSel === 'string') {
        const preset = dimensionsData.presets.find(p => p.id === dimSel);
        if (preset) {
          currentDimensions.length = preset.length;
          currentDimensions.width = preset.width;
          currentDimensions.height = preset.height;
          currentDimensions.heightCustom = preset.height === 'custom' ? preset.heightCustom : null;
        }
      } else if (typeof dimSel === 'object') {
        // Support custom dimension objects
        currentDimensions = { ...currentDimensions, ...dimSel };
      }
    } else if (!dimSel && dimensionsData && dimensionsData.presets.length > 0) {
      // No previous selection; select first available preset
      const firstPreset = dimensionsData.presets[0];
      currentDimensions.length = firstPreset.length;
      currentDimensions.width = firstPreset.width;
      currentDimensions.height = firstPreset.height;
      currentDimensions.heightCustom = firstPreset.height === 'custom' ? firstPreset.heightCustom : null;
    }
  } catch (e) {
    console.warn('Failed to initialize dimensions from state:', e);
  }
}

// Get constraints from data
function getConstraints() {
  if (!dimensionsData) return null;
  return dimensionsData.constraints;
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
  if (!constraints || !constraints.oversizeThresholds) return null;
  const threshold = constraints.oversizeThresholds[axis];
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
    return;
  }
  
  if (!validateAxisValue(axis, value)) {
    const constraints = getConstraints();
    const range = constraints[axis];
    validationEl.textContent = `Must be between ${range.min} and ${range.max}″`;
  } else {
    validationEl.textContent = '';
  }
}

// Render oversize banners
function updateOversizeBanners() {
  const bannersContainer = document.getElementById('dimensions-banners');
  if (!bannersContainer) return;
  
  bannersContainer.innerHTML = '';
  
  const checks = [
    { axis: 'length', value: currentDimensions.length },
    { axis: 'width', value: currentDimensions.width }
  ];
  
  checks.forEach(({ axis, value }) => {
    if (value === null) return;
    const message = checkOversizeThreshold(axis, value);
    if (message) {
      const banner = document.createElement('div');
      banner.className = 'oversize-banner bg-gray-100 border-l-4 border-amber-500 p-3 rounded text-sm';
      banner.innerHTML = `
        <div class="font-semibold text-gray-900 flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
          Oversize
        </div>
        <p class="text-gray-700 mt-1">${message}</p>
      `;
      bannersContainer.appendChild(banner);
    }
  });
}

// Show/hide custom dimension controls based on selection
function updateCustomFieldVisibility() {
  const lengthRow = document.getElementById('length-control-row');
  const widthRow = document.getElementById('width-control-row');
  
  console.log('updateCustomFieldVisibility() called. selectedTileId:', selectedTileId);
  console.log('lengthRow exists:', !!lengthRow, 'widthRow exists:', !!widthRow);
  
  // Show length/width fields only if "custom" tile is selected
  if (selectedTileId === 'custom') {
    console.log('Custom tile selected - showing fields');
    if (lengthRow) lengthRow.classList.remove('hidden');
    if (widthRow) widthRow.classList.remove('hidden');
  } else {
    console.log('Preset tile selected - hiding fields');
    if (lengthRow) lengthRow.classList.add('hidden');
    if (widthRow) widthRow.classList.add('hidden');
  }
}

// Update UI controls to reflect current state
function updateUIControls() {
  const lengthInput = document.getElementById('dim-length-input');
  const widthInput = document.getElementById('dim-width-input');
  const heightCustomInput = document.getElementById('dim-height-custom-input');
  const customHeightContainer = document.getElementById('custom-height-container');
  
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
  updateCustomFieldVisibility();
  updateHeightButtonSelection();
  updateApplyButtonState();
}

// Check if all required values are valid
function isComplete() {
  return (
    currentDimensions.length !== null && validateAxisValue('length', currentDimensions.length) &&
    currentDimensions.width !== null && validateAxisValue('width', currentDimensions.width) &&
    currentDimensions.height !== null &&
    (currentDimensions.height !== 'custom' || (currentDimensions.heightCustom !== null && validateAxisValue('height-custom', currentDimensions.heightCustom)))
  );
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
function dispatchDimensionSelection() {
  const payload = {
    ...currentDimensions,
    length: currentDimensions.length,
    width: currentDimensions.width,
    height: currentDimensions.height,
    heightCustom: currentDimensions.heightCustom
  };
  
  const heightPrice = getHeightPrice();
  
  document.dispatchEvent(new CustomEvent('option-selected', {
    detail: {
      id: 'dimensions-custom',
      price: heightPrice,
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

// Wire up preset selection
function initPresets() {
  console.log('initPresets() called. dimensionsData available:', !!dimensionsData);
  const presetsContainer = document.getElementById('dimensions-presets');
  console.log('presetsContainer found:', !!presetsContainer);
  
  if (!presetsContainer || !dimensionsData) {
    console.warn('initPresets early return - container or data missing');
    return;
  }
  
  presetsContainer.innerHTML = '';
  
  // Add preset tiles
  dimensionsData.presets.forEach(preset => {
    const tile = document.createElement('button');
    tile.className = 'option-card flex-shrink-0';
    tile.setAttribute('data-preset-id', preset.id);
    tile.setAttribute('aria-label', `${preset.title}: ${preset.length}″ × ${preset.width}″`);
    
    tile.innerHTML = `
      <div class="title">${preset.title}</div>
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
  customTile.setAttribute('aria-label', 'Custom dimensions');
  
  customTile.innerHTML = `
    <div class="title">Custom</div>
    <div class="description">Your custom size</div>
  `;
  
  customTile.addEventListener('click', () => {
    console.log('Custom tile clicked');
    // Custom tile selection
    selectedTileId = 'custom';
    console.log('selectedTileId set to:', selectedTileId);
    document.querySelectorAll('.option-card').forEach(t => t.classList.remove('selected'));
    customTile.classList.add('selected');
    updateCustomFieldVisibility();
  });
  
  presetsContainer.appendChild(customTile);
}

// Update custom field visibility based on manual tile selection
function updateTileSelection() {
  updateCustomFieldVisibility();
}

// Select a preset and apply its values
function selectPreset(preset, tileElement) {
  console.log('selectPreset() called with preset:', preset.id);
  
  currentDimensions.length = preset.length;
  currentDimensions.width = preset.width;
  currentDimensions.height = preset.height;
  currentDimensions.heightCustom = preset.height === 'custom' ? preset.heightCustom : null;
  
  // Mark this preset as selected
  selectedTileId = preset.id;
  console.log('selectedTileId set to:', selectedTileId);
  
  document.querySelectorAll('.option-card').forEach(t => t.classList.remove('selected'));
  if (tileElement) tileElement.classList.add('selected');
  
  // Update UI and dispatch
  updateUIControls();
  dispatchDimensionSelection();
  
  // Update field visibility
  updateCustomFieldVisibility();
}

// Wire up increment/decrement buttons
function initAxisControls() {
  const constraints = getConstraints();
  if (!constraints) return;
  
  const axisSteps = {
    length: constraints.length.step,
    width: constraints.width.step,
    'height-custom': 5 // arbitrary step for custom height
  };
  
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.control-button');
    if (!btn) return;
    
    const axis = btn.getAttribute('data-axis');
    if (!axis) return;
    
    const isIncrement = btn.classList.contains('increment');
    const step = axisSteps[axis] || 5;
    
    if (axis === 'length') {
      const newVal = currentDimensions.length + (isIncrement ? step : -step);
      if (validateAxisValue('length', newVal)) {
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
      if (validateAxisValue('width', newVal)) {
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
      if (validateAxisValue('length', value)) {
        currentDimensions.length = value;
        updateValidationMessage('length');
        updateOversizeBanners();
        updateApplyButtonState();
        updateCustomFieldVisibility();
        dispatchDimensionSelection();
      }
    } else if (axis === 'width') {
      if (validateAxisValue('width', value)) {
        currentDimensions.width = value;
        updateValidationMessage('width');
        updateOversizeBanners();
        updateApplyButtonState();
        updateCustomFieldVisibility();
        dispatchDimensionSelection();
      }
    } else if (axis === 'height-custom') {
      if (validateAxisValue('height-custom', value)) {
        currentDimensions.heightCustom = value;
        updateValidationMessage('height-custom');
        updateApplyButtonState();
        dispatchDimensionSelection();
      }
    }
  });
}

// Wire up height buttons
function initHeightButtons() {
  const heightOptions = document.getElementById('height-options');
  if (!heightOptions) return;
  
  // Height options: standard, bar, custom
  const heights = [
    { id: 'standard', title: 'Standard', subtitle: '(30″)', price: 0 },
    { id: 'bar', title: 'Bar Height', subtitle: '(42″)', price: 120 },
    { id: 'custom', title: 'Custom', subtitle: '(+$250)', price: 250 }
  ];
  
  heightOptions.innerHTML = '';
  
  heights.forEach(height => {
    const button = document.createElement('button');
    button.className = 'option-card';
    button.setAttribute('data-height-id', height.id);
    button.setAttribute('aria-label', `${height.title}${height.subtitle ? ' ' + height.subtitle : ''}`);
    
    button.innerHTML = `
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
  currentDimensions.height = heightId;
  currentDimensions.heightCustom = null;
  
  const customContainer = document.getElementById('custom-height-container');
  if (heightId === 'custom') {
    if (customContainer) customContainer.classList.remove('hidden');
    currentDimensions.heightCustom = 90; // Default custom height
    const customInput = document.getElementById('dim-height-custom-input');
    if (customInput) customInput.value = 90;
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
    document.querySelectorAll('.option-card').forEach(t => t.classList.remove('selected'));
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
  console.log('Dimensions stage init() called');
  
  // Load data first
  const data = await loadDimensionsData();
  if (!data) {
    console.error('Failed to load dimensions data');
    return;
  }
  console.log('Dimensions data loaded successfully');
  
  // Check if panel is already in DOM; if not, this will be called again when it is
  if (!document.getElementById('dimensions-stage-panel')) {
    console.log('Dimensions panel not yet in DOM; retrying in 200ms');
    // Wait a bit and retry
    setTimeout(init, 200);
    return;
  }
  
  console.log('Dimensions panel found in DOM, initializing...');
  
  // Initialize from current state
  initializeFromState(state);
  
  // Wire up controls
  initPresets();
  initAxisControls();
  initNumericInputs();
  initHeightButtons();
  initResetButton();
  initApplyButton();
  
  // Initial UI update
  updateUIControls();
  
  console.log('Dimensions stage initialization complete. selectedTileId:', selectedTileId);
}

// Restore state when dimensions stage becomes active
export function restoreFromState(appState) {
  try {
    initializeFromState(appState);
    updateUIControls();
  } catch (e) {
    console.warn('Failed to restore dimensions from state:', e);
  }
}

export default { init, restoreFromState };
