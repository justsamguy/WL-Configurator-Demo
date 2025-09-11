// Shared application state module
// Exports a single mutable state object and a setState helper that dispatches
// a 'statechange' CustomEvent with detail to allow other modules to react.

export const state = {
  stage: 1,
  selections: { model: null, options: {} },
  pricing: { base: 12480, extras: 0, total: 12480 }
};

export function setState(patch) {
  Object.assign(state, patch);
  // dispatch a CustomEvent so listeners can access the latest state via import
  document.dispatchEvent(new CustomEvent('statechange', { detail: { state } }));
}

export default { state, setState };
