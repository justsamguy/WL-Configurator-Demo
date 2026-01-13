import { createLogger } from '../logger.js';

const log = createLogger('Icon');

// js/ui/icon.js
export async function loadIcon(element, iconName, title = '') {
    const iconBaseUrl = 'assets/icons/'; // Local path as per project rules
    const iconUrl = `${iconBaseUrl}${iconName}.svg`;

    try {
        const response = await fetch(iconUrl);
        if (!response.ok) {
            throw new Error(`Failed to load icon: ${response.statusText}`);
        }
        let svgContent = await response.text();

        // Add title for accessibility if provided
        if (title) {
            svgContent = svgContent.replace(/<svg(.*?)>/, `<svg$1><title>${title}</title>`);
        }

        element.innerHTML = svgContent;
        element.setAttribute('role', 'img'); // Indicate it's an image for accessibility
        if (title) {
            element.setAttribute('aria-label', title); // Provide accessible label
        }
    } catch (error) {
        log.error(`Error loading icon '${iconName}'`, error);
        element.innerHTML = `<span class="text-red-500">Icon Error</span>`; // Placeholder for error
    }
}
