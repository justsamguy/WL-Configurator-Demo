// WoodLab Configurator - main.js
// App bootstrap and global state management

export const state = {
  stage: 1, // 1: Model, 2: Customize, 3: Summary
  selections: { model: null, options: {} },
  pricing: { base: 12480, extras: 0, total: 12480 }
};

// Dispatch a custom event when state changes
export function setState(newState) {
  Object.assign(state, newState);
  document.dispatchEvent(new Event("statechange"));
}

// Listen for state changes to update UI
document.addEventListener("statechange", () => {
  // This is where main.js would orchestrate updates across other modules
  // For now, app.js still handles the direct UI updates based on state.
  // In a more complex app, main.js might call functions from app.js, viewer.js, etc.
  // to trigger their respective updates.
});

// Import icon loading utility
import { loadIconFromCDN } from './ui/icon.js';

// Load icons on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const iconPlaceholders = document.querySelectorAll('.icon-placeholder[data-icon]');

    iconPlaceholders.forEach(async (element) => {
        const iconName = element.getAttribute('data-icon');
        const iconTitle = element.getAttribute('data-icon-title') || '';
        await loadIconFromCDN(element, iconName, iconTitle);
    });
});
