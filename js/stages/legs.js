// Legs stage module
// Handles single-choice legs options, tube size, and leg finish (color)
// With model-based filtering and incompatibility constraints
import { getVisibleLegs, getAvailableTubeSizes, getTubeIncompatibilityReasons, isTubeCompatibleWithLeg, isTubeCompatibleWithModel } from './legCompatibility.js';
import { state } from '../state.js';

export function init() {
  document.addEventListener('click', (ev) => {
    const legCard = ev.target.closest && ev.target.closest('.option-card[data-category="legs"]');
    const tubeSizeCard = ev.target.closest && ev.target.closest('.option-card[data-category="tube-size"]');
    const legFinishCard = ev.target.closest && ev.target.closest('.option-card[data-category="leg-finish"]');

    if (legCard && !legCard.hasAttribute('disabled')) {
      document.querySelectorAll('.option-card[data-category="legs"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      legCard.setAttribute('aria-pressed', 'true');
      const id = legCard.getAttribute('data-id');
      const price = Number(legCard.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: 'legs' } }));
      // Hide/show tube size and leg finish sections based on whether "none" is selected
      updateLegsUIVisibility(id);
      // If "leg-none" is selected, also clear the dependent tube-size and leg-finish selections in state
      if (id === 'leg-none') {
        document.dispatchEvent(new CustomEvent('legs-none-selected'));
      }
      // Recompute tube size constraints when leg changes
      recomputeTubeSizeConstraints();
    } else if (tubeSizeCard) {
      // Check if the tube size card is disabled; if so, don't allow selection
      console.log('[Legs] Tube size card clicked:', tubeSizeCard.getAttribute('data-id'), 'disabled:', tubeSizeCard.hasAttribute('disabled'));
      if (tubeSizeCard.hasAttribute('disabled')) {
        console.log('[Legs] Blocking selection of disabled tube size');
        return; // Block selection of disabled tube sizes
      }
      document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      tubeSizeCard.setAttribute('aria-pressed', 'true');
      const id = tubeSizeCard.getAttribute('data-id');
      const price = Number(tubeSizeCard.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: 'tube-size' } }));
    } else if (legFinishCard && !legFinishCard.hasAttribute('disabled')) {
      document.querySelectorAll('.option-card[data-category="leg-finish"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      legFinishCard.setAttribute('aria-pressed', 'true');
      const id = legFinishCard.getAttribute('data-id');
      const price = Number(legFinishCard.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category: 'leg-finish' } }));
    }
  });
}

/**
 * Recompute tube size constraints based on selected leg and model
 * Similar pattern to recomputeFinishConstraints: manages disabled states and tooltips
 */
export function recomputeTubeSizeConstraints() {
  try {
    const selectedLegEl = document.querySelector('.option-card[data-category="legs"][aria-pressed="true"]');
    const selectedLegId = selectedLegEl && selectedLegEl.getAttribute('data-id');
    
    // Get the selected model from application state (more reliable than searching DOM)
    const selectedModelId = state.selections && state.selections.model;
    
    console.log('[Legs] recomputeTubeSizeConstraints - selectedLeg:', selectedLegId, 'selectedModel:', selectedModelId);
    
    // Helper: get list of disabled-by sources from element
    function _getDisabledByList(el) {
      const raw = el.getAttribute('data-disabled-by') || '';
      return raw ? raw.split('||').filter(Boolean) : [];
    }
    
    // Helper: add a source to the disabled-by list and mark element as disabled
    function addDisabledBy(el, sourceTitle) {
      if (!el) return;
      const title = (sourceTitle || '').trim();
      if (!title) return;
      const list = _getDisabledByList(el);
      if (!list.includes(title)) list.push(title);
      el.setAttribute('data-disabled-by', list.join('||'));
      el.setAttribute('disabled', 'true');
      el.setAttribute('data-tooltip', `Incompatible with ${list.join(', ')}`);
      console.log('[Legs] Disabled tube', el.getAttribute('data-id'), 'because of:', sourceTitle);
    }
    
    // Helper: clear all disabled-by sources from element
    function clearAllDisabledBy(el) {
      if (!el) return;
      el.removeAttribute('data-disabled-by');
      el.removeAttribute('data-tooltip');
      el.removeAttribute('disabled');
    }
    
    // Clear all tube size constraints first
    document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(el => {
      clearAllDisabledBy(el);
    });
    
    // Apply constraints if both leg and model are selected
    if (selectedLegId && selectedModelId) {
      const currentlySelectedTubeEl = document.querySelector('.option-card[data-category="tube-size"][aria-pressed="true"]');
      const currentlySelectedTubeId = currentlySelectedTubeEl && currentlySelectedTubeEl.getAttribute('data-id');
      let selectedTubeWasDisabled = false;
      let disabledCount = 0;
      
      document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(el => {
        const tubeId = el.getAttribute('data-id');
        const reasons = getTubeIncompatibilityReasons(tubeId, selectedLegId, selectedModelId);
        
        // reasons is an array of incompatible sources (e.g., ["Cube", "model"])
        reasons.forEach(reason => {
          addDisabledBy(el, reason);
        });
        
        if (reasons.length > 0) {
          disabledCount++;
        }
        
        // Track if the currently selected tube size was just disabled
        if (tubeId === currentlySelectedTubeId && reasons.length > 0) {
          selectedTubeWasDisabled = true;
        }
      });
      
      console.log('[Legs] Disabled', disabledCount, 'tube sizes. Currently selected:', currentlySelectedTubeId, 'was disabled:', selectedTubeWasDisabled);
      
      // If the currently selected tube size is now incompatible, clear the selection and notify state
      if (selectedTubeWasDisabled && currentlySelectedTubeId) {
        if (currentlySelectedTubeEl) {
          currentlySelectedTubeEl.setAttribute('aria-pressed', 'false');
        }
        // Dispatch event to clear the incompatible tube size from state
        document.dispatchEvent(new CustomEvent('tube-size-cleared-due-to-incompatibility'));
      }
    }
  } catch (e) {
    console.warn('Failed to recompute tube size constraints:', e);
  }
}

export function restoreFromState(state) {
  try {
    const legId = state && state.selections && state.selections.options && state.selections.options.legs;
    if (legId) {
      const el = document.querySelector(`.option-card[data-id="${legId}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="legs"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
        // Update UI visibility based on selected leg
        updateLegsUIVisibility(legId);
      }
    }

    const tubeSizeId = state && state.selections && state.selections.options && state.selections.options['tube-size'];
    if (tubeSizeId) {
      const el = document.querySelector(`.option-card[data-id="${tubeSizeId}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    }

    const legFinishId = state && state.selections && state.selections.options && state.selections.options['leg-finish'];
    if (legFinishId) {
      const el = document.querySelector(`.option-card[data-id="${legFinishId}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="leg-finish"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    }

    // Recompute constraints after restoring
    recomputeTubeSizeConstraints();
  } catch (e) { /* ignore */ }
}

/**
 * Show/hide tube size and leg finish sections based on leg selection
 * If "leg-none" is selected, hide both sections; otherwise show them
 */
export function updateLegsUIVisibility(legId) {
  const tubeSizeOptions = document.querySelector('#tube-size-options');
  const legFinishOptions = document.querySelector('#leg-finish-options');
  
  // Find the h4 headings before these containers
  const tubeSizeHeading = tubeSizeOptions?.previousElementSibling;
  const legFinishHeading = legFinishOptions?.previousElementSibling;
  
  if (legId === 'leg-none') {
    // Hide tube size and leg finish sections (both heading and container)
    if (tubeSizeHeading) tubeSizeHeading.style.display = 'none';
    if (tubeSizeOptions) tubeSizeOptions.style.display = 'none';
    if (legFinishHeading) legFinishHeading.style.display = 'none';
    if (legFinishOptions) legFinishOptions.style.display = 'none';
    // Clear any existing selections when "none" is chosen
    document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(c => {
      c.setAttribute('aria-pressed', 'false');
    });
    document.querySelectorAll('.option-card[data-category="leg-finish"]').forEach(c => {
      c.setAttribute('aria-pressed', 'false');
    });
  } else {
    // Show tube size and leg finish sections (both heading and container)
    if (tubeSizeHeading) tubeSizeHeading.style.display = '';
    if (tubeSizeOptions) tubeSizeOptions.style.display = '';
    if (legFinishHeading) legFinishHeading.style.display = '';
    if (legFinishOptions) legFinishOptions.style.display = '';
  }
}

export default { init, restoreFromState, updateLegsUIVisibility, recomputeTubeSizeConstraints };
