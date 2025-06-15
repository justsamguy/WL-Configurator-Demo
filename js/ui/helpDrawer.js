// WoodLab Configurator - helpDrawer.js
// Help drawer content and functionality

/**
 * Populate the help drawer with content
 */
export function populateHelpDrawer() {
  const helpContent = document.getElementById("help-content");
  const sidebarHelpContent = document.getElementById("sidebar-help-content");
  
  if (!helpContent || !sidebarHelpContent) return;
  
  // Main help drawer content
  helpContent.innerHTML = `
    <div class="space-y-6">
      <section>
        <h3 class="text-lg font-semibold mb-2">Getting Started</h3>
        <p class="text-gray-600 mb-2">
          Welcome to the WoodLab Configurator! This tool helps you design and customize your perfect table.
        </p>
        <ol class="list-decimal list-inside text-gray-600 space-y-2 ml-2">
          <li>Start by selecting a table model from the options</li>
          <li>Customize your table with different materials, finishes, and leg styles</li>
          <li>Review your selections and export a summary</li>
        </ol>
      </section>
      
      <section>
        <h3 class="text-lg font-semibold mb-2">3D Viewer Controls</h3>
        <ul class="list-disc list-inside text-gray-600 space-y-2 ml-2">
          <li><strong>Rotate:</strong> Click and drag to rotate the view</li>
          <li><strong>Pan:</strong> Right-click and drag (or Ctrl+click and drag)</li>
          <li><strong>Zoom:</strong> Use the mouse wheel or pinch gesture</li>
          <li><strong>Reset:</strong> Click the reset button to return to the default view</li>
        </ul>
      </section>
      
      <section>
        <h3 class="text-lg font-semibold mb-2">Customization Options</h3>
        <p class="text-gray-600 mb-2">
          In the Customize stage, you can personalize your table with:
        </p>
        <ul class="list-disc list-inside text-gray-600 space-y-1 ml-2">
          <li><strong>Materials:</strong> Choose from oak, walnut, or maple</li>
          <li><strong>Finishes:</strong> Select natural or stained options</li>
          <li><strong>Legs:</strong> Pick standard or modern leg styles</li>
        </ul>
        <p class="text-gray-600 mt-2">
          Each selection may affect the final price, which is always displayed at the top of the sidebar.
        </p>
      </section>
      
      <section>
        <h3 class="text-lg font-semibold mb-2">Summary & Export</h3>
        <p class="text-gray-600 mb-2">
          In the final stage, you can:
        </p>
        <ul class="list-disc list-inside text-gray-600 space-y-1 ml-2">
          <li>Capture a snapshot of your configuration</li>
          <li>Export a PDF summary with all your selections</li>
          <li>Start over if you want to create a new configuration</li>
        </ul>
      </section>
      
      <section>
        <h3 class="text-lg font-semibold mb-2">Need More Help?</h3>
        <p class="text-gray-600">
          Contact our support team at <a href="mailto:support@woodlab.example.com" class="text-blue-600 hover:underline">support@woodlab.example.com</a> or call us at (555) 123-4567.
        </p>
      </section>
    </div>
  `;
  
  // Sidebar help content (simplified version)
  sidebarHelpContent.innerHTML = `
    <p class="mb-2">Need assistance with your configuration?</p>
    <button id="open-help-drawer" class="text-blue-600 hover:underline focus:outline-none focus:underline">
      View Help Guide
    </button>
    <p class="mt-2">
      Or contact us at <a href="mailto:support@woodlab.example.com" class="text-blue-600 hover:underline">support@woodlab.example.com</a>
    </p>
  `;
  
  // Add event listener to open help drawer button
  document.getElementById("open-help-drawer")?.addEventListener("click", () => {
    const helpBtn = document.getElementById("help-btn");
    if (helpBtn) helpBtn.click();
  });
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", populateHelpDrawer);
