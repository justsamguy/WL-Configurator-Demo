// Dimensions stage module — renders dimension options from JSON data
// Handles single-choice dimension size selections
import { renderOptionCards } from '../stageRenderer.js';
import { loadData } from '../dataLoader.js';

/**
 * Render dimension options into the dimensions-options container.
 */
export async function renderStage() {
  try {
    const dimensionsData = await loadData('data/dimensions.json');
    const dimensionsContainer = document.getElementById('dimensions-options');
    
    if (dimensionsContainer && dimensionsData) {
      renderOptionCards(dimensionsContainer, dimensionsData, { category: 'dimensions' });
    }
  } catch (e) {
    console.warn('Failed to render dimensions stage:', e);
  }
}

export function restoreFromState(state) {
  try {
    const id = state && state.selections && state.selections.options && state.selections.options.dimensions;
    if (!id) return;
    const el = document.querySelector(`.option-card[data-id="${id}"]`);
    if (el) {
      document.querySelectorAll('.option-card[data-category="dimensions"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', 'true');
    }
  } catch (e) {
    console.warn('Failed to restore dimensions stage from state:', e);
  }
}

export default { renderStage, restoreFromState };
