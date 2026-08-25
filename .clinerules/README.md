# Cline Rule Categories for WoodLab Configurator

This `.clinerules/` folder contains all rule files for the WoodLab Configurator static mockup project. These rules are tailored to the locked tech stack, strict file/folder structure, and client-only, GitHub Pages-compatible requirements of this project.

Primary source of truth for project constraints and architecture lives in `AGENTS.md` at the repo root. If anything in `.clinerules/**` conflicts with `AGENTS.md`, update the rules here to match it.

## Related rule files (keep in sync)

This repo maintains multiple rule files for different tools/agents. Keep shared project constraints synchronized across them while preserving tool-specific guidance and formatting.

- Primary: `AGENTS.md`
- GitHub Copilot: `.github/copilot-instructions.md`

**Synchronization rule:** When you change shared project rules (stack/platform constraints, architecture invariants, accessibility requirements, workflow guardrails, version policy), update the corresponding sections in the related rule files as well.

## Folder Structure

```
.clinerules/
  meta/
    rule-authoring.txt
    rule-evolution.txt
  workflow/
    woodlab-configurator-workflow.txt
```

- **meta/** – Rules about writing and evolving other Cline rules, specific to the WoodLab Configurator. Applies to every `.txt` inside `.clinerules/`.
- **workflow/** – Development-process rules for the WoodLab Configurator project, including editing, testing, accessibility, and deployment.

## Usage

After editing any rule file, run **“Cline: Reload Rules”** in VS Code (or restart Cline in your CLI/CI) to activate the changes.

All rules in this folder are project-specific and must align with the WoodLab Configurator guidelines, locked tech stack, and deployment requirements.

Shared workflow reminder: keep placeholder-backed image fields tracked in the root `placeholder_image_fields.txt` file (add on placeholder use, remove when replaced).

Shared testing reminder: because the app is primarily real-time visual/interactive, the user owns final runtime visual acceptance by default. For VSCode/Copilot/Cline-style agents, do not run or suggest local visual/runtime testing unless explicitly requested. OpenClaw/Omni is the exception: when assigned UI, layout, viewer, or interaction work, Omni should use a local live server plus browser automation/screenshot inspection before reporting ready for review.

Shared branching reminder: when explicitly asked to prepare the next release branches after a merge/release, sync `main`, create the version branch from `main` (for example `v1.2`), then create the datecoded development branch from the version branch using `dev-YYYYMMDD` (for example `dev-20260814`). Push both and leave the worktree on the datecoded branch unless asked otherwise.
