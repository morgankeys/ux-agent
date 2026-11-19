# ux/

Everything uxagent knows about this project that isn't the design system itself. The design
system lives in `design-system/`.

| Item | What it is |
| --- | --- |
| `config.json` | The one config file: paths, the real command for each role, Figma links (or `false`), modules, validator settings. |
| `uxagent.lock.json` | What uxagent wrote into this project, and at which version. Don't edit it. |
| `setup-status.md` | Setup progress. Written by `/ux-setup`; run it to see what's left. |
| `architecture.md` | How this codebase implements the design system: stack, structure, styling rules, commands. Agents read it before editing. |
| `personas/` | Example users and organizations to use in mockups and screens. |
| `assets/` | Images and other content for the project. |
| `context/` | Conventions the project learns, one topic per file. |
| `overrides/` | Your own versions of uxagent skills and context files. Only present if you ejected one. |
