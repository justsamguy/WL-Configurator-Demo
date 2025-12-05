// Leg compatibility constraints and filtering logic
// Defines model-to-leg-design compatibility and leg-design-to-tube-size compatibility

export const LEG_COMPATIBILITY = {
  // Model compatibility: which leg designs are available for each model
  modelToLegs: {
    'mdl-coffee': ['leg-sample-02', 'leg-sample-04', 'leg-sample-05', 'leg-sample-07'],
    'mdl-dining': ['leg-sample-03', 'leg-sample-04', 'leg-sample-05', 'leg-sample-06', 'leg-sample-07'],
    'mdl-conference': ['leg-sample-03', 'leg-sample-04', 'leg-sample-05', 'leg-sample-06', 'leg-sample-07']
  },
  // Tube size compatibility: which tube sizes are compatible with each leg design
  legToTubes: {
    'leg-sample-01': ['tube-1x0.5', 'tube-1x1'], // C Style
    'leg-sample-02': ['tube-1x0.5', 'tube-1x1'], // Cube
    'leg-sample-03': ['tube-1x3', 'tube-2x4'],   // Hourglass
    'leg-sample-04': ['tube-1x3', 'tube-2x4'],   // Squared
    'leg-sample-05': ['tube-1x3', 'tube-2x4'],   // Tapered
    'leg-sample-06': ['tube-1x3', 'tube-2x4'],   // X Style
    'leg-sample-07': ['tube-1x0.5', 'tube-1x1', 'tube-1x3', 'tube-2x4'] // Custom
  },
  // Model tube restrictions: some models cannot use certain tube sizes
  modelToTubes: {
    'mdl-coffee': ['tube-1x0.5', 'tube-1x1', 'tube-1x3'],     // no 2x4
    'mdl-dining': ['tube-1x3', 'tube-2x4'],                   // only 1x3 and 2x4
    'mdl-conference': ['tube-1x3', 'tube-2x4']                // only 1x3 and 2x4
  }
};

/**
 * Get available leg designs for the selected model
 */
export function getAvailableLegsForModel(modelId) {
  if (!modelId || !LEG_COMPATIBILITY.modelToLegs[modelId]) {
    return [];
  }
  return LEG_COMPATIBILITY.modelToLegs[modelId];
}

/**
 * Get visible leg designs: available for model and not marked as hidden
 */
export function getVisibleLegs(modelId, allLegs) {
  const availableLegIds = getAvailableLegsForModel(modelId);
  return allLegs.filter(leg => availableLegIds.includes(leg.id) && !leg.hidden);
}

/**
 * Get compatible tube sizes for a leg design
 */
export function getCompatibleTubesForLeg(legId) {
  return LEG_COMPATIBILITY.legToTubes[legId] || [];
}

/**
 * Get compatible tube sizes for a model
 */
export function getCompatibleTubesForModel(modelId) {
  return LEG_COMPATIBILITY.modelToTubes[modelId] || [];
}

/**
 * Get available tube sizes: only show if at least one visible leg design uses it
 * AND it's compatible with the model
 */
export function getAvailableTubeSizes(modelId, visibleLegs, allTubeSizes) {
  const modelTubes = getCompatibleTubesForModel(modelId);
  
  // Collect all tube sizes used by visible legs
  const tubesUsedByVisibleLegs = new Set();
  visibleLegs.forEach(leg => {
    const compatibleTubes = getCompatibleTubesForLeg(leg.id);
    compatibleTubes.forEach(tubeId => {
      if (modelTubes.includes(tubeId)) {
        tubesUsedByVisibleLegs.add(tubeId);
      }
    });
  });
  
  // Return tube sizes that are in our set
  return allTubeSizes.filter(tube => tubesUsedByVisibleLegs.has(tube.id));
}

/**
 * Check if a tube size is compatible with selected model and leg
 */
export function isTubeCompatibleWithLeg(tubeId, legId) {
  const compatibleTubes = getCompatibleTubesForLeg(legId);
  return compatibleTubes.includes(tubeId);
}

/**
 * Check if a tube size is compatible with model
 */
export function isTubeCompatibleWithModel(tubeId, modelId) {
  const modelTubes = getCompatibleTubesForModel(modelId);
  return modelTubes.includes(tubeId);
}

/**
 * Get incompatibility reasons for a tube size given a leg selection
 * Returns array of incompatibility sources (e.g., ["Cube", "model"])
 */
export function getTubeIncompatibilityReasons(tubeId, selectedLegId, modelId) {
  const reasons = [];
  
  if (selectedLegId && !isTubeCompatibleWithLeg(tubeId, selectedLegId)) {
    const leg = document.querySelector(`.option-card[data-id="${selectedLegId}"][data-category="legs"]`);
    const legTitle = (leg && leg.querySelector('.title') && leg.querySelector('.title').textContent.trim()) || 'selected design';
    reasons.push(legTitle);
  }
  
  if (modelId && !isTubeCompatibleWithModel(tubeId, modelId)) {
    const model = document.querySelector(`.option-card[data-id="${modelId}"]`);
    const modelTitle = (model && model.querySelector('.title') && model.querySelector('.title').textContent.trim()) || 'model';
    reasons.push(modelTitle);
  }
  
  return reasons;
}

export default {
  LEG_COMPATIBILITY,
  getAvailableLegsForModel,
  getVisibleLegs,
  getCompatibleTubesForLeg,
  getCompatibleTubesForModel,
  getAvailableTubeSizes,
  isTubeCompatibleWithLeg,
  isTubeCompatibleWithModel,
  getTubeIncompatibilityReasons
};
