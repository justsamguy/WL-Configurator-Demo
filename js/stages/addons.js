// Addons stage module
// Addons are multi-select; dispatch 'addon-toggled' events with { id, price, checked }
// Updated to handle dropdown tiles with checkboxes instead of option cards
export function init() {
  const root = document.getElementById('addons-options');
  if (!root) return;
  if (root.dataset.addonsDelegated === 'true') return;
  root.dataset.addonsDelegated = 'true';

  const refreshIndicators = (ev) => {
    console.log('[Addons] Refresh indicators from event:', ev.type, ev.detail || {});
    updateAllIndicators();
  };
  document.addEventListener('addon-toggled', refreshIndicators);
  document.addEventListener('addon-selected', refreshIndicators);

  if (typeof MutationObserver !== 'undefined') {
    const disabledObserver = new MutationObserver((mutations) => {
      const hasDisabledChange = mutations.some(mutation => mutation.attributeName === 'disabled');
      if (!hasDisabledChange) return;
      syncDisabledStyles();
      updateAllIndicators();
    });
    disabledObserver.observe(root, { attributes: true, subtree: true, attributeFilter: ['disabled'] });
    root.__addonsDisabledObserver = disabledObserver;
  }

  root.addEventListener('click', (event) => {
    const optionRow = event.target.closest('.addons-dropdown-option');
    if (optionRow && root.contains(optionRow)) {
      const checkbox = optionRow.querySelector('.addons-dropdown-option-checkbox');
      if (checkbox && !checkbox.disabled) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    const tile = event.target.closest('.addons-tile');
    if (tile && root.contains(tile)) {
      if (tile.disabled) return;
      const mode = tile.getAttribute('data-addon-mode');
      if (mode === 'single') {
        const group = tile.getAttribute('data-addon-group');
        const groupTiles = getTilesByGroup(root, group);
        groupTiles.forEach(btn => {
          btn.setAttribute('aria-pressed', 'false');
          btn.classList.remove('selected');
        });
        tile.setAttribute('aria-pressed', 'true');
        tile.classList.add('selected');
        const id = tile.getAttribute('data-addon-id');
        const price = parsePrice(tile.getAttribute('data-price'));
        console.log('[Addons] Tile select:', { group, id, price });
        document.dispatchEvent(new CustomEvent('addon-selected', {
          detail: { group, id, price }
        }));
        updateAllIndicators();
        return;
      }

      const isPressed = tile.getAttribute('aria-pressed') === 'true';
      tile.setAttribute('aria-pressed', (!isPressed).toString());
      tile.classList.toggle('selected', !isPressed);
      const id = tile.getAttribute('data-addon-id');
      const price = parsePrice(tile.getAttribute('data-price'));
      console.log('[Addons] Tile toggle:', { id, price, checked: !isPressed });
      document.dispatchEvent(new CustomEvent('addon-toggled', {
        detail: { id, price, checked: !isPressed }
      }));
      updateAllIndicators();
    }
  });

  root.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.addons-dropdown-option-checkbox');
    if (checkbox && root.contains(checkbox)) {
      const checked = checkbox.checked;
      const optionDiv = checkbox.closest('.addons-dropdown-option');
      if (optionDiv) optionDiv.classList.toggle('selected', checked);
      const id = checkbox.getAttribute('data-addon-id');
      const price = parsePrice(checkbox.getAttribute('data-price'));
      console.log('[Addons] Checkbox change:', { id, price, checked });
      document.dispatchEvent(new CustomEvent('addon-toggled', {
        detail: { id, price, checked }
      }));
      updateAllIndicators();
      return;
    }

    const select = event.target.closest('.addons-dropdown-select');
    if (select && root.contains(select)) {
      const selectedOption = select.selectedOptions ? select.selectedOptions[0] : select.options[select.selectedIndex];
      const id = selectedOption ? selectedOption.value : null;
      const price = selectedOption ? parsePrice(selectedOption.getAttribute('data-price')) : 0;
      const group = select.getAttribute('data-addon-group');
      console.log('[Addons] Dropdown change:', { group, id, price });
      document.dispatchEvent(new CustomEvent('addon-selected', {
        detail: { group, id, price }
      }));
      updateAllIndicators();
    }
  });

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
    const tiles = Array.from(document.querySelectorAll('.addons-tile'));
    tiles.forEach(tile => {
      const mode = tile.getAttribute('data-addon-mode');
      if (mode === 'single') return;
      const id = tile.getAttribute('data-addon-id');
      const selected = arr.includes(id);
      tile.setAttribute('aria-pressed', selected ? 'true' : 'false');
      tile.classList.toggle('selected', selected);
    });

    const singleGroups = new Map();
    tiles.forEach(tile => {
      const mode = tile.getAttribute('data-addon-mode');
      if (mode !== 'single') return;
      const group = tile.getAttribute('data-addon-group') || '';
      if (!singleGroups.has(group)) singleGroups.set(group, []);
      singleGroups.get(group).push(tile);
    });

    singleGroups.forEach((groupTiles, group) => {
      const groupPrefix = `addon-${group}-`;
      const selectedId = arr.find(id => id.startsWith(groupPrefix));
      let targetTile = null;
      if (selectedId) {
        targetTile = groupTiles.find(tile => tile.getAttribute('data-addon-id') === selectedId) || null;
      }
      if (!targetTile) {
        targetTile = groupTiles.find(tile => {
          const id = tile.getAttribute('data-addon-id') || '';
          return id.includes('-none');
        }) || null;
      }
      groupTiles.forEach(tile => {
        const isSelected = targetTile && tile === targetTile;
        tile.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        tile.classList.toggle('selected', isSelected);
      });
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

function getTilesByGroup(root, group) {
  if (!root || !group) return [];
  const escapedGroup = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(group) : group.replace(/["\\]/g, '\\$&');
  return Array.from(root.querySelectorAll(`.addons-tile[data-addon-group="${escapedGroup}"]`));
}

function isSelectEffectivelyDisabled(select) {
  if (!select) return true;
  if (select.disabled) return true;
  const options = Array.from(select.options || []);
  if (!options.length) return true;
  return options.every(option => option.disabled);
}

function syncDisabledStyles() {
  document.querySelectorAll('.addons-dropdown-option').forEach(option => {
    const checkbox = option.querySelector('.addons-dropdown-option-checkbox');
    const isDisabled = checkbox ? checkbox.disabled : false;
    option.classList.toggle('disabled', isDisabled);
    if (isDisabled) {
      option.setAttribute('aria-disabled', 'true');
      const checkboxTooltip = checkbox ? checkbox.getAttribute('data-tooltip') : '';
      if (checkboxTooltip && checkboxTooltip !== option.getAttribute('data-tooltip')) {
        option.setAttribute('data-tooltip', checkboxTooltip);
      }
      const checkboxDisabledBy = checkbox ? checkbox.getAttribute('data-disabled-by') : '';
      if (checkboxDisabledBy && checkboxDisabledBy !== option.getAttribute('data-disabled-by')) {
        option.setAttribute('data-disabled-by', checkboxDisabledBy);
      }
    } else {
      option.removeAttribute('aria-disabled');
    }
  });

  document.querySelectorAll('.addons-tile').forEach(tile => {
    const isDisabled = tile.disabled || tile.getAttribute('aria-disabled') === 'true';
    tile.classList.toggle('disabled', isDisabled);
  });

  document.querySelectorAll('.addons-dropdown-select').forEach(select => {
    const isDisabled = isSelectEffectivelyDisabled(select);
    select.classList.toggle('disabled', isDisabled);
  });
}

const getGroupSelectionStats = (tile) => {
  const stats = {
    selectedCount: 0,
    selectableCount: 0,
    total: 0,
    disabledCount: 0,
    totalCount: 0
  };
  if (!tile) return stats;

  const checkboxes = tile.querySelectorAll('.addons-dropdown-option-checkbox');
  checkboxes.forEach(checkbox => {
    stats.totalCount += 1;
    const isDisabled = checkbox.disabled;
    if (isDisabled) {
      stats.disabledCount += 1;
      return;
    }
    stats.selectableCount += 1;
    if (checkbox.checked) {
      stats.selectedCount += 1;
      stats.total += parsePrice(checkbox.getAttribute('data-price'));
    }
  });

  const tiles = tile.querySelectorAll('.addons-tile');
  tiles.forEach(button => {
    stats.totalCount += 1;
    const isDisabled = button.disabled || button.getAttribute('aria-disabled') === 'true';
    if (isDisabled) {
      stats.disabledCount += 1;
      return;
    }
    stats.selectableCount += 1;
    if (button.classList.contains('selected')) {
      stats.selectedCount += 1;
      stats.total += parsePrice(button.getAttribute('data-price'));
    }
  });

  const selects = tile.querySelectorAll('.addons-dropdown-select');
  selects.forEach(select => {
    stats.totalCount += 1;
    const isDisabled = isSelectEffectivelyDisabled(select);
    if (isDisabled) {
      stats.disabledCount += 1;
      return;
    }
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
  if (resolvedStats.totalCount > 0 && resolvedStats.selectableCount === 0) {
    indicator.classList.add('unavailable');
    indicator.setAttribute('data-tooltip', 'This customization is currently unvailable.');
  } else if (resolvedStats.selectedCount === 0) {
    indicator.classList.remove('partial', 'full');
    indicator.removeAttribute('data-tooltip');
  } else if (resolvedStats.selectedCount === resolvedStats.selectableCount) {
    indicator.classList.add('full');
    indicator.removeAttribute('data-tooltip');
  } else {
    indicator.classList.add('partial');
    indicator.removeAttribute('data-tooltip');
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
  syncDisabledStyles();
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
