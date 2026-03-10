function createPopover() {
  let popover = document.getElementById('materials-help-popover');
  if (popover) return popover;

  popover = document.createElement('div');
  popover.id = 'materials-help-popover';
  popover.className = 'materials-help-popover';
  popover.setAttribute('role', 'tooltip');
  popover.setAttribute('aria-hidden', 'true');
  document.body.appendChild(popover);
  return popover;
}

export function initMaterialsHelpPopover(triggerEl) {
  if (!triggerEl) return;

  const popover = createPopover();
  const content = triggerEl.getAttribute('data-popover-content') || '';
  let closeDelayId = null;
  let closeTransitionId = null;

  const clearTimers = () => {
    if (closeDelayId) {
      window.clearTimeout(closeDelayId);
      closeDelayId = null;
    }
    if (closeTransitionId) {
      window.clearTimeout(closeTransitionId);
      closeTransitionId = null;
    }
  };

  const isOpen = () => popover.classList.contains('is-visible');

  const syncExpandedState = (expanded) => {
    triggerEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    popover.setAttribute('aria-hidden', expanded ? 'false' : 'true');
  };

  const finishClose = () => {
    popover.classList.remove('is-visible', 'is-closing');
    syncExpandedState(false);
  };

  const positionPopover = () => {
    const rect = triggerEl.getBoundingClientRect();
    const gap = 8;
    const rightMargin = 12;
    const bottomMargin = 12;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - bottomMargin) {
      top = Math.max(12, rect.top - height - gap);
    }
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.maxWidth = `min(560px, calc(100vw - ${rightMargin * 2}px))`;
  };

  const showPopover = () => {
    clearTimers();
    popover.textContent = content;
    popover.style.setProperty('--materials-help-fade-duration', '180ms');
    popover.classList.remove('is-closing');
    popover.classList.add('is-visible');
    syncExpandedState(true);
    positionPopover();
  };

  const closePopover = (durationMs = 140) => {
    if (!isOpen()) return;
    clearTimers();
    popover.style.setProperty('--materials-help-fade-duration', `${durationMs}ms`);
    popover.classList.add('is-closing');
    popover.classList.remove('is-visible');
    syncExpandedState(false);
    closeTransitionId = window.setTimeout(finishClose, durationMs);
  };

  const scheduleHoverClose = () => {
    clearTimers();
    closeDelayId = window.setTimeout(() => {
      closePopover(300);
    }, 4000);
  };

  const cancelHoverClose = () => {
    if (closeDelayId) {
      window.clearTimeout(closeDelayId);
      closeDelayId = null;
    }
  };

  const handlePointerLeave = () => {
    if (!isOpen()) return;
    if (triggerEl.matches(':hover') || popover.matches(':hover')) return;
    scheduleHoverClose();
  };

  triggerEl.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isOpen()) {
      closePopover(140);
      return;
    }
    showPopover();
  });

  triggerEl.addEventListener('mouseenter', cancelHoverClose);
  triggerEl.addEventListener('mouseleave', handlePointerLeave);
  popover.addEventListener('mouseenter', cancelHoverClose);
  popover.addEventListener('mouseleave', handlePointerLeave);

  document.addEventListener('pointerdown', (event) => {
    if (!isOpen()) return;
    if (triggerEl.contains(event.target)) return;
    closePopover(140);
  }, true);

  document.addEventListener('wheel', () => {
    closePopover(140);
  }, { passive: true, capture: true });

  document.addEventListener('touchstart', () => {
    closePopover(140);
  }, { passive: true, capture: true });

  document.addEventListener('focusin', (event) => {
    if (!isOpen()) return;
    if (triggerEl.contains(event.target)) return;
    closePopover(140);
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen()) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Shift') return;
    closePopover(140);
  });

  window.addEventListener('resize', () => {
    if (isOpen()) positionPopover();
  }, { passive: true });

  window.addEventListener('scroll', () => {
    closePopover(140);
  }, { passive: true, capture: true });
}
