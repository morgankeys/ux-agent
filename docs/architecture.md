# How uxagent is built

For people and agents working on the uxagent package itself. Read this before changing
anything under `src/`, `agents/`, or `templates/`.

uxagent started as a template repo (`prototyping-kit`) that was copied to start each
prototype. It is now an npm package installed into any repo: a new one or an existing
codebase. The same material ships, turned inside out: instead of the code living inside
the kit's folders, the package adds two folders and some wiring to the project.

## Words

- **uxagent** or **the package:** this repo, as published to npm.
- **The project:** a repo that has uxagent installed. Never "the prototype" or "the kit";
  a project may be a long-lived production codebase.
- **Role:** a command named by what it does (`dev`, `build`, `lint`, `check`, `tokens`,
  `validate`, `stories`, `stories-build`, `connect`). `commands` in `ux/config.json` maps
  each role to the project's real command.

## What a project looks like

```
ux/                         visible, curated by people and agents
  config.json               the one config file (paths, commands, Figma links, modules, validate settings)
  uxagent.lock.json         what uxagent wrote here, and at which version
  setup-status.md           setup progress, written by /ux-setup
  architecture.md           how this codebase implements the design system
  personas/  assets/        example users and orgs, content assets
  context/                  conventions this project has learned (project-owned)
  overrides/                ejected skills and context files, only if any
design-system/              default location; `paths.designSystem` can move it
  README.md
  figma/tokens/  figma/assets/
  supplemental/
  guidelines/               one file per topic; components.md is the component registry
  token-usage.json          the token usage map
  deviations-backlog.md     written by `validate`
  token-usage-review.md     written by the token usage review
  platform-components/      component ports for the platform export
  exports/                  DESIGN.md (tracked) and platforms/ (ignored)
AGENTS.md                   gets a marked uxagent block; the rest belongs to the project
.claude/skills/ .cursor/skills/ .cursor/rules/    generated stubs that point into the package
node_modules/uxagent/       skills, context, reference docs, and all the code
```

The project's code is wherever it already is. `paths.source` (default `src`) says where
the styles and components live. There is no `Code/`, `Docs/`, `Agents/`, or `Export/`.

## Three kinds of file

Every file uxagent writes in a project is one of these, recorded in the lock file.

| Kind | Owner | What `uxagent sync` does | Examples |
| --- | --- | --- | --- |
| **Managed** | uxagent | Rewrites it. If a person edited it, leaves it and reports. | Skill stubs, Cursor rules, the block in `AGENTS.md` |
| **Seeded** | The project | Nothing, ever. Written once by `init` if absent. | `design-system/guidelines/*`, `ux/architecture.md`, `ux/config.json` |
| **Ejected** | The project | Nothing; reports when the packaged file has changed since. | `ux/overrides/skills/pr/SKILL.md` |

A file that already exists where a managed file would go, and that uxagent did not write,
is left alone. That is how a project's own `/pr` skill wins over ours.

**Package files never hold project facts.** A fact about one project (its Figma links, its
token namespace, its stack, a convention it learned) goes in the project:

| Fact | Home |
| --- | --- |
| Paths, command for each role, Figma links or `false`, modules, validator settings | `ux/config.json` |
| Stack, project structure, styling rules, how checks are wired, gotchas | `ux/architecture.md` |
| What the design system is, its token namespace and groups | `design-system/README.md`, `design-system/token-usage.json` |
| Conventions learned while working | `ux/context/` |

## The package

```
bin/uxagent.mjs             entry
src/cli/index.mjs           command dispatch
src/config/                 defaults.mjs (presets, roles, modules), load.mjs (the only reader of ux/config.json)
src/install/                init, sync, doctor, eject/restore, the lock file, managed blocks, stubs
src/validate/               the design-system validator (Stylelint plugin)
src/export/                 design-md/ and platforms/, behind cli.mjs
src/setup/scan.mjs          reads the setup checklist and the project, writes ux/setup-status.md
agents/                     read in place by agents, from node_modules/uxagent/agents/
  manifest.json             every skill, routing row, rule, and Cursor rule, with its module
  skills/<name>/SKILL.md
  context/  prompts/  reference/
templates/                  what `init` seeds or renders
  ux/  design-system/       seeded into the project once
  github/                   CI workflow and PR template, seeded with the `repo` module
  agents-block.md           the uxagent block for AGENTS.md
  cursor/rules/             Cursor rule templates
schema/config.schema.json
test/                       node --test; fixtures are built in temp folders
```

### Code conventions

- ES modules, Node 22.22 or later, no build step, no dependencies beyond those in
  `package.json`.
- A command module exports `async function cli(argv)` and returns an exit code. It finds
  the project with `loadConfig()` from `src/config/load.mjs`, which searches upward from the
  current folder for `ux/config.json`.
- **No hardcoded project paths.** Use `config.paths.*` (relative to the project root,
  forward slashes) and `config.abs(rel)`. If a path is missing from `resolvePaths()`, add
  it there.
- Paths in `ux/config.json` are relative to the project root, including everything under
  `validate`.
- Tests use `node --test`, live under `test/<area>/*.test.mjs`, and build their projects in
  temp folders. `npm test` runs them all.

## Config

`ux/config.json`, read only through `loadConfig()`:

```json
{
  "version": 1,
  "preset": "greenfield",
  "agents": ["claude", "cursor", "copilot", "gemini"],
  "paths": { "designSystem": "design-system", "source": "src" },
  "figma": { "site": null, "library": null },
  "commands": { "dev": null, "build": null, "lint": null, "check": null, "tokens": null,
                "validate": null, "stories": null, "stories-build": null, "connect": null },
  "modules": {},
  "skills": {},
  "validate": {
    "include": null, "tokenFiles": [], "globalStylesheets": [], "manifest": null,
    "allowedGlobalClasses": [], "allowedVariables": [], "exemptions": []
  }
}
```

- `figma`: `false` means the project doesn't use Figma. A `null` link is undecided.
- `commands`: `null` means the role isn't wired yet. `"n/a"` means the project will never
  have it.
- `modules`: `core` is always on. The rest are `tokens`, `validator`, `dev-pages`, `figma`,
  `catalog`, `export`, `repo`; each is on unless the preset or this key turns it off.
- `skills`: `{ "pr": false }` opts out of one skill.
- `agentFiles`: where agents read the skills from. Only `"package"` (from `node_modules`)
  exists today. A `"vendor"` mode that copies them into the project is planned for
  package managers without a `node_modules` folder.
- `schema/config.schema.json` describes every key. Keep it in step with
  `src/config/defaults.mjs` and `src/validate/settings.mjs`.
- Presets: `greenfield` (a new repo; everything on) and `existing` (an existing codebase;
  `repo` off, so its own git, CI, lint, and PR conventions stay in charge).

### Modules

| Module | What it carries |
| --- | --- |
| `core` | `/ux-setup`, design-system conventions, guiding users, troubleshooting |
| `tokens` | The token pipeline skill, the alpha guard |
| `validator` | `validate`, the deviations backlog, the token usage review |
| `dev-pages` | The dev-only pages guard |
| `figma` | Figma MCP, capture button, Code Connect |
| `catalog` | The component workbench (Storybook) |
| `export` | DESIGN.md and the platform packages |
| `repo` | Git workflow, `/pr`, GitHub settings, the CI skeleton, lint requirements, `/editor-setup` |

## Commands

| Command | Does |
| --- | --- |
| `npx uxagent init` | Sets a repo up. Safe to rerun. |
| `npx uxagent sync` | Re-applies managed files after an update or config change. `--check` reports only. |
| `npx uxagent doctor` | Checks the install. |
| `npx uxagent eject <file>` / `restore <file>` | Overrides a packaged skill or context file, or drops the override. |
| `npx uxagent validate [--strict]` | The validator. The default command for the `validate` role. |
| `npx uxagent setup` | Scans setup progress. `--sync` creates or updates `ux/setup-status.md`. |
| `npx uxagent export design-md collect` / `lint [file]` | Helpers for `/export-design-md`. |
| `npx uxagent export platforms [targets…] [--list] [--self-test] [--out <dir>]` | The platform packages. |
| `npx uxagent export port-report <component file>` | The port report for one component. |
| `npx uxagent export inventory` | The registry's components and whether each one's source file exists. |

## Writing the docs in `agents/` and `templates/`

These rules exist because the docs are read from two places (this repo and
`node_modules/uxagent/`) and describe a project whose layout is configurable.

### Where things moved

| In prototyping-kit | In a uxagent project |
| --- | --- |
| `Code/` | The project's code. When a location matters: "the source folder" (`paths.source`, default `src/`). Never write `Code/`. |
| The command table in `Code/README.md` | `commands` in `ux/config.json` |
| `Code/ARCHITECTURE.md`, and the Quick Start and Gotchas in `Code/README.md` | `ux/architecture.md` |
| `Code/.env`, `Code/.env.example` | `.env`, `.env.example` at the project root |
| `Code/ds-validate.config.json` | `validate` in `ux/config.json` |
| `Code/scripts/ds-validate/` (a copy the prototype owned) | Gone. The validator runs from the package: `npx uxagent validate`. |
| `Docs/Design system/` | `design-system/` |
| `…/Figma/Tokens/`, `…/Figma/Assets/`, `…/Guidelines/`, `…/Supplemental/` | `design-system/figma/tokens/`, `design-system/figma/assets/`, `design-system/guidelines/`, `design-system/supplemental/` |
| `Docs/Design system/design-in-code architecture.md` | Package: `agents/reference/design-in-code.md` |
| `Docs/Tooling.md`, `Docs/github.md` | Package: `agents/reference/tooling.md`, `agents/reference/github.md` |
| `Docs/Personas/`, `Docs/Assets/` | `ux/personas/`, `ux/assets/` |
| `Docs/setup-status.md` | `ux/setup-status.md` |
| `Export/DESIGN.md` | `design-system/exports/DESIGN.md` |
| `Export/design-system/` | `design-system/exports/platforms/` |
| `Agents/skills/design-system-export/components/` | `design-system/platform-components/` |
| `Export/` as a drop zone for built prototypes | Gone. The project's own build output is its business. |
| `Agents/skills/`, `Agents/context/`, `Agents/prompts/` | Package: `agents/skills/`, `agents/context/`, `agents/prompts/` |
| "Record it in `Agents/context/`" (a learned convention) | `ux/context/` |
| The root `AGENTS.md` (rules, routing table) | The uxagent block in the project's `AGENTS.md` |
| Figma links written in two Markdown files | `figma` in `ux/config.json` |
| `/setup` | `/ux-setup` |
| `node Agents/skills/…/scripts/….mjs` | The matching `npx uxagent …` command above |
| `new-prototype.sh`, `template-only` blocks, the provenance line, the `template` remote | Gone. Installing is `npx uxagent init`; the lock file records the version. |
| "the template", "the kit" | uxagent, the package |
| "the prototype", "this prototype" | the project |

### Rules

1. **Write default paths literally.** `design-system/guidelines/color.md`, `ux/personas/`.
   The uxagent block in `AGENTS.md` tells agents to substitute the configured folder when
   `paths.designSystem` is not the default. Don't write "the design-system folder
   (`paths.designSystem`)" every time.
2. **Links between package files are relative Markdown links.** They resolve here and in
   `node_modules/uxagent/`.
3. **A package file names a project file as inline code, not a link:**
   `` `ux/architecture.md` ``. A relative link from the package into a project can't resolve.
4. **A seeded file (under `templates/`) never contains a package path.** It names a skill
   (`/ux-setup`, "the `design-tokens` skill") or a document by title ("the validator
   contract, listed in the uxagent section of `AGENTS.md`"). Links between seeded files in
   the same tree (`design-system/` to `design-system/`, `ux/` to `ux/`) stay relative;
   across trees, use inline code.
5. **No project facts in the package** (see the table above). Where the old text said
   "record the namespace here", say where in the project it goes.
6. **Name commands by role**, and CLI commands in full (`npx uxagent validate`).
7. **Don't assume uxagent set the repo up.** In an existing codebase the stack, linters,
   CI, and git conventions were there first. Text that belongs only to a repo uxagent
   set up from scratch is part of the `repo` module; say "if the project uses uxagent's git
   workflow" or similar when a `core` document must mention it.
8. **Keep it short and plain.** The readers are agents and designers. Don't restate a rule
   that another file owns; link to it. Don't add history ("this used to be…").
9. **Don't rename, add, or delete files under `agents/`** without updating
   `agents/manifest.json` and the checks in `test/docs/`.

## How `sync` decides

`src/install/core.mjs` builds the list of files uxagent wants in the project (`desired`),
compares it with the project and the lock file (`plan`), and writes the difference
(`apply`). `init` writes `ux/config.json` and then syncs; `doctor` is a plan that is
reported instead of applied.

- A managed file is rewritten only when its content still matches the hash in the lock.
  If a person edited it, it stays, and `sync` and `doctor` say so (`--force` replaces it).
- A file at a managed path that uxagent did not write is never touched. A skill shadowed
  this way also loses its row in the `AGENTS.md` block.
- A managed file that is no longer wanted (a skill opted out, a module or agent tool
  turned off) is deleted, if unedited.
- Blocks in files the project owns (`AGENTS.md`, `.gitignore`, an existing `CLAUDE.md`)
  sit between `uxagent:start` and `uxagent:end` markers. Only the text between them
  changes.
- A seed is written when it is absent and not yet listed under `seeded` in the lock. So a
  file the project deleted stays deleted, and a seed added by a later version arrives.
- Stub and routing paths go through one function, so an ejected file is picked up
  everywhere at once.

## Changing the validator

The validator and its contract, `agents/reference/design-in-code.md`, change together. A
change to a contract rule changes `src/validate/` and `test/validate/` in the same pull
request, with a fixture that fails without it. Rule ids (`ds/<id>`) are matched by the
backlog's rationale carry-forward, so never rename one. `npm run test:docs` fails when the
contract and the code list different rules.

## Checks

- `npm test`: validator, export, setup-scan, and installer tests.
- `npm run test:docs`: every relative link and anchor resolves; the manifest, the skills,
  the checklist, and the validator contract agree with each other.
