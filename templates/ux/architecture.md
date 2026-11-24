# Architecture

How this codebase implements the design system, and how to work with it. Written for
agents and the project's owner. Fill in each section for the stack in use, and verify every
claim against the code before editing. In an existing codebase, this file records what is
already there rather than what uxagent chose.

## TL;DR

<!-- Stack in one line, the non-negotiables that are specific to this stack, and the key
     commands from the Commands section below. -->

## Stack

<!-- Framework, language, styling approach, token tool, and anything else an agent must
     know before editing. Versions where they matter. -->

## Project Structure

<!-- The folders under the source folder and what lives in each: pages, components, styles,
     generated token CSS, scripts. Mark generated folders. -->

## Quick Start

<!-- Fill in: install dependencies, run `tokens`, run `dev`, open the dev server's address. -->

```bash
# 1. Install dependencies: <fill in>
# 2. Generate tokens:      <tokens>
# 3. Start the dev server: <dev>
```

## Commands

Docs, skills, and CI name commands by **role**, never by tool. `commands` in
`ux/config.json` maps each role to this project's real command; keep it current when the
stack changes. `null` means the role isn't wired yet, and `"n/a"` means the project will
never have it.

| Role | What it must do |
| --- | --- |
| `dev` | Start the local dev server. The only place dev-only pages render. Say how to pass a different port. |
| `build` | Produce the production build. Runs `tokens` first, the alpha regression guard, and the dev-only pages guard. |
| `lint` | Formatting check, code lint, and CSS validity. Technical only; design-system findings belong to `validate`. |
| `check` | Type or template check, if the stack has one. |
| `tokens` | Unpack the token source (a Figma variables export, by default) and regenerate the token CSS. |
| `validate` | Run design-system validation and rewrite `design-system/deviations-backlog.md`. Exits 0 with deviations present, 1 on a scoping error; `validate --strict` also exits 1 on any deviation (local only). The default is `npx uxagent validate`. |
| `stories` | Start the component workbench (Storybook by default) locally. Like `dev`, the only place it renders. |
| `stories-build` | Build the workbench to its static folder and check every story renders. |
| `connect` | Validate the Figma Code Connect files without publishing. `connect --publish` publishes them to Figma: local only, needs `FIGMA_ACCESS_TOKEN` in the project's root `.env`. |

The last three stay off until `/component-catalog` turns them on. `connect` becomes `n/a`
if the project doesn't use Figma.

## Gotchas

<!-- Stack quirks that cost someone time: environment variables, system binaries a script
     shells out to, framework behaviour that surprised you. One short entry each. -->

## Styling Rules

<!-- How this stack scopes component styles, where the generated token CSS lives, the
     token namespace (`--<prefix>-*`), how the global stylesheet is kept minimal, which
     file it is, and where the allowed global classes list lives (`validate.allowedGlobalClasses`
     in `ux/config.json`). The rule behind it is "Scoping: global or component" in uxagent's
     design-in-code reference, listed in the uxagent section of `AGENTS.md`. -->

## Validation

<!-- Which validator implements the validator contract (listed in the uxagent section of
     `AGENTS.md`) and on what engine (uxagent's Stylelint-based validator by default; where
     its settings live in `validate` in `ux/config.json`), which linters `lint` runs (they
     are technical only), where each one's config lives, and any stack-specific
     exemptions. Include where `tokens` writes the token manifest, and how
     the validator resolves a rule block's selector for the token usage rules (nesting,
     scoped-style rewriting). -->

## Dev-only pages guard

<!-- Where dev-only pages live, how this stack keeps them out of every build, and how the
     build fails if one leaks. The contract is uxagent's dev-only pages rules, listed in the
     uxagent section of `AGENTS.md`. -->

## Component catalog

<!-- Filled in by /component-catalog; the contract is uxagent's component catalog rules,
     listed in the uxagent section of `AGENTS.md`.
     Workbench: the tool and version (Storybook by default, or a dev-only gallery page),
     where its config lives, how its preview loads the global stylesheet and token CSS,
     how token modes are switched, and where its static output goes.
     Code Connect: the parser or template setup, where figma.config.json lives, what
     `connect` runs in CI and whether it needs a token. Write "Not used" if the project
     doesn't use Figma. -->

## Build & Dev Workflow

<!-- Commands reference, the order things run in during `build`, and the typical loops:
     after a new token export, before committing component changes. -->

## Maintenance

<!-- When to regenerate tokens, how to add a component (with its registry row, story,
     and Code Connect file), how to work down the deviations backlog, and which docs to
     update when this file changes. -->
