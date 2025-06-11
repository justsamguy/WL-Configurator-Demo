## Brief overview
This document outlines the testing workflow for the WoodLab Configurator project. Due to the project's reliance on ES6 modules and CDN-hosted libraries, testing must be conducted in a live server environment, not from a local `file://` URL.

## Browser Testing Workflow
- When code changes are ready for testing, do not use the `browser_action` tool to launch a local `index.html` file.
- Instead, ask the user for feedback. The user will be responsible for deploying the changes to a live environment (e.g., GitHub Pages) and verifying the results.
- This approach ensures that all JavaScript modules and external dependencies are loaded correctly, which is not possible in a local file environment.
