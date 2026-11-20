# Repo structure

How uxagent is laid out in a project. Load this before making changes that span folders,
and before editing any file you did not create.

## What uxagent adds

uxagent adds two visible folders, a block in `AGENTS.md`, and some generated stubs. The
project's code stays where it was; `paths.source` in `ux/config.json` says where its
styles and components live.

- `ux/`: how this project uses uxagent. Curated by people and agents.
  - `config.json`: paths, the command for each role, Figma links, modules, and validator
    settings.
  - `architecture.md`: how this codebase implements the design system (stack, structure,
    styling, how checks are wired, gotchas).
  - `setup-status.md`: setup progress, written by `/ux-setup`.
  - `personas/`, `assets/`: example users and organizations, and content assets.
  - `context/`: conventions this project has learned. Read these along with the packaged
    context.
  - `overrides/`: ejected skills and context files, if any.
  - `uxagent.lock.json`: what uxagent wrote here, and at which version.
- `design-system/`: the design system's sources and records (`paths.designSystem` can
  move it): `README.md`, `figma/tokens/`, `figma/assets/`, `supplemental/`,
  `guidelines/`, `token-usage.json`, the backlog and review files that `validate` and the
  token usage review write, `platform-components/`, and `exports/`.
- `AGENTS.md`: has a marked uxagent block. The rest of the file belongs to the project.
- `.claude/skills/`, `.cursor/skills/`, `.cursor/rules/`: generated stubs that point into
  the package.

The skills, context, and reference files themselves are read in place from the installed
package, `node_modules/uxagent/agents/`. They are not copied into the project.

## Three kinds of file

| Kind | Owner | What `npx uxagent sync` does |
| --- | --- | --- |
| Managed | uxagent | Rewrites it. If a person edited it, leaves it and reports. |
| Seeded | The project | Nothing, ever. Written once by `init` if absent. |
| Ejected | The project | Nothing; reports when the packaged file has changed since. |

- **Managed:** the skill and rule stubs, and the uxagent block in `AGENTS.md`. Never
  hand-edit them. Change the cause (a config value, a module) and run `npx uxagent sync`.
- **Seeded:** `ux/config.json`, `ux/architecture.md`, and the files under
  `design-system/guidelines/`. Edit these freely; they are the project's.
- **Ejected:** a packaged skill or context file the project took over.

## Where facts go

A fact about this project never goes in a package file; those are shared by every
project.

| Fact | Home |
| --- | --- |
| Paths, the command for each role, Figma links or `false`, modules, validator settings | `ux/config.json` |
| Stack, project structure, styling rules, how checks are wired, gotchas | `ux/architecture.md` |
| What the design system is, its token namespace and groups | `design-system/README.md`, `design-system/token-usage.json` |
| Conventions learned while working | `ux/context/` |

When you learn something the next agent should know, add a file to `ux/context/`.

## Changing what the package provides

- **Override a skill or context file:** `npx uxagent eject <file>` copies it to
  `ux/overrides/`, where it takes over. `npx uxagent restore <file>` drops the override.
  When the packaged file changes later, `sync` reports it so the override can be
  reconciled.
- **Opt out of a skill:** set it to `false` under `skills` in `ux/config.json`, for
  example `{ "pr": false }`, then run `npx uxagent sync`.
- **Add a skill of the project's own:** put it in the agent tool's own folder
  (`.claude/skills/<name>/`, `.cursor/skills/<name>/`) as usual. uxagent never touches a
  file it did not write, so a project's own skill of the same name wins over the packaged
  one.

## Updating

Run `npm update uxagent`, then `npx uxagent sync`. Seeded files are not changed. Use
`npx uxagent doctor` to check the install.

## Single source of truth

When guidance could live in two places, put it in one and link from the other. In the
package, rules live in `context/`, procedures in `skills/` (which link to the rules
rather than restating them), and facts about third-party tools in `reference/tooling.md`.
Entry points keep at most a one-line reminder plus a link.
