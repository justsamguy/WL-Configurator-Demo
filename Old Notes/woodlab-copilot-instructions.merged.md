# WoodLab Configurator Project Instructions

This document outlines the guidelines and conventions for developing the WoodLab Configurator project, a static mockup built with Vanilla JS, Tailwind CSS v3, Three.js, jsPDF, and html2canvas. All logic runs client-side, adhering to a strict file/folder structure and client-only, GitHub Pages-compatible requirements.

## Context

- **Tech Stack:** Vanilla JS, Tailwind CSS v3, Three.js r160, jsPDF 2.5.1, html2canvas 1.5.1, Hero-icons.
- **Key Directories:** `js/`, `js/stages/` (stage-specific logic), `css/`, `components/`, `pages/`, `assets/`.
- **State management (required):** Only `js/main.js` MUST be the canonical mutator of global state. Stage-specific modules under `js/stages/` MUST NOT call `setState`/`setAppState` directly. Instead they should dispatch the agreed-upon events (for example `option-selected`, `addon-toggled`, `stage-model-selected`, or `request-restart`) and let `js/main.js` perform the final state mutation. This prevents cross-stage coupling and keeps stage code safe to edit in isolation.

Notes on recent conventions:
- `applyFinishDefaults(appState)` in `js/stages/finish.js` will dispatch `option-selected` events for any defaults and will NOT call `setState`.
- The Summary action that resets the configuration now dispatches `request-restart`; `js/main.js` handles the reset and stage navigation.

## Workflow & Safety Guardrails

- **High-risk changes:** If a request would delete/overwrite significant behavior, touch deployment scripts/config, or otherwise introduce a “hard to undo” change, pause and explicitly call out the risk before proceeding.
- **Avoid getting stuck:** If repeated attempts don’t resolve an issue, stop thrashing and escalate with a short summary of what was tried and what information is still needed.
- **Flag uncertain areas:** When escalation is needed, leave a clear `TODO:` / `FIXME:` where appropriate, plus a brief note in the response describing what needs human review.
- **No silent overrides:** Don’t quietly ignore/override instructions. If there’s a conflict between requirements, explain the conflict and ask for resolution (prefer the safest action if something must be aborted).

## Security & Data Handling Boundaries

- All logic must run client-side.
- No server code or external APIs are permitted.
- Use only hard-coded placeholder data and assets.
- Never introduce secrets (API keys, tokens, passwords). If a value would be sensitive, keep it out of the repo and flag the requirement instead.
- If any input-handling or security-relevant code exists, do not weaken it (sanitization/escaping, permissions checks, etc.) unless explicitly instructed.

## Dependencies & Repo Hygiene

- **Follow the locked tech stack:** Use only the specified libraries and frameworks.
- **No new dependencies** unless explicitly requested. If asked, prefer well-maintained sources and keep changes minimal and well-documented.
- Treat repository meta-files with care (e.g., `.gitignore`, build/deploy configs). Do not change them unless the task specifically requires it.
- Keep changes scoped to the project workspace; avoid destructive operations unless explicitly requested.

## Response Style

- Provide concise diffs for changes.
- Make minimal, targeted changes.
- When adding new modules under `js/stages/` or `js/pricing.js`, include a one-line description in this file explaining their purpose.
- **IMPORTANT:** After each requested edit to the app, update the `Last updated:` timestamp in `js/main.js` (the console.log line after "WoodLab Configurator loaded successfully") to the current date and time in format `YYYY-MM-DD HH:MM`.
- **Test via deployment:** Verify functionality by deploying changes.
- **Test/ship workflow:** Stage, Commit, and Sync to GitHub. User to provide feedback on live deployment.

## Accessibility

- All interactive elements must be WCAG 2.2 AA compliant, keyboard navigable, and responsive.
- Use `:focus-visible` and an `[aria-live="polite"][aria-atomic="true"]` region where needed.
- Do not remove keyboard focus outlines.

## Don’t

- **Use other frameworks or libraries** not explicitly listed in the tech stack.
- **Implement server-side logic or external API calls.**
- **Mutate global state outside of `js/main.js`.**
- **Introduce non-placeholder assets or data.**
- **Suggest or run local verifying/testing commands** unless explicitly requested. Testing and verification must occur in a live server environment (GitHub Pages deployment) due to CDN dependencies.

## Provenance

- Project-specific rules parsed from:
    - `.clinerules/README.md`
    - `.clinerules/testing-workflow.md`
    - `.clinerules/workflow/woodlab-configurator-workflow.txt`
    - `.clinerules/meta/rule-authoring.txt`
    - `.clinerules/meta/rule-evolution.txt`
- General safety/security guardrails merged in from an agent guidelines template.
- Date Parsed: 2025-09-02
