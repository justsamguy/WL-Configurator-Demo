## Brief overview
This document provides high-level notes on testing for the WoodLab Configurator project.

For agent behavior, constraints, and workflow guardrails, treat `AGENTS.md` (repo root) as the primary source of truth.

Related rule files (keep shared constraints in sync): `.github/copilot-instructions.md`, `.clinerules/README.md`.
**Synchronization rule:** When you change shared project rules (stack/platform constraints, architecture invariants, accessibility requirements, workflow guardrails, version policy), update the corresponding sections in the related rule files as well.

## Testing Recommendations
- Note: Testing must occur in a live server environment due to CDN dependencies.
- Note: Opening `index.html` via `file://` is not a valid runtime check for this project; the current setup uses ES modules, local `fetch()` calls, and CDN-hosted assets that browsers partially block or degrade under `file://` because of module/CORS/origin restrictions.
- Recommendation: Deploy changes to verify functionality.
- Because the app is primarily real-time visual/interactive, the user owns runtime visual verification by default. Do not run, suggest, or substitute local visual/runtime testing unless explicitly requested; use static inspection or requested commands and state what was not runtime-verified.
- Next steps: User verifies deployed visual/runtime behavior and provides feedback.
- **Important:** Do not suggest or run local testing commands unless explicitly requested. All testing and verification must be done via GitHub Pages deployment.
