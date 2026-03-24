import { createLogger } from '../logger.js';
import { isSelectionClickHandled, markSelectionClickHandled } from '../ui/selectionEventGuard.js';

const log = createLogger('Designs');
const GROUP_SELECTOR = '#designs-stage-section .designs-stage-group';
const TOGGLE_SELECTOR = '.designs-stage-toggle';
const PANEL_SELECTOR = '.designs-stage-panel';
const PANEL_TRANSITION_MS = 240;

function getAccordionGroups() {
  return Array.from(document.querySelectorAll(GROUP_SELECTOR));
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clearPanelTransitionState(panel) {
  if (!panel) return;
  if (panel._wlAccordionTimeoutId) {
    window.clearTimeout(panel._wlAccordionTimeoutId);
    delete panel._wlAccordionTimeoutId;
  }
  if (panel._wlAccordionTransitionEnd) {
    panel.removeEventListener('transitionend', panel._wlAccordionTransitionEnd);
    delete panel._wlAccordionTransitionEnd;
  }
}

function finishOpenState(panel) {
  if (!panel) return;
  clearPanelTransitionState(panel);
  panel.hidden = false;
  panel.style.maxHeight = 'none';
  panel.style.opacity = '1';
}

function finishClosedState(panel) {
  if (!panel) return;
  clearPanelTransitionState(panel);
  panel.hidden = true;
  panel.style.maxHeight = '0px';
  panel.style.opacity = '0';
}

function animatePanelOpen(panel) {
  if (!panel) return;
  clearPanelTransitionState(panel);
  panel.hidden = false;
  panel.style.maxHeight = '0px';
  panel.style.opacity = '0';
  const targetHeight = panel.scrollHeight;
  const expandFrame = () => {
    panel.style.maxHeight = `${targetHeight}px`;
    panel.style.opacity = '1';
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(expandFrame);
  else expandFrame();

  const onExpandTransitionEnd = (ev) => {
    if (ev.target !== panel || ev.propertyName !== 'max-height') return;
    finishOpenState(panel);
  };
  panel._wlAccordionTransitionEnd = onExpandTransitionEnd;
  panel.addEventListener('transitionend', onExpandTransitionEnd);
  panel._wlAccordionTimeoutId = window.setTimeout(() => finishOpenState(panel), PANEL_TRANSITION_MS + 80);
}

function animatePanelClosed(panel) {
  if (!panel) return;
  clearPanelTransitionState(panel);
  panel.hidden = false;
  panel.style.maxHeight = `${panel.scrollHeight}px`;
  panel.style.opacity = '1';
  const collapseFrame = () => {
    panel.style.maxHeight = '0px';
    panel.style.opacity = '0';
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(collapseFrame);
  else collapseFrame();

  const onCollapseTransitionEnd = (ev) => {
    if (ev.target !== panel || ev.propertyName !== 'max-height') return;
    finishClosedState(panel);
  };
  panel._wlAccordionTransitionEnd = onCollapseTransitionEnd;
  panel.addEventListener('transitionend', onCollapseTransitionEnd);
  panel._wlAccordionTimeoutId = window.setTimeout(() => finishClosedState(panel), PANEL_TRANSITION_MS + 80);
}

function setGroupOpen(group, shouldOpen, options = {}) {
  if (!group) return;
  const { animate = !prefersReducedMotion() } = options;
  const toggle = group.querySelector(TOGGLE_SELECTOR);
  const panel = group.querySelector(PANEL_SELECTOR);
  const isOpen = group.classList.contains('is-open');
  if (isOpen === shouldOpen) {
    if (!animate && panel) {
      panel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
      if ('inert' in panel) panel.inert = !shouldOpen;
      if (shouldOpen) finishOpenState(panel);
      else finishClosedState(panel);
    }
    if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    return;
  }
  group.classList.toggle('is-open', shouldOpen);
  if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (panel) {
    panel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    if ('inert' in panel) panel.inert = !shouldOpen;
    if (!animate) {
      if (shouldOpen) finishOpenState(panel);
      else finishClosedState(panel);
      return;
    }
    if (shouldOpen) animatePanelOpen(panel);
    else animatePanelClosed(panel);
  }
}

function syncAccordionFromDom() {
  getAccordionGroups().forEach((group) => {
    const toggle = group.querySelector(TOGGLE_SELECTOR);
    const shouldOpen = toggle ? toggle.getAttribute('aria-expanded') === 'true' : group.classList.contains('is-open');
    setGroupOpen(group, shouldOpen, { animate: false });
  });
}

function toggleAccordionGroup(targetGroup) {
  if (!targetGroup) return;
  const isOpen = targetGroup.classList.contains('is-open');
  getAccordionGroups().forEach((group) => {
    setGroupOpen(group, group === targetGroup ? !isOpen : false, { animate: true });
  });
}

function openGroupForCard(card) {
  const group = card && card.closest ? card.closest('.designs-stage-group') : null;
  if (!group) return;
  getAccordionGroups().forEach((item) => setGroupOpen(item, item === group, { animate: true }));
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
