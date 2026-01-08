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
