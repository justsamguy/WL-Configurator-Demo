// Addons stage module — renders add-on options from JSON data
// Add-ons are multi-select checkboxes
import { renderOptionCards } from '../stageRenderer.js';
import { loadData } from '../dataLoader.js';

/**
 * Render add-on options into the addons-options container.
 * Each option card uses role="checkbox" and aria-checked for multi-select semantics.
 */
export async function renderStage() {
  try {
    const addonsData = await loadData('data/addons.json');
    const addonsContainer = document.getElementById('addons-options');
    
    if (addonsContainer && addonsData) {
      addonsContainer.innerHTML = '';
      addonsData.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'option-card';
        btn.setAttribute('data-id', item.id);
        btn.setAttribute('data-category', 'addon');
        btn.setAttribute('role', 'checkbox');
        btn.setAttribute('aria-checked', 'false');
        if (typeof item.price !== 'undefined') btn.setAttribute('data-price', String(item.price));
        if (item.disabled) {
          btn.setAttribute('disabled', 'true');
          btn.setAttribute('aria-disabled', 'true');
          if (item.tooltip) btn.setAttribute('data-tooltip', item.tooltip);
        }

        const titleRow = document.createElement('div');
        titleRow.className = 'title-price-row';
        const t = document.createElement('div');
        t.className = 'title';
        t.textContent = item.title || item.id;
        const p = document.createElement('div');
        p.className = 'price-delta';
        p.textContent = item.price ? `+$${item.price}` : '+$0';
        titleRow.appendChild(t);
        titleRow.appendChild(p);
        btn.appendChild(titleRow);

        if (item.description) {
          const d = document.createElement('div');
          d.className = 'description';
          d.textContent = item.description;
          btn.appendChild(d);
        }

        addonsContainer.appendChild(btn);
      });
    }
  } catch (e) {
    console.warn('Failed to render addons stage:', e);
  }
}

export function restoreFromState(state) {
  try {
    const arr = state && state.selections && state.selections.options && Array.isArray(state.selections.options.addon) ? state.selections.options.addon : [];
    document.querySelectorAll('.option-card[data-category="addon"]').forEach(c => {
      const id = c.getAttribute('data-id');
      const checked = arr.includes(id);
      c.setAttribute('aria-checked', checked ? 'true' : 'false');
      c.classList.toggle('selected', checked);
    });
  } catch (e) {
    console.warn('Failed to restore addons stage from state:', e);
  }
}

export default { renderStage, restoreFromState };
