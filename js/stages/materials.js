// Materials stage logic: validation and utilities
let lastKnownModel = null; // Track the model to detect changes

const CUSTOM_COLOR_ID = 'color-01';
const CUSTOM_NOTE_ATTR = 'data-custom-note';
const CUSTOM_COLOR_WRAPPER_CLASS = 'custom-color-wrapper';
const CUSTOM_NOTE_INPUT_ID = 'custom-color-note-input';

let customColorWrapper = null;
let customColorNoteContainer = null;
let customColorNoteInput = null;

function ensureCustomColorNoteField() {
  if (customColorWrapper) return;
  const customCard = document.querySelector(`.option-card[${CUSTOM_NOTE_ATTR}]`);
  if (!customCard) return;
  const existingWrapper = customCard.closest(`.${CUSTOM_COLOR_WRAPPER_CLASS}`);
  if (existingWrapper) {
    customColorWrapper = existingWrapper;
    customColorNoteContainer = customColorWrapper.querySelector('.custom-color-note-container');
    customColorNoteInput = customColorWrapper.querySelector('.custom-color-note');
    return;
  }

  const parent = customCard.parentElement;
  if (!parent) return;

  const wrapper = document.createElement('div');
  wrapper.className = CUSTOM_COLOR_WRAPPER_CLASS;
  wrapper.setAttribute('data-custom-color-wrapper', 'true');
  parent.insertBefore(wrapper, customCard);
  wrapper.appendChild(customCard);

  const noteContainer = document.createElement('div');
  noteContainer.className = 'custom-color-note-container';
  noteContainer.hidden = true;

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
  wrapper.appendChild(noteContainer);

  textarea.addEventListener('input', () => {
    document.dispatchEvent(new CustomEvent('custom-color-note-updated', { detail: { value: textarea.value } }));
  });

  customColorWrapper = wrapper;
  customColorNoteContainer = noteContainer;
  customColorNoteInput = textarea;
}

function setCustomColorNoteVisibility(isVisible) {
  if (!customColorWrapper || !customColorNoteContainer) return;
  if (isVisible) {
    customColorWrapper.classList.add('custom-color-active');
    customColorNoteContainer.hidden = false;
  } else {
    customColorWrapper.classList.remove('custom-color-active');
    customColorNoteContainer.hidden = true;
  }
}

function syncCustomColorNoteValue(value = '') {
  if (!customColorNoteInput) return;
  customColorNoteInput.value = value;
}

export function isMaterialsComplete(appState) {
  try {
    const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
    const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
    return !!(hasMaterial && hasColor);
  } catch (e) {
    return false;
  }
}

// Initialize materials stage interactions. This wires option-selected events for
// single-choice material/color option-cards under the materials panel.
export function init() {
  ensureCustomColorNoteField();
  setCustomColorNoteVisibility(false);

  // Delegate click handling for material and color option-cards
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.option-card[data-category="material"], .option-card[data-category="color"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    // Visual pressed state for category
    const category = card.getAttribute('data-category');
    if (category) {
      document.querySelectorAll(`.option-card[data-category="${category}"]`).forEach(c => c.setAttribute('aria-pressed', 'false'));
      card.setAttribute('aria-pressed', 'true');
      const id = card.getAttribute('data-id');
      const price = Number(card.getAttribute('data-price')) || 0;
      document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, price, category } }));
    }
  });

  document.addEventListener('option-selected', (ev) => {
    const { category, id } = ev.detail || {};
    if (category === 'color') {
      setCustomColorNoteVisibility(id === CUSTOM_COLOR_ID);
    }
  });
}

export function restoreFromState(appState) {
  try {
    ensureCustomColorNoteField();

    // Check if model has changed and clear selections if needed
    const currentModel = appState && appState.selections && appState.selections.model;
    if (currentModel !== lastKnownModel) {
      console.log('[Materials] Model changed from', lastKnownModel, 'to', currentModel, '- clearing visual selections');
      // Clear visual state for material and color cards when model changes
      document.querySelectorAll('.option-card[data-category="material"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      document.querySelectorAll('.option-card[data-category="color"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      lastKnownModel = currentModel;
    }
    
    const opts = appState && appState.selections && appState.selections.options ? appState.selections.options : {};
    ['material', 'color'].forEach(cat => {
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
  } catch (e) { /* ignore */ }
}

export default { isMaterialsComplete, init, restoreFromState };
