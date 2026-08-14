import { createLogger } from '../logger.js';
import { isSelectionClickHandled, markSelectionClickHandled } from '../ui/selectionEventGuard.js';

const log = createLogger('Designs');
const ROOT_SELECTOR = '#designs-stage-section';
const SHELL_SELECTOR = `${ROOT_SELECTOR} .designs-stage-shell`;
const GROUP_SELECTOR = `${ROOT_SELECTOR} .designs-stage-group`;
const TAB_SELECTOR = `${ROOT_SELECTOR} .designs-stage-tab`;
const VIEWPORT_SELECTOR = `${ROOT_SELECTOR} .designs-stage-panels`;
const TAB_ORDER = ['presets', 'layouts'];
const PANEL_TRANSITION_MS = 320;

function getShell() {
  return document.querySelector(SHELL_SELECTOR);
}

function getViewport() {
  return document.querySelector(VIEWPORT_SELECTOR);
}

function getTabs() {
  return Array.from(document.querySelectorAll(TAB_SELECTOR));
}

function getGroups() {
  return Array.from(document.querySelectorAll(GROUP_SELECTOR));
}

function getVisibleGroup() {
  return getGroups().find((group) => group.classList.contains('is-open') && !group.hidden)
    || getGroups().find((group) => !group.hidden)
    || null;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getGroupType(element) {
  return element && element.dataset ? element.dataset.groupType || null : null;
}

function normalizeGroupType(groupType) {
  return TAB_ORDER.includes(groupType) ? groupType : TAB_ORDER[0];
}

function getGroupByType(groupType) {
  return document.querySelector(`${GROUP_SELECTOR}[data-group-type="${normalizeGroupType(groupType)}"]`);
}

function getActiveGroupType() {
  const activeTab = getTabs().find((tab) => tab.getAttribute('aria-selected') === 'true');
  if (activeTab) return normalizeGroupType(getGroupType(activeTab));
  const openGroup = getGroups().find((group) => group.classList.contains('is-open') && !group.hidden);
  if (openGroup) return normalizeGroupType(getGroupType(openGroup));
  return TAB_ORDER[0];
}

function setTabSelected(tab, shouldSelect) {
  if (!tab) return;
  tab.classList.toggle('is-active', shouldSelect);
  tab.setAttribute('aria-selected', shouldSelect ? 'true' : 'false');
  tab.setAttribute('tabindex', shouldSelect ? '0' : '-1');
}

function setGroupSelected(group, shouldSelect) {
  if (!group) return;
  group.classList.toggle('is-open', shouldSelect);
  group.hidden = !shouldSelect;
  group.setAttribute('aria-hidden', shouldSelect ? 'false' : 'true');
  if ('inert' in group) group.inert = !shouldSelect;
}

function clearViewportTransitionState(viewport) {
  if (!viewport) return;
  if (viewport._wlDesignsTimeoutId) {
    window.clearTimeout(viewport._wlDesignsTimeoutId);
    delete viewport._wlDesignsTimeoutId;
  }
  viewport.classList.remove('is-animating');
  viewport.style.height = '';
}

function clearGroupTransitionState(group) {
  if (!group) return;
  group.classList.remove(
    'is-entering-from-left',
    'is-entering-from-right',
    'is-leaving-to-left',
    'is-leaving-to-right'
  );
}

function finalizeGroupSwitch(viewport, currentGroup, nextGroup) {
  if (!viewport || !currentGroup || !nextGroup) return;
  clearGroupTransitionState(currentGroup);
  clearGroupTransitionState(nextGroup);
  setGroupSelected(currentGroup, false);
  setGroupSelected(nextGroup, true);
  clearViewportTransitionState(viewport);
  delete viewport._wlDesignsTransition;
}

function finishPendingGroupSwitch(viewport) {
  if (!viewport) return;
  const pendingTransition = viewport._wlDesignsTransition;
  if (!pendingTransition) {
    clearViewportTransitionState(viewport);
    return;
  }

  finalizeGroupSwitch(viewport, pendingTransition.currentGroup, pendingTransition.nextGroup);
}

function syncTabsFromDom() {
  finishPendingGroupSwitch(getViewport());
  const activeGroupType = getActiveGroupType();
  const shell = getShell();
  if (shell) shell.dataset.activeGroup = activeGroupType;

  getTabs().forEach((tab) => setTabSelected(tab, getGroupType(tab) === activeGroupType));
  getGroups().forEach((group) => {
    clearGroupTransitionState(group);
    setGroupSelected(group, getGroupType(group) === activeGroupType);
  });
}

function getSwitchDirection(fromType, toType) {
  return TAB_ORDER.indexOf(toType) > TAB_ORDER.indexOf(fromType) ? 'forward' : 'backward';
}

function animateGroupSwitch(currentGroup, nextGroup, direction) {
  const viewport = getViewport();
  if (!viewport || !currentGroup || !nextGroup) return false;
  if (currentGroup === nextGroup) {
    setGroupSelected(nextGroup, true);
    return false;
  }

  finishPendingGroupSwitch(viewport);
  clearViewportTransitionState(viewport);
  getGroups().forEach(clearGroupTransitionState);

  const enterClass = direction === 'forward' ? 'is-entering-from-right' : 'is-entering-from-left';
  const leaveClass = direction === 'forward' ? 'is-leaving-to-left' : 'is-leaving-to-right';
  const startingHeight = currentGroup.offsetHeight;

  viewport._wlDesignsTransition = { currentGroup, nextGroup };
  nextGroup.hidden = false;
  nextGroup.setAttribute('aria-hidden', 'false');
  if ('inert' in nextGroup) nextGroup.inert = true;

  viewport.classList.add('is-animating');
  viewport.style.height = `${startingHeight}px`;

  nextGroup.classList.add(enterClass);
  currentGroup.classList.add(leaveClass);

  const targetHeight = nextGroup.offsetHeight;
  const animateHeight = () => {
    viewport.style.height = `${targetHeight}px`;
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(animateHeight);
  else animateHeight();

  viewport._wlDesignsTimeoutId = window.setTimeout(() => {
    finalizeGroupSwitch(viewport, currentGroup, nextGroup);
  }, PANEL_TRANSITION_MS + 60);

  return true;
}

function activateGroup(groupType, options = {}) {
  const nextGroupType = normalizeGroupType(groupType);
  finishPendingGroupSwitch(getViewport());
  const currentGroup = getVisibleGroup();
  const currentGroupType = currentGroup ? normalizeGroupType(getGroupType(currentGroup)) : getActiveGroupType();
  const shell = getShell();
  const nextGroup = getGroupByType(nextGroupType);

  if (!nextGroup) return;
  if (shell) shell.dataset.activeGroup = nextGroupType;

  getTabs().forEach((tab) => setTabSelected(tab, getGroupType(tab) === nextGroupType));

  if (!currentGroup || currentGroup === nextGroup) {
    getGroups().forEach((group) => setGroupSelected(group, group === nextGroup));
    return;
  }

  const shouldAnimate = options.animate !== false && !prefersReducedMotion();
  if (!shouldAnimate || !animateGroupSwitch(currentGroup, nextGroup, getSwitchDirection(currentGroupType, nextGroupType))) {
    getGroups().forEach((group) => {
      clearGroupTransitionState(group);
      setGroupSelected(group, group === nextGroup);
    });
  }
}

function focusTab(tab) {
  if (!tab || typeof tab.focus !== 'function') return;
  try {
    tab.focus({ preventScroll: true });
  } catch (e) {
    tab.focus();
  }
}

function focusAdjacentTab(currentTab, direction) {
  const tabs = getTabs();
  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex < 0 || !tabs.length) return;

  let nextIndex = currentIndex;
  if (direction === 'first') nextIndex = 0;
  else if (direction === 'last') nextIndex = tabs.length - 1;
  else if (direction === 'next') nextIndex = (currentIndex + 1) % tabs.length;
  else if (direction === 'prev') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;

  const nextTab = tabs[nextIndex];
  if (!nextTab) return;
  activateGroup(getGroupType(nextTab), { animate: true });
  focusTab(nextTab);
}

function openGroupForCard(card) {
  const group = card && card.closest ? card.closest('.designs-stage-group') : null;
  if (!group) return;
  activateGroup(getGroupType(group), { animate: true });
}

// Designs stage module
// Single responsibility: load designs filtered by selected model, wire design option-card interactions,
// and restore visual selections from state.
// Exports:
// - init(): attaches event handlers for design selection, dispatches standardized events
// - restoreFromState(state): restores visual ARIA state for the selected design

export function init() {
  syncTabsFromDom();

  document.addEventListener('click', (ev) => {
    const tab = ev.target.closest && ev.target.closest(TAB_SELECTOR);
    if (!tab) return;
    activateGroup(getGroupType(tab), { animate: true });
  });

  document.addEventListener('keydown', (ev) => {
    const tab = ev.target.closest && ev.target.closest(TAB_SELECTOR);
    if (!tab) return;

    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      focusAdjacentTab(tab, 'next');
      return;
    }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      focusAdjacentTab(tab, 'prev');
      return;
    }
    if (ev.key === 'Home') {
      ev.preventDefault();
      focusAdjacentTab(tab, 'first');
      return;
    }
    if (ev.key === 'End') {
      ev.preventDefault();
      focusAdjacentTab(tab, 'last');
    }
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
    syncTabsFromDom();
    const designId = state && state.selections && state.selections.design;
    if (!designId) {
      activateGroup('presets', { animate: false });
      return;
    }

    const el = document.querySelector(`#design-layout-options .option-card[data-id="${designId}"]`) ||
      document.querySelector(`#designs-stage-section .option-card[data-id="${designId}"]:not([data-preset-id])`);
    if (el) {
      document.querySelectorAll('#designs-stage-section .option-card[data-category="design"], #designs-stage-section .option-card[data-id^="des-"]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      el.setAttribute('aria-pressed', 'true');
      const group = el.closest('.designs-stage-group');
      activateGroup(getGroupType(group), { animate: false });
    }
  } catch (e) {
    // fail silently
    log.warn('restoreFromState failed', e);
  }
}

export default { init, restoreFromState };
