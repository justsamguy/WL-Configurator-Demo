// Legs stage module — renders leg and tube-size options from JSON data
// Handles single-choice selections for both leg style and tube size
import { renderOptionCards } from '../stageRenderer.js';
import { loadData } from '../dataLoader.js';

/**
 * Render leg options into the legs-options container and tube-size options into tube-size-options.
 */
export async function renderStage() {
  try {
    const legsData = await loadData('data/legs.json');
    const legsContainer = document.getElementById('legs-options');
    
    if (legsContainer && legsData) {
      renderOptionCards(legsContainer, legsData, { category: 'legs' });
    }

    // Render tube sizes if data exists (for now, inline sample data)
    const tubeSizeContainer = document.getElementById('tube-size-options');
    if (tubeSizeContainer) {
      const tubeSizeData = [
        { id: 'tube-0.5x1', title: '½ × 1"', price: 0, description: 'Half by one inch' },
        { id: 'tube-1x1', title: '1 × 1"', price: 0, description: 'Square 1" tube' },
        { id: 'tube-2x1', title: '2 × 1"', price: 0, description: 'Rectangular 2×1" tube' },
        { id: 'tube-3x1', title: '3 × 1"', price: 0, description: 'Rectangular 3×1" tube' },
        { id: 'tube-4x2', title: '4 × 2"', price: 0, description: 'Rectangular 4×2" tube' }
      ];
      renderOptionCards(tubeSizeContainer, tubeSizeData, { category: 'tube-size' });
    }
  } catch (e) {
    console.warn('Failed to render legs stage:', e);
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
      }
    }

    const tubeId = state && state.selections && state.selections.options && state.selections.options['tube-size'];
    if (tubeId) {
      const el = document.querySelector(`.option-card[data-id="${tubeId}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="tube-size"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    }
  } catch (e) {
    console.warn('Failed to restore legs stage from state:', e);
  }
}

export default { renderStage, restoreFromState };
