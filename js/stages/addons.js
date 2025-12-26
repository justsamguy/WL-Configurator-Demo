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
  } catch (e) { /* ignore */ }
}

export default { init, restoreFromState };
