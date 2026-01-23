// Renders option-card buttons from a data array into a container element.
// data: array of { id, title, price, image, description, disabled, tooltip }
// opts.showPrice: set false to hide price text for the rendered tiles
function isQuotedLabel(value) {
  return typeof value === 'string' && value.trim() && Number.isNaN(Number(value));
}

function formatPriceLabel(value, opts = {}) {
  if (isQuotedLabel(value)) return value.trim();
  const numeric = Number(value);
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  if (opts.isDesign) {
    return `Starting from: $${safeNumber.toLocaleString()}`;
  }
  return `+$${safeNumber.toLocaleString()}`;
}
export function renderOptionCards(container, data = [], opts = {}) {
  if (!container) return;
  container.innerHTML = '';
  data.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'option-card';
    btn.setAttribute('data-id', item.id);
    if (opts.category) btn.setAttribute('data-category', opts.category);
    if (typeof item.price !== 'undefined') btn.setAttribute('data-price', String(item.price));
    if (item.customNote) btn.setAttribute('data-custom-note', 'true');
    // Use aria-checked for multi-select (addon) category, aria-pressed for single-select
    const isMultiSelect = opts.category === 'addon';
    if (isMultiSelect) {
      btn.setAttribute('aria-checked', 'false');
    } else {
      btn.setAttribute('aria-pressed', 'false');
    }
    if (item.disabled) {
      btn.setAttribute('disabled', 'true');
      if (item.tooltip) btn.setAttribute('data-tooltip', item.tooltip);
    }

    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.alt || item.title || 'placeholder';
      img.className = 'viewer-placeholder-img';
      btn.appendChild(img);
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'title';
    titleDiv.textContent = item.title || item.id;
    btn.appendChild(titleDiv);

    if (opts.showPrice !== false) {
      const priceDiv = document.createElement('div');
      priceDiv.className = 'price-delta';
      const isDesign = item.id && item.id.startsWith('des-');
      priceDiv.textContent = formatPriceLabel(item.price, { isDesign });
      btn.appendChild(priceDiv);
    }

    if (item.description) {
      const d = document.createElement('div');
      d.className = 'description';
      d.textContent = item.description;
      btn.appendChild(d);
    }

    container.appendChild(btn);
  });
}

const DEFAULT_ADDON_INTRO_IMAGE = 'assets/images/model1_placeholder.png';

function buildAddonIntro(group = {}) {
  const introWrapper = document.createElement('div');
  const hasImage = Boolean(group.image);
  introWrapper.className = hasImage ? 'addons-dropdown-intro' : 'addons-dropdown-intro addons-dropdown-intro-no-image';

  if (hasImage) {
    const image = document.createElement('img');
    image.className = 'addons-dropdown-intro-image';
    image.src = group.image || DEFAULT_ADDON_INTRO_IMAGE;
    image.alt = group.title ? `Preview of ${group.title}` : 'Addon preview';
    introWrapper.appendChild(image);
  }

  const text = document.createElement('p');
  text.className = 'addons-dropdown-intro-text';
  const fallbackTitle = group.title ? group.title.toLowerCase() : 'add-on';
  text.textContent = group.description || `Choose the ${fallbackTitle} enhancements that best fit your space.`;
  introWrapper.appendChild(text);

  return introWrapper;
}

export function renderAddonsDropdown(container, data = [], currentState = {}) {
  if (!container) return;
  container.innerHTML = '';

  data.forEach(group => {
    const resolveTooltip = (option = {}, subsection = {}) => {
      return option.tooltip || subsection.tooltip || group.tooltip || '';
    };
    const tile = document.createElement('div');
    tile.className = 'addons-dropdown-tile';
    tile.setAttribute('data-id', group.title);

    // Header (clickable to expand/collapse)
    const header = document.createElement('button');
    header.className = 'addons-dropdown-header';
    header.setAttribute('aria-expanded', 'false');

    const headerMain = document.createElement('div');
    headerMain.className = 'addons-dropdown-header-main';

    const title = document.createElement('div');
    title.className = 'addons-dropdown-title';
    title.textContent = group.title;

    const price = document.createElement('div');
    price.className = 'addons-dropdown-price';

    const indicator = document.createElement('div');
    indicator.className = 'addons-dropdown-indicator';
    indicator.setAttribute('data-group-id', group.title.toLowerCase().replace(/\s+/g, '-'));

    const headerMeta = document.createElement('div');
    headerMeta.className = 'addons-dropdown-header-meta';
    headerMeta.appendChild(price);
    headerMeta.appendChild(indicator);

    headerMain.appendChild(title);
    headerMain.appendChild(headerMeta);

    // Chevron icon
    const chevron = document.createElement('svg');
    chevron.className = 'addons-dropdown-chevron';
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';

    header.appendChild(headerMain);
    header.appendChild(chevron);

    // Content (expandable)
    const content = document.createElement('div');
    content.className = 'addons-dropdown-content';

    const intro = buildAddonIntro(group);
    content.appendChild(intro);

    // Handle tech group with subsections
    if (group.type === 'tech' && group.subsections) {
      // Add custom cable length input for tech addon
      const cableLengthContainer = document.createElement('div');
      cableLengthContainer.className = 'addons-cable-length-container';

      const cableLengthLabel = document.createElement('label');
      cableLengthLabel.className = 'addons-cable-length-label';
      cableLengthLabel.htmlFor = 'tech-cable-length-input';
      cableLengthLabel.textContent = 'Custom Cable Length (feet)';

      const cableLengthInput = document.createElement('input');
      cableLengthInput.type = 'number';
      cableLengthInput.id = 'tech-cable-length-input';
      cableLengthInput.className = 'addons-cable-length-input';
      cableLengthInput.min = '1';
      cableLengthInput.max = '300';
      cableLengthInput.placeholder = '12';
      cableLengthInput.disabled = true;
      cableLengthInput.setAttribute('data-tooltip', 'Please make a selection');
      cableLengthInput.setAttribute('aria-label', 'Custom cable length for power cables');

      cableLengthContainer.appendChild(cableLengthLabel);
      cableLengthContainer.appendChild(cableLengthInput);
      content.appendChild(cableLengthContainer);
      group.subsections.forEach(subsection => {
        const subContainer = document.createElement('div');
        subContainer.className = 'addons-subsection';

        const subTitle = document.createElement('div');
        subTitle.className = 'addons-subsection-title';
        subTitle.textContent = subsection.title;
        subContainer.appendChild(subTitle);

        if (subsection.type === 'tile') {
          // Render as tiles (buttons)
          const tilesContainer = document.createElement('div');
          tilesContainer.className = 'addons-tiles-container';
          if (subsection.layout === 'scroll') {
            tilesContainer.classList.add('addons-tiles-scroll');
          }
          const groupId = subsection.groupId || subsection.title;
          subsection.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'addons-tile';
            btn.setAttribute('data-addon-id', option.id);
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('data-price', option.price || 0);
            if (subsection.selection === 'single') {
              btn.setAttribute('data-addon-mode', 'single');
              btn.setAttribute('data-addon-group', groupId);
            }

            // Check for addon compatibility with current design
            const currentDesign = currentState.selections && currentState.selections.design;
            const isInnerlightingIncompatible = option.id.startsWith('addon-lighting-') && option.id !== 'addon-lighting-none' &&
              (currentDesign === 'des-slab' || currentDesign === 'des-encasement' || currentDesign === 'des-cookie');
            const isIncompatible = isInnerlightingIncompatible;
            const isDisabled = group.disabled || subsection.disabled || option.disabled || isIncompatible;

            if (isDisabled) {
              btn.disabled = true;
              btn.classList.add('disabled');
              let tooltip = resolveTooltip(option, subsection);
              if (isInnerlightingIncompatible) {
                tooltip = 'Not compatible with Slab, Encasement, or Cookie designs';
              }
              if (tooltip) btn.setAttribute('data-tooltip', tooltip);
            }

            if (option.image) {
              const img = document.createElement('img');
              img.className = 'addons-tile-image';
              img.src = option.image;
              img.alt = option.title ? `Preview of ${option.title}` : 'Tech option';
              btn.appendChild(img);
            }

            const label = document.createElement('div');
            label.className = 'addons-tile-label';
            label.textContent = option.title;

            const price = document.createElement('div');
            price.className = 'addons-tile-price';
            price.textContent = formatPriceLabel(option.price);

            btn.appendChild(label);
            btn.appendChild(price);
            tilesContainer.appendChild(btn);

          });
          subContainer.appendChild(tilesContainer);
        } else if (subsection.type === 'dropdown') {
          // Render as dropdown
          const select = document.createElement('select');
          select.className = 'addons-dropdown-select';
          const groupId = subsection.groupId || subsection.title;
          select.setAttribute('data-addon-group', groupId);
          if (group.disabled || subsection.disabled) {
            select.disabled = true;
            select.classList.add('disabled');
            const tooltip = resolveTooltip({}, subsection);
            if (tooltip) select.setAttribute('data-tooltip', tooltip);
          }

          subsection.options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            const optionPriceLabel = formatPriceLabel(option.price);
            opt.textContent = `${option.title} (${optionPriceLabel})`;
            opt.setAttribute('data-price', option.price || 0);

            // Check for addon compatibility with current design
            const currentDesign = currentState.selections && currentState.selections.design;
            const isInnerlightingIncompatible = option.id.startsWith('addon-lighting-') && option.id !== 'addon-lighting-none' &&
              (currentDesign === 'des-slab' || currentDesign === 'des-encasement' || currentDesign === 'des-cookie');
            const isIncompatible = isInnerlightingIncompatible;
            const isDisabled = group.disabled || subsection.disabled || option.disabled || isIncompatible;

            if (isDisabled) {
              opt.disabled = true;
            }
            select.appendChild(opt);
          });

          subContainer.appendChild(select);

        }

        content.appendChild(subContainer);
      });
    } else {
      // Original logic for non-tech groups
      const options = document.createElement('div');
      options.className = 'addons-dropdown-options';

      // Options for this group
      if (group.options) {
        group.options.forEach(option => {
          const tooltip = resolveTooltip(option);
          const optionDiv = document.createElement('div');
          optionDiv.className = 'addons-dropdown-option';
          optionDiv.setAttribute('data-addon-id', option.id);
          optionDiv.setAttribute('data-price', option.price || 0);

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'addons-dropdown-option-checkbox';
          checkbox.setAttribute('data-addon-id', option.id);
          checkbox.setAttribute('data-price', option.price || 0);

          // Check for addon compatibility with current design
          const currentDesign = currentState.selections && currentState.selections.design;
          const currentAddons = currentState.selections.options && currentState.selections.options.addon ? currentState.selections.options.addon : [];
          const isRoundedCornersIncompatible = option.id === 'addon-rounded-corners' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round' || currentAddons.includes('addon-chamfered-edges') || currentAddons.includes('addon-squoval') || currentAddons.includes('addon-angled-corners'));
          const isAngledCornersIncompatible = option.id === 'addon-angled-corners' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round' || currentAddons.includes('addon-chamfered-edges') || currentAddons.includes('addon-squoval') || currentAddons.includes('addon-rounded-corners'));
          const isCustomRiverIncompatible = option.id === 'addon-custom-river' &&
            (currentDesign === 'des-slab' || currentDesign === 'des-encasement' || currentDesign === 'des-cookie');
          const isChamferedEdgesIncompatible = option.id === 'addon-chamfered-edges' &&
            (currentDesign === 'des-cookie' || currentDesign === 'des-round' || currentAddons.includes('addon-rounded-corners') || currentAddons.includes('addon-squoval') || currentAddons.includes('addon-live-edge') || currentAddons.includes('addon-angled-corners'));
          const isSquovalIncompatible = option.id === 'addon-squoval' &&
            (currentAddons.includes('addon-chamfered-edges') || currentAddons.includes('addon-rounded-corners') || currentAddons.includes('addon-angled-corners'));
          const requiresWaterfallSingle = option.id === 'addon-waterfall-second' && !currentAddons.includes('addon-waterfall-single');
          const isIncompatible = isRoundedCornersIncompatible || isAngledCornersIncompatible || isCustomRiverIncompatible || isChamferedEdgesIncompatible || isSquovalIncompatible || requiresWaterfallSingle;
          const isDisabled = group.disabled || option.disabled || isIncompatible;

          if (isDisabled) {
            checkbox.disabled = true;
            optionDiv.classList.add('disabled');
            optionDiv.setAttribute('aria-disabled', 'true');
            let incompatibilityTooltip = tooltip;
            if (requiresWaterfallSingle) {
              incompatibilityTooltip = 'Select Single Waterfall to enable';
              checkbox.setAttribute('data-disabled-by', 'waterfall');
              optionDiv.setAttribute('data-disabled-by', 'waterfall');
            } else if (isRoundedCornersIncompatible) {
              incompatibilityTooltip = 'Not compatible with Cookie or Round designs, Chamfered Edges, Squoval, or Angled Corners';
            } else if (isAngledCornersIncompatible) {
              incompatibilityTooltip = 'Not compatible with Cookie or Round designs, Chamfered Edges, Squoval, or Rounded Corners';
            } else if (isCustomRiverIncompatible) {
              incompatibilityTooltip = 'Not compatible with Slab, Encasement, or Cookie designs';
            } else if (isChamferedEdgesIncompatible) {
              incompatibilityTooltip = 'Not compatible with Cookie or Round designs, Rounded Corners, Squoval, Live Edge, or Angled Corners';
            } else if (isSquovalIncompatible) {
              incompatibilityTooltip = 'Not compatible with Chamfered Edges, Rounded Corners, or Angled Corners';
            }
            if (incompatibilityTooltip) optionDiv.setAttribute('data-tooltip', incompatibilityTooltip);
          }

          const label = document.createElement('div');
          label.className = 'addons-dropdown-option-label';
          label.textContent = option.title;

          const optionPrice = document.createElement('div');
          optionPrice.className = 'addons-dropdown-option-price';
          optionPrice.textContent = formatPriceLabel(option.price);

          optionDiv.appendChild(checkbox);
          optionDiv.appendChild(label);
          optionDiv.appendChild(optionPrice);

          options.appendChild(optionDiv);
        });
      }

      content.appendChild(options);
    }

    // Handle disabled state
    if (group.disabled) {
      content.querySelectorAll('input, button, select').forEach(el => el.disabled = true);
      if (group.tooltip) {
        tile.setAttribute('data-tooltip', group.tooltip);
      }
    }

    // Event listeners
    header.addEventListener('click', () => {
      const isExpanded = tile.classList.contains('expanded');

      if (!isExpanded) {
        // About to expand - measure content height first
        content.style.maxHeight = 'none'; // Temporarily remove max-height to measure
        const scrollHeight = content.scrollHeight;
        content.style.maxHeight = '0'; // Reset for animation

        // Force reflow, then set the measured height
        content.offsetHeight; // Trigger reflow
        content.style.maxHeight = scrollHeight + 'px';
      } else {
        // Collapsing
        content.style.maxHeight = '0';
      }

      tile.classList.toggle('expanded');
      header.setAttribute('aria-expanded', !isExpanded);
    });

    tile.appendChild(header);
    tile.appendChild(content);
    container.appendChild(tile);
  });
}

export function renderSheenSlider(container, data = []) {
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(data) || data.length === 0) return;

  const tilesContainer = document.createElement('div');
  tilesContainer.className = 'sheen-tiles-container';
  tilesContainer.setAttribute('aria-live', 'polite');
  tilesContainer.setAttribute('aria-atomic', 'true');

  const tileElements = [];

  data.forEach((item) => {
    const tile = document.createElement('button');
    tile.className = 'sheen-tile option-card';
    tile.setAttribute('data-id', item.id);
    tile.setAttribute('data-category', 'finish-sheen');
    tile.setAttribute('data-price', String(item.price || 0));
    tile.setAttribute('aria-pressed', 'false');

    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.alt || item.title || 'placeholder';
      img.className = 'viewer-placeholder-img';
      tile.appendChild(img);
    }

    const titleRow = document.createElement('div');
    titleRow.className = 'title-price-row';
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = item.title || item.id;
    const p = document.createElement('div');
    p.className = 'price-delta';
    p.textContent = formatPriceLabel(item.price);
    titleRow.appendChild(t);
    titleRow.appendChild(p);
    tile.appendChild(titleRow);

    if (item.description) {
      const d = document.createElement('div');
      d.className = 'description';
      d.textContent = item.description;
      tile.appendChild(d);
    }

    tilesContainer.appendChild(tile);
    tileElements.push(tile);
  });

  container.appendChild(tilesContainer);

  let lastSelectedIndex = -1;

  const updateTileHighlighting = (selectedIndex) => {
    tileElements.forEach((tile, index) => {
      const isSelected = index === selectedIndex;
      tile.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      tile.classList.toggle('selected', isSelected);
    });
  };

  const dispatchSelectionEvent = (selectedIndex) => {
    const selectedItem = data[selectedIndex];
    if (!selectedItem) return;
    document.dispatchEvent(new CustomEvent('option-selected', {
      detail: {
        id: selectedItem.id,
        price: selectedItem.price || 0,
        category: 'finish-sheen'
      }
    }));
  };

  const selectIndex = (selectedIndex, options = {}) => {
    const { dispatch = true } = options;
    if (selectedIndex < 0 || selectedIndex >= data.length) return;
    const wasSelected = selectedIndex === lastSelectedIndex;
    lastSelectedIndex = selectedIndex;
    updateTileHighlighting(selectedIndex);
    container.__sheenSelectedIndex = selectedIndex;
    if (dispatch && !wasSelected) dispatchSelectionEvent(selectedIndex);
  };

  tilesContainer.addEventListener('click', (event) => {
    const tile = event.target.closest('.sheen-tile');
    if (!tile) return;
    const selectedIndex = tileElements.indexOf(tile);
    if (selectedIndex !== -1) {
      selectIndex(selectedIndex);
    }
  });

  container.__setSheenIndex = (index, options = {}) => {
    selectIndex(index, options);
  };
}

export default { renderOptionCards, renderAddonsDropdown, renderSheenSlider };
