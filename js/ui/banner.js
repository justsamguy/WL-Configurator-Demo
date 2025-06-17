// WoodLab Configurator - banner.js
// Reusable banner/notification system

/**
 * Show a banner notification.
 * @param {string} message - The message to display.
 * @param {string} [type="info"] - "info", "warning", or "error".
 * @param {number} [duration=5000] - Duration in ms (ignored for error).
 */
export function showBanner(message, type = "info", duration = 5000) {
  const container = document.getElementById("banner-container");
  if (!container) return;

  // Banner element
  const banner = document.createElement("div");
  banner.className =
    "banner px-4 py-2 rounded shadow text-sm flex items-center space-x-2 mt-2 " +
    (type === "error"
      ? "bg-red-100 text-red-800 border border-red-300"
      : type === "warning"
      ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
      : "bg-gray-200 text-gray-800 border border-gray-300");
  banner.setAttribute("role", type === "error" ? "alert" : "status");
  banner.setAttribute("tabindex", "0");

  // Message
  const msg = document.createElement("span");
  msg.textContent = message;
  banner.appendChild(msg);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn-icon ml-2"; // Apply btn-icon class
  closeBtn.setAttribute("aria-label", "Close alert");
  closeBtn.innerHTML = `
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
    </svg>
  `;
  closeBtn.onclick = () => removeBanner();
  banner.appendChild(closeBtn);

  // Remove function
  function removeBanner() {
    banner.classList.add("opacity-0", "transition-opacity", "duration-200");
    setTimeout(() => {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 200);
  }

  // Auto-dismiss unless error
  if (type !== "error") {
    setTimeout(removeBanner, duration);
  }

  // Add to container
  container.appendChild(banner);
  banner.focus();
}

// Example usage (uncomment to test):
// showBanner("This is an info banner.");
// showBanner("This is a warning.", "warning");
// showBanner("This is an error!", "error");
