# WoodLab Configurator Project Instructions

Primary source of truth: `AGENTS.md` (repo root). Keep this file aligned; if anything here conflicts, follow `AGENTS.md` and update this file.

## Related rule files (keep in sync)

This repo maintains multiple rule files for different tools/agents. Keep shared project constraints synchronized across them while preserving tool-specific guidance and formatting.

- Primary: `AGENTS.md`
- Cline rules: `.clinerules/README.md` and `.clinerules/**`

**Synchronization rule:** When you change shared project rules (stack/platform constraints, architecture invariants, accessibility requirements, workflow guardrails, version policy), update the corresponding sections in the files above as well.

## Context (summary)

- **App type:** Static, client-only (GitHub Pages compatible)
- **Allowed stack:** Vanilla JS, Tailwind CSS 3.4.1 (CDN), Three.js 0.160.0 (CDN), jsPDF 2.5.1, html2canvas 1.5.1, Heroicons
- **Key directories:** `js/`, `js/stages/`, `js/ui/`, `css/`, `components/`, `pages/`, `data/`, `assets/`

## Architecture invariants (summary)

- **Canonical store:** `js/state.js` owns shared `state` and `setState(...)`.
- **Primary orchestrator:** `js/main.js` handles app-level state mutations in response to UI/stage events.
- **Stage modules:** `js/stages/**` must not call `setState` directly; dispatch agreed-upon events (e.g., `option-selected`, `addon-toggled`, `request-restart`, `request-stage-change`).
- **Allowed exception:** `js/stageManager.js` may perform narrowly-scoped state mutations for navigation UX/gating consistency.

## Workflow guardrails (summary)

- **No server code.**
- **No external APIs for business data/services** unless explicitly approved; use local repo data/assets by default (`data/*.json`, `components/*.html`, `assets/**`).
- **No new dependencies** unless explicitly approved.
- When adding new features/options, update the exported PDF’s **Technical** section to reflect the change; if new specs are needed, complete the rest of the task first and then ask for the missing technical specs at the end.
- Track placeholder-backed image fields in `placeholder_image_fields.txt`: add entries when a new image field uses a placeholder, and remove entries when a placeholder is replaced with a final image.
- **Edit version rule:** After app edits, increment the `Edit ver:` line immediately after it by 1.
- **Accessibility:** WCAG 2.2 AA; keyboard navigable; use `:focus-visible` and `[aria-live="polite"][aria-atomic="true"]` where needed; do not remove focus outlines.
- **UI styling:** For JS-generated UI, prefer class names defined in `css/configurator.css` over ad-hoc Tailwind utility strings; avoid inline styles for layout/typography.

## Provenance

- Source: `AGENTS.md`
- Related: `.clinerules/**`
