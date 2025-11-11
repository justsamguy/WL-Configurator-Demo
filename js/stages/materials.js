// Materials stage logic: validation and utilities
import { renderOptionCards } from '../stageRenderer.js';
import { loadData } from '../dataLoader.js';

export function isMaterialsComplete(appState) {
  try {
    const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
    const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
    return !!(hasMaterial && hasColor);
  } catch (e) {
    return false;
  }
}

/**
 * Render materials and color options into their respective containers.
 */
export async function renderStage() {
  try {
    const materialsData = await loadData('data/materials.json');
    const colorsData = await loadData('data/colors.json');
    const materialsContainer = document.getElementById('materials-options');
    const colorsContainer = document.getElementById('color-options');
    
    if (materialsContainer && materialsData) {
      renderOptionCards(materialsContainer, materialsData, { category: 'material' });
    }
    
    if (colorsContainer && colorsData) {
      renderOptionCards(colorsContainer, colorsData, { category: 'color' });
    }
  } catch (e) {
    console.warn('Failed to render materials stage:', e);
  }
}

export function restoreFromState(state) {
  try {
    const opts = state && state.selections && state.selections.options ? state.selections.options : {};
    ['material', 'color'].forEach(cat => {
      const id = opts[cat];
      if (!id) return;
      const el = document.querySelector(`.option-card[data-id="${id}"]`);
      if (el) {
        document.querySelectorAll(`.option-card[data-category="${cat}"]`).forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    });
  } catch (e) {
    console.warn('Failed to restore materials stage from state:', e);
  }
}

export default { isMaterialsComplete, renderStage, restoreFromState };
