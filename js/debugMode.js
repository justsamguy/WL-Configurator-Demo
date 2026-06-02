const DEBUG_MODE_CHANGED_EVENT = 'wl-debug-mode-changed';
const DEBUG_MODE_CLASS = 'wl-debug-mode-enabled';

let debugModeEnabled = false;

function applyDebugModeClass(enabled) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle(DEBUG_MODE_CLASS, enabled);
  if (document.body) document.body.classList.toggle(DEBUG_MODE_CLASS, enabled);
}

function publishDebugModeChange(enabled, source = 'console') {
  if (typeof window !== 'undefined') {
    window.__wlDebugModeEnabled = enabled;
  }
  applyDebugModeClass(enabled);
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(DEBUG_MODE_CHANGED_EVENT, {
      detail: { enabled, source }
    }));
  }
}

export function isDebugModeEnabled() {
  if (typeof window !== 'undefined' && window.__wlDebugModeEnabled === true) return true;
  return debugModeEnabled === true;
}

export function setDebugModeEnabled(enabled, options = {}) {
  const nextEnabled = enabled === true;
  const currentEnabled = isDebugModeEnabled();
  debugModeEnabled = nextEnabled;
  if (currentEnabled !== nextEnabled) {
    publishDebugModeChange(nextEnabled, options.source || 'console');
  } else {
    applyDebugModeClass(nextEnabled);
  }
  return nextEnabled;
}

export function toggleDebugMode(options = {}) {
  return setDebugModeEnabled(!isDebugModeEnabled(), options);
}

export { DEBUG_MODE_CHANGED_EVENT };
