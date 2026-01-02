# WoodLab Configurator — Agent Instructions (Codex 5.2 / VSCode)

You are an AI coding agent working in the **WoodLab Configurator** GitHub repository through VSCode. Follow the instructions below exactly.

## Related rule files (keep in sync)

This repo has multiple rule files for different agents/tools. `AGENTS.md` is the primary source of truth for **project constraints and architecture**; other rule files should reference it and mirror shared constraints where applicable.

- GitHub Copilot: `.github/copilot-instructions.md`
- Cline rules: `.clinerules/README.md` and `.clinerules/**`

**Synchronization rule (required):** If you change shared project rules (stack/platform constraints, architecture invariants, accessibility requirements, workflow guardrails, version policy), update the corresponding sections in the other rule files above so they stay aligned. Preserve tool-specific formatting and instructions (i.e., don’t overwrite Copilot/Cline-specific guidance that doesn’t conflict).

## Rule precedence (highest → lowest)

1. **Safety & security boundaries**
2. **Platform + stack constraints** (static, client-only; allowed libraries)
3. **Architecture invariants** (state/event rules; file/folder conventions)
4. **Repo hygiene + workflow constraints**
5. **Accessibility requirements**
6. **Style conventions** (comments, response formatting)

If a user request conflicts with a higher-precedence rule, **stop and ask for confirmation** while explaining the conflict.  
If the user approves changing a rule, **update this file** to reflect the new agreed-upon rule(s).

---

## Project context

- **Type:** Static client-only app (GitHub Pages compatible)
- **Primary directories:** `js/`, `js/stages/`, `css/`, `components/`, `pages/`, `assets/`
- **Allowed stack (libraries/tools):** Vanilla JS, Tailwind CSS, Three.js, jsPDF, html2canvas, Heroicons
- **Delivery model (current implementation):** No build step; uses local files plus CDN-hosted libraries/assets where convenient for a static demo.

### Versions in use (last reviewed)
- Tailwind CSS: 3.4.1 (CDN)
- Three.js: 0.160.0 (r160, CDN)
- jsPDF: 2.5.1
- html2canvas: 1.5.1

**Version policy:** Prefer the latest available versions **within the allowed stack**, but:
- If you notice a newer upstream version than what the repo currently uses, **notify the user and ask before upgrading**.
- If a version is upgraded, update the **“Versions in use (last reviewed)”** section above to reflect the newly adopted version(s).

---

## Hard constraints

### Platform + data boundaries
- All logic must run **client-side**.
- **No server code**.
- **No external APIs for business data/services** (i.e., no calling third-party services to fetch configurator data, pricing, user info, etc.) unless the user explicitly approves a rule change.
- **Allowed exception (current implementation):** CDN-hosted libraries/assets (e.g., Tailwind/Three/jsPDF/html2canvas, fonts, favicon) may be loaded at runtime to keep the repo GitHub Pages-friendly and avoid adding a build/dependency pipeline.
- **Data source rule (current implementation):** Use local repo data/assets by default (e.g., `data/*.json`, `components/*.html`, `assets/**`). Local `fetch()` of these files is expected in a static app and is not considered an “external API”.

### Security & sensitive data
- Never introduce secrets (API keys, tokens, passwords).
- Do not weaken any existing input-handling or security-relevant code (sanitization/escaping, permission checks, etc.) unless explicitly instructed.

### Dependencies
- Do not introduce new dependencies unless explicitly requested or explicitly approved as a rule change.

---

## Architecture invariants

### Global state ownership (required)
- **Canonical store:** `js/state.js` owns the shared `state` object and `setState(...)` dispatcher.
- **Primary orchestrator:** `js/main.js` is the primary handler for app-level state mutations in response to UI/stage events.
- **Allowed exception (current implementation):** `js/stageManager.js` may perform narrowly-scoped state mutations needed for navigation UX and gating consistency (e.g., clearing design selection after a confirmation when returning to the Models stage).
- Stage-specific modules under `js/stages/` **must not** call `setState` / `setAppState` directly.
- Stage modules should dispatch agreed-upon events (e.g., `option-selected`, `addon-toggled`, `request-restart`, `request-stage-change`) and let the orchestrators (`js/main.js`, and where applicable `js/stageManager.js`) perform any required state mutation.

### Events
- You may introduce a **new event** if no existing event cleanly fits.
- Prefer reusing existing events when practical to reduce coupling and surprise.

### Cross-file consistency (required)
When making a change, keep the repo consistent end-to-end:
- Update all call sites, imports, event listeners, docs/comments, and any stage/router mappings impacted by the change.
- If files are moved/renamed, update references everywhere so the app remains functional.

### Known recent conventions (informational)
- `applyFinishDefaults(appState)` in `js/stages/finish.js` dispatches `option-selected` events for defaults and does **not** call `setState`.
- Summary reset dispatches `request-restart`; `js/main.js` handles reset + navigation.

---

## Workflow guardrails

### Conflicts and confirmations
Ask for confirmation (with a brief explanation) when a request would:
- Violate platform/stack boundaries (server code, external APIs, new dependencies).
- Change the state/event architecture rules above.
- Require an exception to any “Hard constraint” section.

If the user approves, proceed and then **update this file** to reflect the new rule(s).

### Avoid thrashing
If repeated attempts don’t resolve an issue:
- Stop.
- Provide a short summary of what was tried and what is still needed.
- Ask for the missing information or the next decision.

### TODO/FIXME policy
- If uncertainty remains and it matters, **ask the user** whether they want a TODO/FIXME left in the code.
- If the user indicates they’ll revisit later and something actionable is needed, add a clear `TODO:` with a short note.

---

## Running commands in VSCode

- You have full read access to the repository.
- You may run **file operation** commands needed for the task (read, list, edit, move/rename) without prompting.
- If you suggest a command the user did not request (especially non-file ops), **explain what it does** and **ask before running it**.

> Note: Avoid running local verify/test/build commands unless the user explicitly requests them.

---

## Git workflow (context only)

The **user** runs Git operations.
- Do **not** run `git` commands.
- Do not suggest alternative Git workflows outside this one unless asked.

Typical flow:
1. Make code changes.
2. User stages changes.
3. User commits.
4. User syncs/pushes to GitHub.
5. User verifies via live deployment (GitHub Pages) and provides feedback.

---

## Timestamp + edit version rule (required)

After completing any requested edit to the app:
- Increment the `Edit ver:` number in the console.log line immediately after the timestamp by **1**.
- If you are a CLINE agent, update the `Last updated:` timestamp in `js/main.js` (the console.log line after “WoodLab Configurator loaded successfully”) in format `YYYY-MM-DD HH:MM` using the current local time from the system clock. If not, don't modify the timestamp. (this rule applies to cline rules, not github copilot or other agennts) 

---

## Style and communication

### Codebase comment convention
- Prefer single-sentence inline comments to capture **intent** and/or **what changed**, consistent with the existing codebase style.
- Use your judgment: comments may describe behavior, explain a change, or both—keep them short and useful.

### Response style
- Be concise.
- If the user asks for explanation/analysis (no edits), reference relevant snippets and file paths in your explanation.

---

## Accessibility (required)

- All interactive elements must be WCAG 2.2 AA compliant, keyboard navigable, and responsive.
- Use `:focus-visible` and an `[aria-live="polite"][aria-atomic="true"]` region where needed.
- Do not remove keyboard focus outlines.
