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

// Function to determine indicator state for a group
function getIndicatorState(groupTitle, selectedIds) {
  const groupId = groupTitle.toLowerCase().replace(/\s+/g, '-');

  // For non-tech groups (checkboxes)
  const checkboxOptions = document.querySelectorAll(`.addons-dropdown-tile[data-id="${groupTitle}"] .addons-dropdown-option-checkbox`);
  if (checkboxOptions.length > 0) {
    const checkedBoxes = Array.from(checkboxOptions).filter(cb => cb.checked);
    if (checkedBoxes.length === 0) return 'empty';
    if (checkedBoxes.length === checkboxOptions.length) return 'full';
    return 'partial';
  }

  // For tech subsections
  const subsection = document.querySelector(`.addons-subsection-title`);
  if (subsection && subsection.textContent.trim() === groupTitle) {
    const container = subsection.closest('.addons-subsection');

    // Check tiles
    const tiles = container.querySelectorAll('.addons-tile');
    if (tiles.length > 0) {
      const selectedTiles = Array.from(tiles).filter(tile => tile.classList.contains('selected'));
      if (selectedTiles.length === 0) return 'empty';
      if (selectedTiles.length === tiles.length) return 'full';
      return 'partial';
    }

    // Check dropdown
    const select = container.querySelector('.addons-dropdown-select');
    if (select) {
      const selectedValue = select.value;
      const noneOption = select.querySelector('option[value*="none"]');
      if (noneOption && selectedValue === noneOption.value) return 'empty';
      return 'full'; // Any other selection is "full"
    }
  }

  return 'empty';
}

// Function to update indicator for a specific group
function updateIndicator(groupTitle) {
  const indicator = document.querySelector(`.addons-dropdown-indicator[data-group-id="${groupTitle.toLowerCase().replace(/\s+/g, '-')}"]`);
  if (!indicator) return;

  // Get current selections (this is a simplified approach - in practice you'd get from state)
  const selectedIds = [];
  document.querySelectorAll('.addons-dropdown-option-checkbox:checked, .addons-tile.selected, .addons-dropdown-select').forEach(el => {
    if (el.type === 'checkbox' && el.checked) {
      selectedIds.push(el.getAttribute('data-addon-id'));
    } else if (el.classList.contains('addons-tile') && el.classList.contains('selected')) {
      selectedIds.push(el.getAttribute('data-addon-id'));
    } else if (el.tagName === 'SELECT') {
      const value = el.value;
      if (value && !value.includes('none')) {
        selectedIds.push(value);
      }
    }
  });

  const state = getIndicatorState(groupTitle, selectedIds);
  indicator.className = 'addons-dropdown-indicator';
  if (state === 'partial') {
    indicator.classList.add('partial');
  } else if (state === 'full') {
    indicator.classList.add('full');
  }
}

// Function to update all indicators
function updateAllIndicators() {
  document.querySelectorAll('.addons-dropdown-indicator').forEach(indicator => {
    const groupId = indicator.getAttribute('data-group-id');
    // Convert back to title format
    const groupTitle = groupId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    updateIndicator(groupTitle);
  });
}

export { updateAllIndicators };
export default { init, restoreFromState };
