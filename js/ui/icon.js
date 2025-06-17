// js/ui/icon.js
export async function loadIconFromCDN(element, iconName, title = '') {
    const cdnBaseUrl = 'https://cdn.jsdelivr.net/npm/@heroicons/html@2.1.1/dist/svg/24/solid/';
    const iconUrl = `${cdnBaseUrl}${iconName}.svg`;

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
        console.error(`Error loading icon '${iconName}':`, error);
        element.innerHTML = `<span class="text-red-500">Icon Error</span>`; // Placeholder for error
    }
}
