---
name: component-catalog
description: Turn on the component workbench (Storybook by default) and Figma Code Connect for the project's stack, then fill in stories and mappings from the component registry. Use when the user invokes /component-catalog, after a stack is chosen and the first components exist, when components were added without stories or mappings, or when a Figma library was recorded after components were built.
---

# /component-catalog

Turns uxagent's stack-neutral component catalog into working tools for the project's
stack, then fills in whatever is missing.

This file holds the steps only. Read these first and follow them throughout:

- **Rules:** [`component-catalog.md`](../../context/component-catalog.md),
  the contract every story, mapping, and registry entry must meet.
- **Tool facts:** the Storybook and Figma Code Connect entries in
  [`tooling.md`](../../reference/tooling.md#component-catalog): installer gotchas,
  add-ons, Code Connect setup by stack, commands, and plan requirements.

Safe to rerun. Each run only fills gaps: a workbench that is already set up is left alone,
a component that already has a story or mapping is skipped, and a piece whose inputs are
missing is skipped and reported, not treated as an error.

Commands are named by role; `commands` in `ux/config.json` maps each to the real command.
Run them from the project root, or from where the project's code lives.

## Steps

### 1. Check the inputs

Work out which pieces can turn on, and tell the user before changing anything:

- **Stack:** the project has a package manifest (or equivalent) and `commands` in
  `ux/config.json` has real commands for `dev` and `build`. Without one, stop: there is nothing to turn
  on yet.
- **Components:** at least one component exists in the source folder (`paths.source`). Without one, stop.
- **Figma library:** `figma.library` in `ux/config.json` (see "Figma sources" in
  [`design-system.md`](../../context/design-system.md#figma-sources)). If `figma` is
  `false`, or the library is still `null`, skip the Code Connect step.

Work on a `chore/component-catalog` branch per
[`git-workflow.md`](../../context/git-workflow.md) if the project uses uxagent's git
workflow, unless this chat is already on a branch for this work.

### 2. Reconcile the registry

In `design-system/guidelines/components.md`, following the contract's registry rules:

- Add a row for each component in the project that has none, with its code path (relative
  to the project root). Fill in its
  code attributes in the property mappings from the component's `data-*` attributes.
- If a Figma library is recorded and the Figma tools are available, add the node link and
  Figma properties for components that match a row: core components from the library
  file, project-specific ones from the site file.
- Remove the placeholder `<Name>` row once a real row exists.

### 3. Set up the workbench

Skip if the workbench is already set up (the `stories` role has a real command in
`commands`).

1. Run Storybook's installer from the project (`npx storybook@latest init`), then pin the
   installed version. If it can't detect the framework, or Storybook doesn't support the
   stack, follow "Without Storybook" in the contract instead and adapt the rest of this
   step.
2. Configure the preview as the contract's workbench rules require. If the tokens have
   modes (light and dark, for example), add a toolbar control that switches them the same
   way the project does (the same attribute or class).
3. Delete the example stories and assets the installer adds.
4. Point the stories glob at the component folders.
5. Add the workbench's static output folder to `.gitignore` and to every linter's ignore
   list, next to the generated token CSS.
6. Make `stories-build` build the workbench and check every story renders (Storybook's
   test runner or its Vitest integration).
7. Optional, ask first: the add-ons listed under Storybook in
   [`tooling.md`](../../reference/tooling.md#component-catalog).

### 4. Write the stories

For each registry row with a code path and no story, write its story as the contract's
story rules describe, titled with the registry name: a story per meaningful variant, or
one story that shows every combination. Fill in the row's Story column with the story id.

### 5. Set up Code Connect

Skip when no Figma library is recorded; mark the Code Connect column `n/a` when
`figma` is `false` in `ux/config.json`.

1. Add `@figma/code-connect` as a dev dependency, pinned.
2. Create `figma.config.json` at the project root (or wherever the project's code lives),
   using the setup for this stack from the Code Connect entry in
   [`tooling.md`](../../reference/tooling.md#component-catalog). Its
   `codeConnect.include` matches the Code Connect files next to the components. Check the
   [Code Connect docs](https://developers.figma.com/docs/code-connect/) for the current
   options before writing it.
3. For each registry row with a code path and a Figma node link, write its Code Connect
   file as the contract's rules describe. Load the Figma Code Connect skill if one is
   available.
4. Point `connect` and `connect --publish` at the validate and publish commands in
   [`tooling.md`](../../reference/tooling.md#component-catalog). Prefer a validation that
   needs no token, so CI can run it; if it needs `FIGMA_ACCESS_TOKEN`, add it as a CI
   secret and say so in `ux/architecture.md`.
5. Add `FIGMA_ACCESS_TOKEN` to `.env.example` at the project root.
6. Don't publish. Tell the user to put a Figma personal access token in the project's root
   `.env`, run `connect --publish`, and check the plan requirement in `tooling.md` first.

Mark the Code Connect column `✓` for each component whose file passes `connect`.

### 6. Fill in the docs and CI

- `ux/config.json`: real commands for `stories`, `stories-build`, and `connect` under
  `commands`.
- `ux/architecture.md`: the "Component catalog" section: how the workbench and Code Connect
  are set up here.
- CI: if the project has a workflow that runs checks (uxagent's is
  `.github/workflows/ci.yml`), replace the `stories-build` and `connect` placeholders with
  the real commands. Leave out the `connect` step if the project doesn't use Figma.

### 7. Verify

Run `lint`, `check`, `build`, `validate`, `stories-build`, and `connect` (when on). Then:

- The `build` output contains no stories and no workbench files.
- `stories` starts, and each new story renders with the project's tokens.
- `validate` added no deviations from story files.

Commit per [`git-workflow.md`](../../context/git-workflow.md), or the project's own conventions (type `chore` for the setup,
`feat` for stories and mappings added later) and push the branch. Report which pieces
turned on, which were skipped and why, and what the user still has to do (publishing).

## Notes

- Stories and mappings for components added later come from rerunning this skill, or
  from writing them by hand in the same change as the component.
- When a Figma library is recorded after the workbench is on, rerun: the registry and
  Code Connect steps are the only ones with work to do.
