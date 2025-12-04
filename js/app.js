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
    // Resolve any nested data-include elements inside the newly-inserted content
    try {
      await processIncludes(container);
    } catch (e) {
      console.warn('processIncludes failed for', containerId, e);
    }
  } catch (error) {
    console.error(`Failed to load component '${componentPath}':`, error);
  }
}

/**
 * Recursively process elements that have a `data-include` attribute.
 * Replaces each such element's innerHTML with the fetched file and continues recursively.
 * @param {Element} root - DOM node to search under
 */
export async function processIncludes(root = document) {
  const nodes = Array.from(root.querySelectorAll('[data-include]'));
  for (const node of nodes) {
    const path = node.getAttribute('data-include');
    if (!path) continue;
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
      const html = await res.text();
      node.innerHTML = html;
      // remove attribute to avoid reprocessing
      node.removeAttribute('data-include');
      // process nested includes inside the newly injected content
      await processIncludes(node);
    } catch (err) {
      console.error(`Error including '${path}':`, err);
    }
  }
}

// Initialize application-level behaviors
// Note: stageManager is initialized after components are loaded from `js/main.js`.
