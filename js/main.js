// WoodLab Configurator - main.js
// WoodLab Configurator - main.js
// App bootstrap and global state management

// WoodLab Configurator - main.js
// App bootstrap and global state management

import { loadComponent } from './app.js';
import { loadIcon } from './ui/icon.js';
import { initViewer, initViewerControls, resizeViewer } from './viewer.js'; // Import viewer functions

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

// Initialize the application by loading components
document.addEventListener('DOMContentLoaded', async () => {
  // Load main layout components
  await loadComponent('app-header', 'components/Header.html');
  await loadComponent('app-main', 'pages/MainContent.html');
  await loadComponent('app-sidebar', 'components/Sidebar.html');
  await loadComponent('app-footer', 'components/Footer.html');

  // Initialize viewer and controls after MainContent is loaded
  initViewer();
  initViewerControls();
  resizeViewer(); // Ensure viewer is sized correctly on load

  // Load icons after all components are in the DOM
  const iconPlaceholders = document.querySelectorAll('.icon-placeholder[data-icon]');
  iconPlaceholders.forEach(async (element) => {
    const iconName = element.getAttribute('data-icon');
    const iconTitle = element.getAttribute('data-icon-title') || '';
    await loadIcon(element, iconName, iconTitle);
  });

  // Initial state update to render the first stage
  document.dispatchEvent(new Event("statechange"));
});
