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
  } catch (e) { /* ignore */ }
}

export default { init, restoreFromState };
