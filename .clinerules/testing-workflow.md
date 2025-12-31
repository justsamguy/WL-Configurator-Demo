## Brief overview
This document provides high-level notes on testing for the WoodLab Configurator project.

For agent behavior, constraints, and workflow guardrails, treat `AGENTS.md` (repo root) as the primary source of truth.

Related rule files (keep shared constraints in sync): `.github/copilot-instructions.md`, `.clinerules/README.md`.
**Synchronization rule:** When you change shared project rules (stack/platform constraints, architecture invariants, accessibility requirements, workflow guardrails, version policy), update the corresponding sections in the related rule files as well.

## Testing Recommendations
- Note: Testing must occur in a live server environment due to CDN dependencies.
- Recommendation: Deploy changes to verify functionality.
- Next steps: Ensure all features work as expected and address any issues.
- **Important:** Do not suggest or run local testing commands unless explicitly requested. All testing and verification must be done via GitHub Pages deployment.
