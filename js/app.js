/**
 * Utility function to load HTML components dynamically.
 * Fetches HTML content from a specified path and injects it into a target DOM element.
 *
 * @param {string} containerId - The ID of the DOM element where the component will be injected.
 * @param {string} componentPath - The path to the HTML file of the component (e.g., 'components/Sidebar.html').
 * @returns {Promise<void>} A promise that resolves when the component is loaded and injected.
 */
export async function loadComponent(containerId, componentPath) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Error: Container with ID '${containerId}' not found.`);
    return;
  }

  try {
    const response = await fetch(componentPath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    container.innerHTML = html;
    console.log(`Component '${componentPath}' loaded into '${containerId}'.`);
  } catch (error) {
    console.error(`Failed to load component '${componentPath}':`, error);
  }
}

// Initialize application-level behaviors
// Note: stageManager is initialized after components are loaded from `js/main.js`.
