import { createLogger } from '../logger.js';
import { loadData } from '../dataLoader.js';
import { isSelectionClickHandled, markSelectionClickHandled } from '../ui/selectionEventGuard.js';

const log = createLogger('Materials');

// Materials stage logic: validation and utilities
let lastKnownModel = null; // Track the model to detect changes

const CUSTOM_COLOR_ID = 'color-01';
const CUSTOM_NOTE_ATTR = 'data-custom-note';
const CUSTOM_NOTE_INPUT_ID = 'custom-color-note-input';
const CUSTOM_GRADIENT_ID = 'color-gradient-03';
const CUSTOM_GRADIENT_NOTE_INPUT_ID = 'custom-color-gradient-note-input';
const SINGLE_COLOR_GRADIENT_ID = 'color-gradient-04';
const SOLID_ONLY_COLOR_IDS = new Set(['color-06', 'color-07', 'color-08']);
const SOLID_ONLY_COLOR_SOURCE = 'single-color-only';
const SOLID_ONLY_TOOLTIP = 'Gradients are only available with multiple colors.';
const COLOR_DATA_PATH = 'data/colors.json';
const DEFAULT_GRADIENT_TEXTURE_PATH = 'assets/images/Epoxy Color Samples/Dark Grey Texture Edited.png';
const DEFAULT_GRADIENT_PREVIEW_PALETTE = Object.freeze({
  dark: '#272a31',
  light: '#d6dbe3',
  solid: '#7a828d'
});
const LIGHT_CENTER_GRADIENT_TYPE = 'light-center';
const COLOR_GRADIENT_PREVIEW_TYPES = Object.freeze({
  'color-gradient-01': 'dark-to-light',
  'color-gradient-02': 'light-center',
  'color-gradient-03': 'custom',
  'color-gradient-04': 'single-color'
});

let customColorCard = null;
let customColorNoteContainer = null;
let customColorNoteInput = null;
let customGradientCard = null;
let customGradientNoteContainer = null;
let customGradientNoteInput = null;
let colorPreviewDataMapPromise = null;
let gradientPreviewSyncToken = 0;

function normalizeHexColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
}

function hexToRgb(value) {
  const normalized = normalizeHexColor(value, null);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  const hex = raw.length === 3
    ? raw.split('').map((channel) => channel + channel).join('')
    : raw;
  const numeric = Number.parseInt(hex, 16);
  if (!Number.isFinite(numeric)) return null;
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255
  };
}

function toRgba(value, alpha) {
  const rgb = hexToRgb(value);
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha)));
  if (!rgb) return `rgba(39, 42, 49, ${safeAlpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}

function normalizePreviewPalette(value = {}) {
  const safeValue = value && typeof value === 'object' ? value : {};
  return {
    dark: normalizeHexColor(safeValue.dark, DEFAULT_GRADIENT_PREVIEW_PALETTE.dark),
    light: normalizeHexColor(safeValue.light, DEFAULT_GRADIENT_PREVIEW_PALETTE.light),
    solid: normalizeHexColor(safeValue.solid, DEFAULT_GRADIENT_PREVIEW_PALETTE.solid)
  };
}

async function getColorPreviewDataMap() {
  if (!colorPreviewDataMapPromise) {
    colorPreviewDataMapPromise = loadData(COLOR_DATA_PATH).then((colors) => {
      const previewDataMap = new Map();
      if (!Array.isArray(colors)) return previewDataMap;
      colors.forEach((color) => {
        if (!color || typeof color.id !== 'string') return;
        const textureSrc = typeof color.image === 'string' && color.image.trim()
          ? color.image.trim()
          : DEFAULT_GRADIENT_TEXTURE_PATH;
        const gradientImages = color.gradientImages && typeof color.gradientImages === 'object'
          ? color.gradientImages
          : {};
        previewDataMap.set(color.id, {
          palette: normalizePreviewPalette(color.previewPalette),
          textureSrc,
          lightCenterTextureSrc: typeof gradientImages[LIGHT_CENTER_GRADIENT_TYPE] === 'string'
            ? gradientImages[LIGHT_CENTER_GRADIENT_TYPE].trim()
            : ''
        });
      });
      return previewDataMap;
    });
  }
  return colorPreviewDataMapPromise;
}

function getSelectedColorId(appState = {}) {
  const options = appState && appState.selections && appState.selections.options
    ? appState.selections.options
    : {};
  return typeof options.color === 'string' ? options.color : null;
}

function createGradientPreviewElement(card, textureSrc, previewType) {
  const preview = document.createElement('div');
  preview.className = 'viewer-placeholder-img color-gradient-preview';
  preview.setAttribute('aria-hidden', 'true');
  preview.dataset.textureSrc = textureSrc || DEFAULT_GRADIENT_TEXTURE_PATH;
  preview.dataset.previewType = previewType;
  const image = card.querySelector('.viewer-placeholder-img');
  if (image) {
    image.replaceWith(preview);
  } else {
    card.insertBefore(preview, card.firstChild);
  }
  return preview;
}

function ensureGradientPreviewSlots() {
  const cards = document.querySelectorAll('.option-card[data-category="color-gradient"]');
  if (!cards.length) return [];

  return Array.from(cards).map((card) => {
    const previewType = card.getAttribute('data-preview-type')
      || COLOR_GRADIENT_PREVIEW_TYPES[card.getAttribute('data-id')]
      || 'single-color';
    const existingPreview = card.querySelector('.color-gradient-preview');
    if (existingPreview) {
      if (!existingPreview.dataset.previewType) existingPreview.dataset.previewType = previewType;
      if (!existingPreview.dataset.textureSrc) {
        existingPreview.dataset.textureSrc = DEFAULT_GRADIENT_TEXTURE_PATH;
      }
      return existingPreview;
    }

    const image = card.querySelector('.viewer-placeholder-img');
    const textureSrc = image && image.getAttribute('src')
      ? image.getAttribute('src')
      : DEFAULT_GRADIENT_TEXTURE_PATH;
    return createGradientPreviewElement(card, textureSrc, previewType);
  });
}

function buildGradientPreviewStyles(previewType, palette, textureSrc, hasDedicatedTexture = false) {
  const textureLayer = `url("${textureSrc || DEFAULT_GRADIENT_TEXTURE_PATH}")`;
  switch (previewType) {
    case 'dark-to-light':
      return {
        backgroundImage: textureLayer,
        backgroundBlendMode: 'normal'
      };
    case 'light-center':
      if (hasDedicatedTexture) {
        return {
          backgroundImage: textureLayer,
          backgroundBlendMode: 'normal'
        };
      }
      return {
        backgroundImage: [
          `linear-gradient(90deg, ${toRgba(palette.dark, 0.68)} 0%, ${toRgba(palette.dark, 0.34)} 18%, rgba(255, 255, 255, 0) 34%, rgba(255, 255, 255, 0) 66%, ${toRgba(palette.dark, 0.34)} 82%, ${toRgba(palette.dark, 0.68)} 100%)`,
          `linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, ${toRgba(palette.light, 0.18)} 28%, ${toRgba(palette.light, 0.78)} 50%, ${toRgba(palette.light, 0.18)} 72%, rgba(255, 255, 255, 0) 100%)`,
          textureLayer
        ].join(', '),
        backgroundBlendMode: 'multiply, screen, normal'
      };
    case 'custom':
      return {
        backgroundImage: [
          `linear-gradient(145deg, ${toRgba(DEFAULT_GRADIENT_PREVIEW_PALETTE.dark, 0.92)} 0%, ${toRgba(DEFAULT_GRADIENT_PREVIEW_PALETTE.solid, 0.7)} 48%, ${toRgba(DEFAULT_GRADIENT_PREVIEW_PALETTE.light, 0.76)} 100%)`,
          textureLayer
        ].join(', '),
        backgroundBlendMode: 'soft-light, normal'
      };
    case 'single-color':
    default:
      return {
        backgroundImage: [
          `linear-gradient(135deg, ${toRgba(palette.solid, 0.84)} 0%, ${toRgba(palette.solid, 0.84)} 100%)`,
          textureLayer
        ].join(', '),
        backgroundBlendMode: 'multiply, normal'
      };
  }
}

async function syncColorGradientPreviews(appState = {}) {
  const previews = ensureGradientPreviewSlots();
  if (!previews.length) return;

  const syncToken = ++gradientPreviewSyncToken;
  const previewDataMap = await getColorPreviewDataMap();
  if (syncToken !== gradientPreviewSyncToken) return;

  const selectedColorId = getSelectedColorId(appState);
  const useNeutralPalette = !selectedColorId || selectedColorId === CUSTOM_COLOR_ID;
  const selectedPreviewData = !useNeutralPalette && previewDataMap.has(selectedColorId)
    ? previewDataMap.get(selectedColorId)
    : null;
  const selectedPalette = selectedPreviewData && selectedPreviewData.palette
    ? selectedPreviewData.palette
    : DEFAULT_GRADIENT_PREVIEW_PALETTE;
  const selectedTextureSrc = selectedPreviewData && selectedPreviewData.textureSrc
    ? selectedPreviewData.textureSrc
    : DEFAULT_GRADIENT_TEXTURE_PATH;

  previews.forEach((preview) => {
    const previewType = preview.dataset.previewType || 'single-color';
    const palette = previewType === 'custom' ? DEFAULT_GRADIENT_PREVIEW_PALETTE : selectedPalette;
    const hasDedicatedLightCenterTexture = previewType === LIGHT_CENTER_GRADIENT_TYPE
      && !!(selectedPreviewData && selectedPreviewData.lightCenterTextureSrc);
    const textureSrc = hasDedicatedLightCenterTexture
      ? selectedPreviewData.lightCenterTextureSrc
      : previewType === 'custom' || previewType === 'single-color'
      ? preview.dataset.textureSrc || DEFAULT_GRADIENT_TEXTURE_PATH
      : selectedTextureSrc;
    const styles = buildGradientPreviewStyles(previewType, palette, textureSrc, hasDedicatedLightCenterTexture);
    preview.style.backgroundImage = styles.backgroundImage;
    preview.style.backgroundBlendMode = styles.backgroundBlendMode;
  });
}

function ensureCustomColorNoteField() {
  if (customColorCard && customColorNoteContainer && customColorNoteInput) return;
  const card = document.querySelector(`.option-card[data-category="color"][${CUSTOM_NOTE_ATTR}]`);
  if (!card) return;
  customColorCard = card;
  let noteContainer = card.querySelector('.custom-color-note-container');
  if (!noteContainer) {
    noteContainer = document.createElement('div');
    noteContainer.className = 'custom-color-note-container';

    const label = document.createElement('label');
    label.className = 'custom-color-note-label';
    label.setAttribute('for', CUSTOM_NOTE_INPUT_ID);
    label.textContent = 'Custom color notes';

    const textarea = document.createElement('textarea');
    textarea.className = 'custom-color-note';
    textarea.id = CUSTOM_NOTE_INPUT_ID;
    textarea.placeholder = 'Describe the custom color you are after, include reference tones if helpful.';
    textarea.rows = 3;
    textarea.setAttribute('aria-label', 'Custom color notes');

    noteContainer.appendChild(label);
    noteContainer.appendChild(textarea);

    textarea.addEventListener('input', () => {
      document.dispatchEvent(new CustomEvent('custom-color-note-updated', { detail: { value: textarea.value } }));
    });

    customColorNoteInput = textarea;
  } else {
    customColorNoteInput = noteContainer.querySelector('.custom-color-note');
  }
  customColorNoteContainer = noteContainer;
}

function setCustomColorNoteVisibility(isVisible) {
  if (!customColorCard || !customColorNoteContainer) return;
  customColorCard.classList.toggle('custom-color-active', isVisible);
  if (isVisible) {
    if (!customColorNoteContainer.parentElement) {
      const descriptionEl = customColorCard.querySelector('.description');
      if (descriptionEl && descriptionEl.parentElement === customColorCard) {
        descriptionEl.insertAdjacentElement('afterend', customColorNoteContainer);
      } else {
        customColorCard.appendChild(customColorNoteContainer);
      }
    }
  } else {
    if (customColorNoteContainer.parentElement) {
      customColorNoteContainer.parentElement.removeChild(customColorNoteContainer);
    }
  }
}

function syncCustomColorNoteValue(value = '') {
  if (!customColorNoteInput) return;
  customColorNoteInput.value = value;
}

function ensureCustomGradientNoteField() {
  if (customGradientCard && customGradientNoteContainer && customGradientNoteInput) return;
  const card = document.querySelector(`.option-card[data-category="color-gradient"][${CUSTOM_NOTE_ATTR}]`);
  if (!card) return;
  customGradientCard = card;
  let noteContainer = card.querySelector('.custom-gradient-note-container');
  if (!noteContainer) {
    noteContainer = document.createElement('div');
    noteContainer.className = 'custom-gradient-note-container custom-color-note-container';

    const label = document.createElement('label');
    label.className = 'custom-gradient-note-label custom-color-note-label';
    label.setAttribute('for', CUSTOM_GRADIENT_NOTE_INPUT_ID);
    label.textContent = 'Custom gradient notes';

    const textarea = document.createElement('textarea');
    textarea.className = 'custom-gradient-note custom-color-note';
    textarea.id = CUSTOM_GRADIENT_NOTE_INPUT_ID;
    textarea.placeholder = 'Describe the gradient direction, center highlight, and color transitions you want.';
    textarea.rows = 3;
    textarea.setAttribute('aria-label', 'Custom color gradient notes');

    noteContainer.appendChild(label);
    noteContainer.appendChild(textarea);

    textarea.addEventListener('input', () => {
      document.dispatchEvent(new CustomEvent('custom-color-gradient-note-updated', { detail: { value: textarea.value } }));
    });

    customGradientNoteInput = textarea;
  } else {
    customGradientNoteInput = noteContainer.querySelector('.custom-gradient-note');
  }
  customGradientNoteContainer = noteContainer;
}

function setCustomGradientNoteVisibility(isVisible) {
  if (!customGradientCard || !customGradientNoteContainer) return;
  customGradientCard.classList.toggle('custom-color-active', isVisible);
  if (isVisible) {
    if (!customGradientNoteContainer.parentElement) {
      const descriptionEl = customGradientCard.querySelector('.description');
      if (descriptionEl && descriptionEl.parentElement === customGradientCard) {
        descriptionEl.insertAdjacentElement('afterend', customGradientNoteContainer);
      } else {
        customGradientCard.appendChild(customGradientNoteContainer);
      }
    }
  } else if (customGradientNoteContainer.parentElement) {
    customGradientNoteContainer.parentElement.removeChild(customGradientNoteContainer);
  }
}

function syncCustomGradientNoteValue(value = '') {
  if (!customGradientNoteInput) return;
  customGradientNoteInput.value = value;
}

function getDisabledByList(el) {
  const raw = el && el.getAttribute('data-disabled-by');
  return raw ? raw.split('||').filter(Boolean) : [];
}

function addDisabledBy(el, sourceTitle, tooltipText) {
  if (!el || !sourceTitle) return;
  const list = getDisabledByList(el);
  if (!list.includes(sourceTitle)) list.push(sourceTitle);
  el.setAttribute('data-disabled-by', list.join('||'));
  el.setAttribute('disabled', 'true');
  if (tooltipText) el.setAttribute('data-tooltip', tooltipText);
}

function removeDisabledBy(el, sourceTitle) {
  if (!el || !sourceTitle) return;
  const list = getDisabledByList(el).filter((item) => item !== sourceTitle);
  if (list.length) {
    el.setAttribute('data-disabled-by', list.join('||'));
    el.setAttribute('disabled', 'true');
  } else {
    el.removeAttribute('data-disabled-by');
    el.removeAttribute('disabled');
  }
  if (list.length === 0 || el.getAttribute('data-tooltip') === SOLID_ONLY_TOOLTIP) {
    el.removeAttribute('data-tooltip');
  }
}

function recomputeColorGradientConstraints(appState) {
  const opts = appState && appState.selections && appState.selections.options ? appState.selections.options : {};
  const selectedColorId = opts.color || null;
  const selectedGradientId = opts['color-gradient'] || null;
  const solidOnly = SOLID_ONLY_COLOR_IDS.has(selectedColorId);
  const gradientCards = document.querySelectorAll('.option-card[data-category="color-gradient"]');
  if (!gradientCards.length) return;

  gradientCards.forEach((card) => {
    const gradientId = card.getAttribute('data-id');
    const shouldDisable = solidOnly && gradientId !== SINGLE_COLOR_GRADIENT_ID;
    if (shouldDisable) {
      addDisabledBy(card, SOLID_ONLY_COLOR_SOURCE, SOLID_ONLY_TOOLTIP);
      card.setAttribute('aria-pressed', 'false');
      return;
    }
    removeDisabledBy(card, SOLID_ONLY_COLOR_SOURCE);
  });

  if (solidOnly && selectedGradientId !== SINGLE_COLOR_GRADIENT_ID) {
    const singleColorCard = document.querySelector(`.option-card[data-id="${SINGLE_COLOR_GRADIENT_ID}"]`);
    if (singleColorCard) {
      document.dispatchEvent(new CustomEvent('option-selected', {
        detail: {
          id: SINGLE_COLOR_GRADIENT_ID,
          price: Number(singleColorCard.getAttribute('data-price')) || 0,
          category: 'color-gradient'
        }
      }));
    }
  }
}

export function isMaterialsComplete(appState) {
  try {
    const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
    const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
    const hasColorGradient = !!(appState.selections && appState.selections.options && appState.selections.options['color-gradient']);
    return !!(hasMaterial && hasColor && hasColorGradient);
  } catch (e) {
    return false;
  }
}

// Initialize materials stage interactions. This wires option-selected events for
// single-choice material/color option-cards under the materials panel.
export function init() {
  ensureCustomColorNoteField();
  ensureCustomGradientNoteField();
  setCustomColorNoteVisibility(false);
  setCustomGradientNoteVisibility(false);
  recomputeColorGradientConstraints();
  void syncColorGradientPreviews();

  // Delegate click handling for material and color option-cards
  document.addEventListener('click', (ev) => {
    if (isSelectionClickHandled(ev)) return;
    const card = ev.target.closest && ev.target.closest('.option-card[data-category="material"], .option-card[data-category="color"], .option-card[data-category="color-gradient"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    markSelectionClickHandled(ev);
    // Visual pressed state for category
    const category = card.getAttribute('data-category');
    if (category) {
      document.querySelectorAll(`.option-card[data-category="${category}"]`).forEach((c) => {
        c.setAttribute('aria-pressed', c === card ? 'true' : 'false');
      });
      const id = card.getAttribute('data-id');
      const price = Number(card.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category } }));
    }
  });

  document.addEventListener('option-selected', (ev) => {
    const { category, id } = ev.detail || {};
    if (category === 'color') {
      setCustomColorNoteVisibility(id === CUSTOM_COLOR_ID);
      void syncColorGradientPreviews({
        selections: {
          options: {
            color: id
          }
        }
      });
    } else if (category === 'color-gradient') {
      setCustomGradientNoteVisibility(id === CUSTOM_GRADIENT_ID);
    }
  });

  document.addEventListener('statechange', (ev) => {
    recomputeColorGradientConstraints(ev.detail && ev.detail.state);
    void syncColorGradientPreviews(ev.detail && ev.detail.state);
  });
}

export function restoreFromState(appState) {
  try {
    ensureCustomColorNoteField();
    ensureCustomGradientNoteField();

    // Check if model has changed and clear selections if needed
    const currentModel = appState && appState.selections && appState.selections.model;
    if (currentModel !== lastKnownModel) {
      log.debug('Model changed, clearing visual selections', { from: lastKnownModel, to: currentModel });
      // Clear visual state for material and color cards when model changes
      document.querySelectorAll('.option-card[data-category="material"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      document.querySelectorAll('.option-card[data-category="color"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      document.querySelectorAll('.option-card[data-category="color-gradient"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      lastKnownModel = currentModel;
    }
    
    const opts = appState && appState.selections && appState.selections.options ? appState.selections.options : {};
    ['material', 'color', 'color-gradient'].forEach(cat => {
      const id = opts[cat];
      if (!id) return;
      const el = document.querySelector(`.option-card[data-id="${id}"]`);
      if (el) {
        document.querySelectorAll(`.option-card[data-category="${cat}"]`).forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    });

    const selectedColorId = opts.color;
    setCustomColorNoteVisibility(selectedColorId === CUSTOM_COLOR_ID);
    const storedNote = opts.customColorNote || '';
    syncCustomColorNoteValue(storedNote);
    const selectedColorGradientId = opts['color-gradient'];
    setCustomGradientNoteVisibility(selectedColorGradientId === CUSTOM_GRADIENT_ID);
    const storedGradientNote = opts.customColorGradientNote || '';
    syncCustomGradientNoteValue(storedGradientNote);
    recomputeColorGradientConstraints(appState);
    void syncColorGradientPreviews(appState);
  } catch (e) { /* ignore */ }
}

export default { isMaterialsComplete, init, restoreFromState };
