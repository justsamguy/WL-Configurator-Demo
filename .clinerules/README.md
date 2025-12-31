# Cline Rule Categories for WoodLab Configurator

This `.clinerules/` folder contains all rule files for the WoodLab Configurator static mockup project. These rules are tailored to the locked tech stack, strict file/folder structure, and client-only, GitHub Pages-compatible requirements of this project.

Primary source of truth for agent behavior and project constraints lives in `Coding Agent Instructions.md` at the repo root. If anything in `.clinerules/**` conflicts with `Coding Agent Instructions.md`, update the rules here to match it.

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
