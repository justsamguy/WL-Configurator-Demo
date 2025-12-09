// Legs stage module
// Handles single-choice legs options, tube size, and leg finish (color)
// With model-based filtering and incompatibility constraints
import { getVisibleLegs, getAvailableTubeSizes, getTubeIncompatibilityReasons, isTubeCompatibleWithLeg, isTubeCompatibleWithModel } from './legCompatibility.js';

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
    } else if (tubeSizeCard && !tubeSizeCard.hasAttribute('disabled')) {
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
 */
export function recomputeTubeSizeConstraints() {
  try {
    const selectedLegEl = document.querySelector('.option-card[data-category="legs"][aria-pressed="true"]');
    const selectedLegId = selectedLegEl && selectedLegEl.getAttribute('data-id');
    
    // Get currently selected model from model cards (may be in sidebar or stage panel)
    const selectedModelEl = document.querySelector('.option-card[data-id^="mdl-"][aria-pressed="true"]');
    const selectedModelId = selectedModelEl && selectedModelEl.getAttribute('data-id');
    
    // Clear all tube size constraints first
    document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(el => {
      el.removeAttribute('data-disabled-by');
      el.removeAttribute('data-tooltip');
      el.removeAttribute('disabled');
    });
    
    // Apply constraints if both leg and model are selected
    if (selectedLegId && selectedModelId) {
      document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(el => {
        const tubeId = el.getAttribute('data-id');
        const reasons = getTubeIncompatibilityReasons(tubeId, selectedLegId, selectedModelId);
        
        if (reasons.length > 0) {
          el.setAttribute('disabled', 'true');
          el.setAttribute('data-disabled-by', reasons.join('||'));
          el.setAttribute('data-tooltip', `Only compatible with ${reasons.join(', ')}`);
        }
      });
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
  
  console.log('updateLegsUIVisibility called with legId:', legId, { tubeSizeHeading, tubeSizeOptions, legFinishHeading, legFinishOptions });
  
  if (legId === 'leg-none') {
    // Hide tube size and leg finish sections (both heading and container)
    if (tubeSizeHeading) { tubeSizeHeading.style.display = 'none'; console.log('Hidden tubeSizeHeading'); }
    if (tubeSizeOptions) { tubeSizeOptions.style.display = 'none'; console.log('Hidden tubeSizeOptions'); }
    if (legFinishHeading) { legFinishHeading.style.display = 'none'; console.log('Hidden legFinishHeading'); }
    if (legFinishOptions) { legFinishOptions.style.display = 'none'; console.log('Hidden legFinishOptions'); }
    // Clear any existing selections when "none" is chosen
    document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(c => {
      c.setAttribute('aria-pressed', 'false');
    });
    document.querySelectorAll('.option-card[data-category="leg-finish"]').forEach(c => {
      c.setAttribute('aria-pressed', 'false');
    });
  } else {
    // Show tube size and leg finish sections (both heading and container)
    if (tubeSizeHeading) { tubeSizeHeading.style.display = ''; console.log('Showed tubeSizeHeading'); }
    if (tubeSizeOptions) { tubeSizeOptions.style.display = ''; console.log('Showed tubeSizeOptions'); }
    if (legFinishHeading) { legFinishHeading.style.display = ''; console.log('Showed legFinishHeading'); }
    if (legFinishOptions) { legFinishOptions.style.display = ''; console.log('Showed legFinishOptions'); }
  }
}

export default { init, restoreFromState, updateLegsUIVisibility, recomputeTubeSizeConstraints };
