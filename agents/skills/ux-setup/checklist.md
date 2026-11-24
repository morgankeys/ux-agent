# Setup checklist

The canonical list of everything a project needs before uxagent is fully set up: tools to
install, configuration to write, decisions to record, and stubs to fill in. `/ux-setup`
([`SKILL.md`](SKILL.md)) reads this file, checks the project against it, and reports what is
left.

It is written for agents. Ids, levels, and role names are working notes; when talking to
the user, follow [`guiding-users.md`](../../context/guiding-users.md).

**This file holds definitions only. Never tick anything off here.** Each project's progress
lives in `ux/setup-status.md`, one row per item id below, written by `/ux-setup`. Keeping
the two apart means this file is replaced by a newer version with `npm update uxagent`
without losing a project's progress: a new item simply shows up as a new row.

Rules and tool facts are not restated here. Each item links to the file that owns them:
rules in [`context/`](../../context/), procedures in other skills, tools (with where to get
them) in [`tooling.md`](../../reference/tooling.md).

## How to read an item

| Column | Meaning |
| --- | --- |
| **Item** | Stable id. Never rename one; status rows are matched on it. |
| **Who** | `user`: only a person can do it (a decision, an account, a file from Figma). `agent`: an agent does it once its inputs exist. `both`: the user decides or supplies something, then the agent does the work. |
| **Level** | `required`: a rule or check depends on it, so it can't be opted out of. The tool that does the job can still be swapped for an equivalent. `default`: set up unless the user opts out. `optional`: offered once, set up only if the user opts in. `anytime`: content that fills in as the project goes; reported, never a blocker. |
| **Module** | The uxagent module the item belongs to (`core`, `tokens`, `validator`, `dev-pages`, `figma`, `catalog`, `export`, `repo`). When that module is off in `ux/config.json`, the item is `n/a`, and the scan says why. |
| **Needs** | Items that must be `done` first. An item whose needs aren't met is `waiting`, not `todo`. A need that is `n/a` or `opted out` doesn't block. |
| **Done when** | What to check in the project. *Ask* means it can't be seen from the project: take the user's word and record the date. |

Every `figma` item is `n/a` when `figma` is `false` in `ux/config.json` (the project does
not use Figma). A `null` link there means the decision is still open (see `project-figma`).

Commands are named by role; `commands` in `ux/config.json` maps each role to the real
command. A role is wired when its value is a command string, and `"n/a"` means the project
will never have it.

In an existing codebase (`preset: "existing"`, `repo` module off) the project's own git
workflow, PR process, CI, linters, and editor config stay in charge, so the `repo` items are
`n/a`. The stack was there first: `stack-choice` records it.

## 1. Project

| Item | What | Who | Level | Module | Needs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| `project-install` | uxagent is installed in the project. | agent | required | core | | `ux/config.json` and `ux/uxagent.lock.json` exist, and `npx uxagent doctor` passes. |
| `project-figma` | Decide whether the project uses Figma, and record the site and library file links, or `figma: false`. | user | required | core | | `figma` in `ux/config.json` is `false`, or both `figma.site` and `figma.library` are links. |
| `project-github` | Create `staging`, and apply the repo settings and rulesets in [`github.md`](../../reference/github.md). | user | default | repo | | A `staging` branch exists on the remote. Settings and rulesets: *ask*; agents can't see them. |
| `repo-suggestions` | When the `repo` module is off: compare the project's own git workflow, PR process, CI, and linters with uxagent's reference ([`git-workflow.md`](../../context/git-workflow.md), [`github.md`](../../reference/github.md), [`/pr`](../pr/SKILL.md)) and offer improvements one at a time, including adding the `validate` step to the project's CI. Nothing changes without a yes. | both | optional | core | `project-install` | The user has answered each suggestion (accepted or declined), or the `repo` module is on, so uxagent's own workflow is already in use. |

## 2. Stack

| Item | What | Who | Level | Module | Needs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| `stack-choice` | In an existing codebase, record its stack. In a bare repo, pick a stack and scaffold it, keeping `ux/` and `design-system/`. | both | required | core | `project-install` | The source folder (`paths.source`) has a project manifest, and "Stack" in `ux/architecture.md` names the framework, language, and styling approach. |
| `stack-commands` | Wire the `dev`, `build`, and `check` roles in `commands`, and fill in Quick Start in `ux/architecture.md`. | agent | required | core | `stack-choice` | `dev` and `build` have real commands, `check` has one or `"n/a"`, and Quick Start has real commands and the dev URL. |
| `stack-gitignore` | Ignore the stack's dependency folders, build output, and caches in `.gitignore`. | agent | required | repo | `stack-choice` | After an install and a `build`, `git status` shows no dependency or build files. |
| `stack-dev-guard` | Keep dev-only pages out of every build, with a guard that fails the build if one leaks ([contract](../../context/dev-only-pages.md)). | agent | required | dev-pages | `stack-choice` | A `dev/` pages folder is excluded from `build`, `build` runs the guard, and "Dev-only pages guard" in `ux/architecture.md` describes both. |
| `stack-architecture` | Fill in `ux/architecture.md`. | agent | required | core | `stack-choice` | No section is still only its template comment, apart from sections for pieces that are opted out or `waiting`. |
| `stack-ci` | Replace the placeholders in `.github/workflows/ci.yml` with real commands. | agent | default | repo | `stack-commands` | No step whose role has a real command still echoes `TODO`. Steps for roles the project will never use (opted out or `"n/a"`) are deleted, not left as placeholders. |
| `stack-editor` | Set up the user's editor so every file type in the source folder is highlighted and the project's linters show as underlines ([`/editor-setup`](../editor-setup/SKILL.md)). | both | default | repo | `stack-choice`, `lint-role` | The user says their files look right. For VS Code or Cursor, `.vscode/extensions.json` also recommends an extension for each file type and linter that needs one. |

## 3. Tokens

| Item | What | Who | Level | Module | Needs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| `tokens-source` | Bring in the token source. Default: export each variable collection from the Figma library file and drop the zips in `design-system/figma/tokens/` ([Figma variables export](../../reference/tooling.md#figma-variables-export)). | user | required | tokens | `project-figma` | The folder holds at least one export `.zip`, or `design-system/README.md` says where tokens are maintained and they are stored under `design-system/`. |
| `tokens-pipeline` | Install a token converter ([Style Dictionary](../../reference/tooling.md#style-dictionary) by default) and wire the `tokens` role ([design-tokens skill](../design-tokens/SKILL.md)). | agent | required | tokens | `tokens-source`, `stack-choice` | `tokens` has a real command; each collection is unpacked into its own tracked folder; the generated token CSS exists with a generated-file header; the token manifest is written; `build` runs `tokens` first. |
| `tokens-alpha-guard` | Preserve alpha in the color transform and add the regression guard ([the alpha gotcha](../design-tokens/SKILL.md#critical-the-alpha-gotcha)). | agent | required | tokens | `tokens-pipeline` | `build` runs an assertion that fails when a source token with `alpha < 1` is emitted without alpha, and every such token in the generated CSS is alpha-bearing. |
| `tokens-namespace` | Record the token namespace. | agent | required | tokens | `tokens-pipeline` | `namespace` in `design-system/token-usage.json` is the real prefix and matches the generated token CSS, and "Styling rules" in `ux/architecture.md` uses it. |
| `tokens-usage-map` | Replace the example groups in `design-system/token-usage.json` with this project's ([Token usage](../../reference/design-in-code.md#token-usage)). The agent proposes; the design-system owner decides. | both | default | validator | `tokens-pipeline`, `ds-validator` | The "starting example" note is gone from the file, and `validate` prints no warning for a group that matches no token. |

## 4. Enforcement

The checks always run; none can be skipped. Agents fix technical findings themselves; the
user decides what to do about design findings, not whether to look (see "Operating notes" in
the uxagent section of `AGENTS.md`). Design findings come only from `validate`; `lint` is
technical ([Validation and linting](../../reference/design-in-code.md#validation-and-linting)).

In an existing codebase, the first `validate` run may report many deviations and scoping
errors. Deviations are recorded in `design-system/deviations-backlog.md`, never dropped;
working them down is gradual, not a setup blocker.

| Item | What | Who | Level | Module | Needs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| `ds-validator` | Wire the design-system validator ([`/design-validator`](../design-validator/SKILL.md)): fill in `validate` in `ux/config.json` for the stack, and set the `validate` role (`npx uxagent validate` by default; [tool notes](../../reference/tooling.md#design-system-validator), [contract](../../reference/design-in-code.md#validator-contract)). | agent | required | validator | `stack-choice`, `tokens-pipeline`, `tokens-namespace` | `validate` has a real command, exits 0 with deviations present, exits 1 on a scoping error (with an allowed global classes list in place, even if empty), `validate --strict` exits 1 on any deviation, `design-system/deviations-backlog.md` exists, and the project's `lint` config does not load the validator's rules. |
| `lint-stylelint` | [Stylelint](../../reference/tooling.md#stylelint) with the standard config, for CSS validity (syntax, unknown properties, invalid values). Token use is not its job: `validate` owns that. | agent | required | repo | `stack-choice` | `stylelint` and `stylelint-config-standard` are dev dependencies with a config, `lint` runs it, and no rule in the config fails `lint` over a hardcoded value. |
| `lint-prettier` | [Prettier](../../reference/tooling.md#prettier--eslint) for formatting. | agent | required | repo | `stack-choice` | It is a dev dependency with a config, and `lint` runs its check. |
| `lint-eslint` | [ESLint](../../reference/tooling.md#prettier--eslint) for code lint. | agent | required | repo | `stack-choice` | It is a dev dependency with a config, and `lint` runs it. |
| `lint-role` | Wire the `lint` role, and keep generated files out of every linter. | agent | required | repo | `stack-choice` | `lint` has a real command that runs all three, and each linter ignores the generated token CSS and the workbench's static output. |

## 5. Figma tools

| Item | What | Who | Level | Module | Needs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| `figma-mcp` | Connect the [Figma MCP server](../../reference/tooling.md#figma-mcp-server) to the agent tool in use, so agents can read the files and push captures back. Signing in is the user's step. | user | default | figma | `project-figma` | A Figma MCP tool answers in this session (for example, reading the library file). If none is available here, *ask*. |
| `figma-registry` | List the library's components in the [component registry](../../context/component-catalog.md#the-registry) (`design-system/guidelines/components.md`), with node links and variant properties. | agent | default | figma | `figma-mcp` | The registry has real rows for the library's components and the placeholder row is gone. |
| `figma-capture` | Add [figma-capture-button](../../reference/tooling.md#figma-capture-button), loaded only in development. | agent | default | figma | `stack-choice` | It is a dev dependency, loaded behind the stack's dev-mode flag, and a search of the `build` output for `figma-capture` finds nothing. |

## 6. Component catalog

All of these are done by [`/component-catalog`](../component-catalog/SKILL.md), which is
safe to rerun. Rules: [`component-catalog.md`](../../context/component-catalog.md).

| Item | What | Who | Level | Module | Needs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| `catalog-workbench` | Turn on the component workbench ([Storybook](../../reference/tooling.md#storybook) by default). | agent | default | catalog | `stack-choice`, and at least one component in the source folder | `stories` and `stories-build` have real commands, the installer's example stories are gone, and the preview loads the global stylesheet and token CSS. |
| `catalog-stories` | A story for every component. | agent | default | catalog | `catalog-workbench` | Every registry row with a code path has a story id, and `stories-build` passes. |
| `catalog-addon-mcp` | Storybook's MCP add-on (`@storybook/addon-mcp`), so agents can query components and stories. | agent | optional | catalog | `catalog-workbench` | It is listed in the workbench's add-ons and pinned. |
| `figma-addon-designs` | `@storybook/addon-designs`, to embed each component's Figma frame in its story. Offer it when Code Connect can't be published on the project's Figma plan. | agent | optional | figma | `catalog-workbench`, `project-figma` | It is listed in the workbench's add-ons, and stories with a Figma node link carry it. |
| `figma-connect-setup` | Install and configure [Figma Code Connect](../../reference/tooling.md#figma-code-connect). | agent | default | figma | `stack-choice`, `project-figma`, and at least one component in the source folder | `@figma/code-connect` is a pinned dev dependency, `figma.config.json` exists in the project, `connect` has a real command, and `FIGMA_ACCESS_TOKEN` is added to the project's root `.env.example`. |
| `figma-connect-core` | Code Connect mappings for core components: the ones that come from the library file. | agent | default | figma | `figma-connect-setup`, `figma-registry` | Every registry row with a code path and a library node link has `✓` under Code Connect, and `connect` passes. |
| `figma-connect-project` | Code Connect mappings for project-specific components: built for this project and designed in the site file, not the library. | agent | default | figma | `figma-connect-setup` | Every such component has a registry row with a site-file node link and `✓` under Code Connect, or its Figma column is empty because it has no Figma counterpart. |
| `figma-connect-publish` | Publish the mappings: check the [plan requirement](../../reference/tooling.md#figma-code-connect), put a personal access token in `.env`, run `connect --publish`. Agents never publish. | user | default | figma | `figma-connect-core` | *Ask.* |

## 7. Content

Fills in as the project goes. `/ux-setup` reports these in one short list after everything
else and never treats them as blockers ("Unfilled is fine": see
`design-system/guidelines/README.md`).

| Item | What | Who | Level | Module | Needs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| `content-ds-summary` | Summarize the design system at the top of `design-system/README.md`. | both | anytime | core | `tokens-namespace` | The summary comment is replaced with real text. |
| `content-guidelines` | Fill in the guideline files in `design-system/guidelines/`. | both | anytime | core | | Report how many of the files are still stubs; there is no finish line. |
| `content-supplemental` | List tokens and assets that aren't Figma variables in `design-system/supplemental/README.md`. | both | anytime | core | | The list comment is replaced, or the user says there are none. |
| `content-personas` | Replace the example user and org in `ux/personas/` with real ones, or delete them. | user | anytime | core | | No `example-user` or `example-org` folder is left, and the two list files name real entries or say there are none. |

Exporting the design system (`/export-design-md`, the design-system export skill) is done
as needed, so it isn't a setup item and isn't tracked.

## Stubs

Every placeholder uxagent seeds, and the item that fills it in. There are two kinds,
told apart by the **Where** column:

- **File stub:** Where is a file in the project, named by the default layout
  (`design-system/…` is mapped to `paths.designSystem` when that is not the default). It is
  **open** while the file contains the marker text. A file that does not exist is not open:
  it was deleted on purpose or never seeded.
- **Config stub:** Where is `config:` and a key path in `ux/config.json`, such as
  `config:commands.dev`. The marker column says `null`. It is **open** while the value is
  `null`; a command string, `"n/a"`, or `figma: false` all close it.

A stub whose item is `n/a` (its module is off, or Figma is not used) is not open. The
scan, `npx uxagent setup`, reads this table, so a marker must be copied exactly from the
file and must not contain a `|`.

A stub that is still open after its item is `done` means the item isn't done. Where
several items fill in one file, the item column names who owns each line; use the line
numbers the scan prints to see whose lines are left. A stub that is open because its piece
is opted out or `n/a` should be deleted from its file, not left as a placeholder;
`/ux-setup` offers to do that.

When a seeded file gains a placeholder, add its row here in the same change.

| Stub | Where | Marker | Item |
| --- | --- | --- | --- |
| `stub-figma-site` | `config:figma.site` | `null` | `project-figma` |
| `stub-figma-library` | `config:figma.library` | `null` | `project-figma` |
| `stub-cmd-dev` | `config:commands.dev` | `null` | `stack-commands` |
| `stub-cmd-build` | `config:commands.build` | `null` | `stack-commands` |
| `stub-cmd-check` | `config:commands.check` | `null` | `stack-commands` |
| `stub-cmd-lint` | `config:commands.lint` | `null` | `lint-role` |
| `stub-cmd-tokens` | `config:commands.tokens` | `null` | `tokens-pipeline` |
| `stub-cmd-validate` | `config:commands.validate` | `null` | `ds-validator` |
| `stub-cmd-stories` | `config:commands.stories` | `null` | `catalog-workbench` |
| `stub-cmd-stories-build` | `config:commands.stories-build` | `null` | `catalog-workbench` |
| `stub-cmd-connect` | `config:commands.connect` | `null` | `figma-connect-setup` |
| `stub-quick-start` | `ux/architecture.md` | `<!-- Fill in: install dependencies` | `stack-commands` |
| `stub-arch-tldr` | `ux/architecture.md` | `<!-- Stack in one line` | `stack-architecture` |
| `stub-arch-stack` | `ux/architecture.md` | `<!-- Framework, language` | `stack-choice` |
| `stub-arch-structure` | `ux/architecture.md` | `<!-- The folders under the source folder` | `stack-architecture` |
| `stub-arch-styling` | `ux/architecture.md` | `<!-- How this stack scopes` | `stack-architecture` |
| `stub-arch-validation` | `ux/architecture.md` | `<!-- Which validator implements` | `ds-validator` |
| `stub-arch-dev-guard` | `ux/architecture.md` | `<!-- Where dev-only pages live` | `stack-dev-guard` |
| `stub-arch-catalog` | `ux/architecture.md` | `<!-- Filled in by /component-catalog` | `catalog-workbench` |
| `stub-arch-workflow` | `ux/architecture.md` | `<!-- Commands reference` | `stack-architecture` |
| `stub-arch-maintenance` | `ux/architecture.md` | `<!-- When to regenerate tokens` | `stack-architecture` |
| `stub-ci` | `.github/workflows/ci.yml` | `echo "TODO` | `stack-ci` |
| `stub-namespace-map` | `design-system/token-usage.json` | `"namespace": "<prefix>"` | `tokens-namespace` |
| `stub-usage-map-example` | `design-system/token-usage.json` | `starting example for a Material-style system` | `tokens-usage-map` |
| `stub-registry-row` | `design-system/guidelines/components.md` | `<Figma node link>` | `figma-registry` |
| `stub-registry-mapping` | `design-system/guidelines/components.md` | `### <Name>` | `figma-registry` |
| `stub-ds-summary` | `design-system/README.md` | `<!-- Summarize the system here` | `content-ds-summary` |
| `stub-supplemental` | `design-system/supplemental/README.md` | `<!-- List supplemental sources here` | `content-supplemental` |
| `stub-guideline-overview` | `design-system/guidelines/overview.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-color` | `design-system/guidelines/color.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-typography` | `design-system/guidelines/typography.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-layout` | `design-system/guidelines/layout.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-elevation` | `design-system/guidelines/elevation.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-shape` | `design-system/guidelines/shape.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-motion` | `design-system/guidelines/motion.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-accessibility` | `design-system/guidelines/accessibility.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-content` | `design-system/guidelines/content.md` | `- **Do** …` | `content-guidelines` |
| `stub-guideline-components` | `design-system/guidelines/components.md` | `- **Do** …` | `content-guidelines` |
| `stub-persona-user` | `ux/personas/users/example-user/example-user.md` | `Profile of user` | `content-personas` |
| `stub-persona-org` | `ux/personas/orgs/example-org/example-org.md` | `Profile of organization` | `content-personas` |

## Changing this checklist

- **New item:** add a row with a new id and its module, and its stub rows if it has
  placeholders. Projects pick it up as a new row the next time `/ux-setup` runs.
- **Retired item:** delete the row. `/ux-setup` flags the leftover status row so the project
  can drop it.
- **New tool:** its facts and links go in [`tooling.md`](../../reference/tooling.md); the
  row here links to that entry.
