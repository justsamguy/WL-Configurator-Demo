import { createLogger } from '../logger.js';
import { isSelectionClickHandled, markSelectionClickHandled } from '../ui/selectionEventGuard.js';

const log = createLogger('Designs');
const GROUP_SELECTOR = '#designs-stage-section .designs-stage-group';
const TOGGLE_SELECTOR = '.designs-stage-toggle';
const PANEL_SELECTOR = '.designs-stage-panel';

function getAccordionGroups() {
  return Array.from(document.querySelectorAll(GROUP_SELECTOR));
}

function setGroupOpen(group, shouldOpen) {
  if (!group) return;
  const toggle = group.querySelector(TOGGLE_SELECTOR);
  const panel = group.querySelector(PANEL_SELECTOR);
  group.classList.toggle('is-open', shouldOpen);
  if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (panel) {
    panel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    if ('inert' in panel) panel.inert = !shouldOpen;
  }
}

function syncAccordionFromDom() {
  getAccordionGroups().forEach((group) => {
    const toggle = group.querySelector(TOGGLE_SELECTOR);
    const shouldOpen = toggle ? toggle.getAttribute('aria-expanded') === 'true' : group.classList.contains('is-open');
    setGroupOpen(group, shouldOpen);
  });
}

function toggleAccordionGroup(targetGroup) {
  if (!targetGroup) return;
  const isOpen = targetGroup.classList.contains('is-open');
  getAccordionGroups().forEach((group) => {
    setGroupOpen(group, group === targetGroup ? !isOpen : false);
  });
}

function openGroupForCard(card) {
  const group = card && card.closest ? card.closest('.designs-stage-group') : null;
  if (!group) return;
  getAccordionGroups().forEach((item) => setGroupOpen(item, item === group));
}

// Designs stage module
// Single responsibility: load designs filtered by selected model, wire design option-card interactions,
// and restore visual selections from state.
// Exports:
// - init(): attaches event handlers for design selection, dispatches standardized events
// - restoreFromState(state): restores visual ARIA state for the selected design

export function init() {
  syncAccordionFromDom();

  document.addEventListener('click', (ev) => {
    const toggle = ev.target.closest && ev.target.closest(`#designs-stage-section ${TOGGLE_SELECTOR}`);
    if (!toggle) return;
    toggleAccordionGroup(toggle.closest('.designs-stage-group'));
  });

  // Delegate clicks on design option-cards. Dispatch 'option-selected' event with category 'design'
  // for main.js to handle global state mutation and price updates.
  document.addEventListener('click', (ev) => {
    if (isSelectionClickHandled(ev)) return;
    const card = ev.target.closest && ev.target.closest('#designs-stage-section .option-card[data-category="design"], #designs-stage-section .option-card[data-id^="des-"]');
    if (!card) return;
    if (card.hasAttribute('disabled')) return;
    markSelectionClickHandled(ev);
    openGroupForCard(card);

    // Set visual pressed state in one pass so deselection and selection update together.
    document.querySelectorAll('#designs-stage-section .option-card[data-category="design"], #designs-stage-section .option-card[data-id^="des-"]').forEach((c) => {
      c.setAttribute('aria-pressed', c === card ? 'true' : 'false');
    });

    const id = card.getAttribute('data-design-id') || card.getAttribute('data-id');
    const presetId = card.getAttribute('data-preset-id') || null;

    // Dispatch the standardized selection event with category 'design' for main.js to handle
    document.dispatchEvent(new CustomEvent('option-selected', { detail: { id, category: 'design', presetId } }));
  });
}

export function restoreFromState(state) {
  try {
    syncAccordionFromDom();
    const designId = state && state.selections && state.selections.design;
    if (!designId) return;
    const el = document.querySelector(`#design-layout-options .option-card[data-id="${designId}"]`) ||
      document.querySelector(`#designs-stage-section .option-card[data-id="${designId}"]:not([data-preset-id])`);
    if (el) {
      document.querySelectorAll('#designs-stage-section .option-card[data-category="design"], #designs-stage-section .option-card[data-id^="des-"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', 'true');
      openGroupForCard(el);
    }
  } catch (e) {
    // fail silently
    log.warn('restoreFromState failed', e);
  }
}

export default { init, restoreFromState };
