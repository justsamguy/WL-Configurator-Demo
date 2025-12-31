// Addons stage module
// Addons are multi-select; dispatch 'addon-toggled' events with { id, price, checked }
// Updated to handle dropdown tiles with checkboxes instead of option cards
export function init() {
  const refreshIndicators = (ev) => {
    console.log('[Addons] Refresh indicators from event:', ev.type, ev.detail || {});
    updateAllIndicators();
  };
  document.addEventListener('addon-toggled', refreshIndicators);
  document.addEventListener('addon-selected', refreshIndicators);
  updateAllIndicators();
}

export function restoreFromState(state) {
  try {
    const arr = state && state.selections && state.selections.options && Array.isArray(state.selections.options.addon) ? state.selections.options.addon : [];
    console.log('[Addons] restoreFromState selections:', arr);
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

const parsePrice = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
function updateIndicator(tile, stats) {
  if (!tile) return;

  const indicator = tile.querySelector('.addons-dropdown-indicator');
  if (!indicator) return;

  const price = tile.querySelector('.addons-dropdown-price');
  const resolvedStats = stats || getGroupSelectionStats(tile);

  indicator.className = 'addons-dropdown-indicator';
  if (resolvedStats.selectedCount === 0) {
    indicator.classList.remove('partial', 'full');
  } else if (resolvedStats.selectedCount === resolvedStats.selectableCount) {
    indicator.classList.add('full');
  } else {
    indicator.classList.add('partial');
  }

  if (price) {
    if (resolvedStats.selectedCount > 0) {
      price.textContent = `+$${resolvedStats.total.toLocaleString()}`;
      price.classList.add('visible');
    } else {
      price.textContent = '';
      price.classList.remove('visible');
    }
  }
}

// Function to update all indicators
function updateAllIndicators() {
  const summaries = [];
  document.querySelectorAll('.addons-dropdown-tile').forEach(tile => {
    const groupTitle = tile.getAttribute('data-id') || 'Unknown';
    const stats = getGroupSelectionStats(tile);
    updateIndicator(tile, stats);
    summaries.push({
      group: groupTitle,
      selected: stats.selectedCount,
      total: stats.selectableCount,
      price: stats.total
    });
  });
  if (summaries.length > 0) {
    console.log('[Addons] Indicator summary:', summaries);
  }
}

export { updateAllIndicators };
export default { init, restoreFromState };
