# WoodLab Configurator Project Instructions

This document outlines the guidelines and conventions for developing the WoodLab Configurator project, a static mockup built with Vanilla JS, Tailwind CSS v3, Three.js, jsPDF, and html2canvas. All logic runs client-side, adhering to a strict file/folder structure and client-only, GitHub Pages-compatible requirements.

## Context

- **Tech Stack:** Vanilla JS, Tailwind CSS v3, Three.js r160, jsPDF 2.5.1, html2canvas 1.5.1, Hero-icons.
**Key Directories:** `js/`, `js/stages/` (stage-specific logic), `css/`, `components/`, `pages/`, `assets/`.
**Maintain state management:** Only `js/main.js` should be the canonical mutator of global state; UI modules should avoid directly mutating the shared state object. Stage-specific helper modules (e.g., `js/stages/*`) may provide functions that call `setState` when explicitly needed but prefer dispatching selection events (`option-selected`, `addon-toggled`) and letting `js/main.js` perform the final state mutation.
**Response Style**

- Provide concise diffs for changes.
- Make minimal, targeted changes. When adding new modules under `js/stages/` or `js/pricing.js`, include a one-line description in this file explaining their purpose.

- **Follow the locked tech stack:** Use only the specified libraries and frameworks.
- **Adhere to the canonical file/folder layout:** Maintain the project's structure as defined.
- **Use placeholder assets:** Simple geometry for 3D, 256x256 PNGs for images, all marked with `alt="placeholder"`.
- **Ensure accessibility:** All interactive elements must be WCAG 2.2 AA compliant, keyboard navigable, and responsive. Use `:focus-visible` and `[aria-live="polite"][aria-atomic="true"]` regions.
- **Maintain state management:** Only `js/main.js` should mutate global state; UI modules observe state and dispatch `Event("statechange")`.
- **Write modular code:** Each UI module should have a single responsibility.
- **Use consistent naming conventions:** For exported functions and variables.
- **Test via deployment:** Verify functionality by deploying changes.

## Don’t

- **Use other frameworks or libraries** not explicitly listed in the tech stack.
- **Implement server-side logic or external API calls.**
- **Remove keyboard focus outlines.**
- **Mutate global state outside of `js/main.js`.**
- **Introduce non-placeholder assets or data.**
- **Suggest or run local verifying/testing commands** unless explicitly requested. Testing and verification must occur in a live server environment (GitHub Pages deployment) due to CDN dependencies.

## Commands

- **Install dependencies:** `npm i`
- **Build:** `npm run build` (compiles Tailwind CSS)
- **Run Dev Server:** (Not explicitly defined, but `npm i` suggests a local dev setup)
- **Test:** Deploy to GitHub Pages and verify functionality.

## Security & Data Handling Boundaries

- All logic must run client-side.
- No server code or external APIs are permitted.
- Use only hard-coded placeholder data and assets.

## Response Style

- Provide concise diffs for changes.
- Make minimal, targeted changes.

## Provenance

- Parsed from:
    - `.clinerules/README.md`
    - `.clinerules/testing-workflow.md`
    - `.clinerules/workflow/woodlab-configurator-workflow.txt`
    - `.clinerules/meta/rule-authoring.txt`
    - `.clinerules/meta/rule-evolution.txt`
- Date Parsed: 2025-09-02
