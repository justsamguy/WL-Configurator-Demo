# WoodLab Configurator Project Instructions

Primary source of truth: `Coding Agent Instructions.md` (repo root). Keep this file aligned; if anything here conflicts, follow `Coding Agent Instructions.md` and update this file.

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
- **Timestamp rule:** After app edits, update `Last updated:` in `js/main.js` as `YYYY-MM-DD HH:MM`, but do not guess the current time—ask the user if not provided.
- **Accessibility:** WCAG 2.2 AA; keyboard navigable; use `:focus-visible` and `[aria-live="polite"][aria-atomic="true"]` where needed; do not remove focus outlines.

## Provenance

- Source: `Coding Agent Instructions.md`
- Related: `.clinerules/**`
