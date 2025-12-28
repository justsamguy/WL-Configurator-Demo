// Renders option-card buttons from a data array into a container element.
// data: array of { id, title, price, image, description, disabled, tooltip }
export function renderOptionCards(container, data = [], opts = {}) {
  if (!container) return;
  container.innerHTML = '';
  data.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'option-card';
    btn.setAttribute('data-id', item.id);
    if (opts.category) btn.setAttribute('data-category', opts.category);
    if (typeof item.price !== 'undefined') btn.setAttribute('data-price', String(item.price));
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

    container.appendChild(btn);
  });
}

export function renderAddonsDropdown(container, data = []) {
  if (!container) return;
  container.innerHTML = '';

  data.forEach(group => {
    const tile = document.createElement('div');
    tile.className = 'addons-dropdown-tile';
    tile.setAttribute('data-id', group.title);

    // Header (clickable to expand/collapse)
    const header = document.createElement('button');
    header.className = 'addons-dropdown-header';
    header.setAttribute('aria-expanded', 'false');

    const titlePrice = document.createElement('div');
    titlePrice.className = 'addons-dropdown-title-price';

    const title = document.createElement('div');
    title.className = 'addons-dropdown-title';
    title.textContent = group.title;

    const price = document.createElement('div');
    price.className = 'addons-dropdown-price';
    if (group.options && group.options.length === 1) {
      price.textContent = group.options[0].price ? `+$${group.options[0].price}` : '+$0';
    } else {
      price.textContent = '';
    }

    titlePrice.appendChild(title);
    titlePrice.appendChild(price);

    // Chevron icon
    const chevron = document.createElement('svg');
    chevron.className = 'addons-dropdown-chevron';
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';

    header.appendChild(titlePrice);
    header.appendChild(chevron);

    // Content (expandable)
    const content = document.createElement('div');
    content.className = 'addons-dropdown-content';

    const options = document.createElement('div');
    options.className = 'addons-dropdown-options';

    // Options for this group
    if (group.options) {
      group.options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'addons-dropdown-option';
        optionDiv.setAttribute('data-addon-id', option.id);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'addons-dropdown-option-checkbox';
        checkbox.setAttribute('data-addon-id', option.id);

        const label = document.createElement('div');
        label.className = 'addons-dropdown-option-label';
        label.textContent = option.title;

        const optionPrice = document.createElement('div');
        optionPrice.className = 'addons-dropdown-option-price';
        optionPrice.textContent = option.price ? `+$${option.price}` : '+$0';

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(label);
        optionDiv.appendChild(optionPrice);

        options.appendChild(optionDiv);
      });
    }

    // Description if available
    if (group.description) {
      const desc = document.createElement('div');
      desc.className = 'addons-dropdown-description';
      desc.textContent = group.description;
      content.appendChild(desc);
    }

    content.appendChild(options);

    // Handle disabled state
    if (group.disabled) {
      tile.setAttribute('disabled', 'true');
      header.setAttribute('disabled', 'true');
      tile.querySelectorAll('input').forEach(input => input.disabled = true);
      if (group.tooltip) {
        tile.setAttribute('data-tooltip', group.tooltip);
      }
    }

    // Event listeners
    header.addEventListener('click', () => {
      if (group.disabled) return;
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

    // Checkbox change events
    tile.querySelectorAll('.addons-dropdown-option-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const optionDiv = e.target.closest('.addons-dropdown-option');
        if (optionDiv) optionDiv.classList.toggle('selected', checked);
        const id = e.target.getAttribute('data-addon-id');
        const option = group.options.find(o => o.id === id);
        const price = option ? option.price || 0 : 0;
        document.dispatchEvent(new CustomEvent('addon-toggled', {
          detail: { id, price, checked }
        }));
      });
    });

    tile.appendChild(header);
    tile.appendChild(content);
    container.appendChild(tile);
  });
}

export default { renderOptionCards, renderAddonsDropdown };
