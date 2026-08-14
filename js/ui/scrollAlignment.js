function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resolveBehavior(behavior) {
  if (behavior === 'auto' || behavior === 'instant') return 'auto';
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

function isScrollableElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (!/(auto|scroll|overlay)/.test(style.overflowY || '')) return false;
  return element.scrollHeight > element.clientHeight + 1;
}

function findScrollContainer(target) {
  if (!(target instanceof Element)) return null;

  const sidebar = target.closest('#app-sidebar');
  if (sidebar instanceof HTMLElement) return sidebar;

  let current = target.parentElement;
  while (current) {
    if (isScrollableElement(current)) return current;
    current = current.parentElement;
  }

  return document.scrollingElement || document.documentElement;
}

function getStickyTopOffset(container) {
  if (!(container instanceof Element)) return 0;

  return Array.from(container.children).reduce((maxOffset, child) => {
    if (!(child instanceof HTMLElement)) return maxOffset;
    const style = window.getComputedStyle(child);
    if (style.position !== 'sticky') return maxOffset;

    const stickyTop = Number.parseFloat(style.top || '0');
    if (!Number.isFinite(stickyTop) || stickyTop > 1) return maxOffset;

    return Math.max(maxOffset, Math.max(0, stickyTop) + child.getBoundingClientRect().height);
  }, 0);
}

export function scrollElementToTop(target, opts = {}) {
  if (!(target instanceof Element)) return;

  const container = opts.container || findScrollContainer(target);
  if (!container) return;

  const behavior = resolveBehavior(opts.behavior);
  const extraOffset = Number.isFinite(opts.extraOffset) ? opts.extraOffset : 0;
  const stickyOffset = getStickyTopOffset(container);

  if (container === document.body || container === document.documentElement || container === document.scrollingElement) {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const targetTop = scrollTop + target.getBoundingClientRect().top - stickyOffset - extraOffset;
    window.scrollTo({ top: Math.max(0, targetTop), behavior });
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetTop = container.scrollTop + (targetRect.top - containerRect.top) - stickyOffset - extraOffset;

  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top: Math.max(0, targetTop), behavior });
    return;
  }

  container.scrollTop = Math.max(0, targetTop);
}
