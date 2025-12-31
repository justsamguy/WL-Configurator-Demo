// Addons stage module
// Addons are multi-select; dispatch 'addon-toggled' events with { id, price, checked }
// Updated to handle dropdown tiles with checkboxes instead of option cards
export function init() {
  // No need for click handlers here since the dropdown rendering handles checkbox events
  // The renderAddonsDropdown function in stageRenderer.js handles the checkbox change events
}

export function restoreFromState(state) {
  try {
    const arr = state && state.selections && state.selections.options && Array.isArray(state.selections.options.addon) ? state.selections.options.addon : [];
    // Handle checkboxes
    document.querySelectorAll('.addons-dropdown-option-checkbox').forEach(checkbox => {
      const id = checkbox.getAttribute('data-addon-id');
      const checked = arr.includes(id);
      checkbox.checked = checked;
      // Update the option styling
      const option = checkbox.closest('.addons-dropdown-option');
      if (option) {
        option.classList.toggle('selected', checked);
      }
    });
    // Handle tiles
    document.querySelectorAll('.addons-tile').forEach(tile => {
      const id = tile.getAttribute('data-addon-id');
      const selected = arr.includes(id);
      tile.setAttribute('aria-pressed', selected ? 'true' : 'false');
      tile.classList.toggle('selected', selected);
    });
    // Handle dropdowns
    document.querySelectorAll('.addons-dropdown-select').forEach(select => {
      const group = select.getAttribute('data-addon-group');
      const groupPrefix = group.toLowerCase().replace(/\s+/g, '-');
      const selectedId = arr.find(id => id.startsWith(`addon-${groupPrefix}`));
      if (selectedId) {
        select.value = selectedId;
      } else {
        // Select the "none" option if available
        const noneOption = select.querySelector('option[value*="none"]');
        if (noneOption) {
          select.value = noneOption.value;
        }
      }
    });
    // Update all indicators after restoring state
    updateAllIndicators();
  } catch (e) { /* ignore */ }
}

const escapeSelectorValue = (value) => {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value;
};

const parsePrice = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getGroupTile = (groupTitle) => {
  const safeTitle = escapeSelectorValue(groupTitle);
  return document.querySelector(`.addons-dropdown-tile[data-id="${safeTitle}"]`);
};

const getGroupSelectionStats = (tile) => {
  const stats = {
    selectedCount: 0,
    selectableCount: 0,
    total: 0
  };
  if (!tile) return stats;

  const checkboxes = tile.querySelectorAll('.addons-dropdown-option-checkbox');
  checkboxes.forEach(checkbox => {
    stats.selectableCount += 1;
    if (checkbox.checked) {
      stats.selectedCount += 1;
      stats.total += parsePrice(checkbox.getAttribute('data-price'));
    }
  });

  const tiles = tile.querySelectorAll('.addons-tile');
  tiles.forEach(button => {
    stats.selectableCount += 1;
    if (button.classList.contains('selected')) {
      stats.selectedCount += 1;
      stats.total += parsePrice(button.getAttribute('data-price'));
    }
  });

  const selects = tile.querySelectorAll('.addons-dropdown-select');
  selects.forEach(select => {
    stats.selectableCount += 1;
    const selectedOption = select.selectedOptions ? select.selectedOptions[0] : select.options[select.selectedIndex];
    if (!selectedOption) return;
    const value = selectedOption.value || '';
    if (value.includes('none')) return;
    stats.selectedCount += 1;
    stats.total += parsePrice(selectedOption.getAttribute('data-price'));
  });

  return stats;
};

// Function to update indicator for a specific group
function updateIndicator(groupTitle) {
  const tile = getGroupTile(groupTitle);
  if (!tile) return;

  const indicator = tile.querySelector('.addons-dropdown-indicator');
  if (!indicator) return;

  const price = tile.querySelector('.addons-dropdown-price');
  const stats = getGroupSelectionStats(tile);

  indicator.className = 'addons-dropdown-indicator';
  if (stats.selectedCount === 0) {
    indicator.classList.remove('partial', 'full');
  } else if (stats.selectedCount === stats.selectableCount) {
    indicator.classList.add('full');
  } else {
    indicator.classList.add('partial');
  }

  if (price) {
    if (stats.selectedCount > 0) {
      price.textContent = `+$${stats.total.toLocaleString()}`;
      price.classList.add('visible');
    } else {
      price.textContent = '';
      price.classList.remove('visible');
    }
  }
}

// Function to update all indicators
function updateAllIndicators() {
  document.querySelectorAll('.addons-dropdown-tile').forEach(tile => {
    const groupTitle = tile.getAttribute('data-id');
    if (groupTitle) updateIndicator(groupTitle);
  });
}

export { updateAllIndicators };
export default { init, restoreFromState };
