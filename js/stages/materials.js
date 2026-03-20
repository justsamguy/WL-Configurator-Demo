import { createLogger } from '../logger.js';
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
const SOLID_ONLY_TOOLTIP = 'Only Single Color is available for Dark Grey, Caviar Black, and Solid Black.';

let customColorCard = null;
let customColorNoteContainer = null;
let customColorNoteInput = null;
let customGradientCard = null;
let customGradientNoteContainer = null;
let customGradientNoteInput = null;

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
    } else if (category === 'color-gradient') {
      setCustomGradientNoteVisibility(id === CUSTOM_GRADIENT_ID);
    }
  });

  document.addEventListener('statechange', (ev) => {
    recomputeColorGradientConstraints(ev.detail && ev.detail.state);
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
  } catch (e) { /* ignore */ }
}

export default { isMaterialsComplete, init, restoreFromState };
