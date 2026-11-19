# Agents

The agent material that ships with uxagent. Agents in a project reach these files through
the uxagent section of the project's `AGENTS.md`, which routes each kind of task to the
right file. The list of everything shipped, with the module each item belongs to, is
[`manifest.json`](manifest.json).

The files here are owned by the package. A project changes one with `npx uxagent eject
<file>`, which copies it into `ux/overrides/`; see
[`context/repo-structure.md`](context/repo-structure.md). What a project learns for
itself goes in its own `ux/context/`.

## What is here

- **[`skills/`](skills/)**: a repeatable capability with clear trigger conditions, one
  folder per skill with a `SKILL.md`. Load a skill when the user invokes it or the
  task matches its description. They are `ux-setup` (checks the project against the setup
  checklist and walks through what is left), `design-tokens` (regenerate tokens from an
  export and validate), `design-validator` (wire and tune the validator),
  `token-usage-review` (check that tokens are used for their intended purpose),
  `component-catalog` (turn on the workbench and Figma Code Connect),
  `export-design-md` (build a portable `DESIGN.md`), `design-system-export` (package the
  design system for Lovable, Replit, Bolt.new, v0, and Figma Make), `editor-setup` (make
  the editor highlight every file type and show lint problems), and `pr` (commit, push,
  and open a pull request).
- **[`context/`](context/)**: durable conventions and background. Load the files that
  match your task before changing anything.
  - [`repo-structure.md`](context/repo-structure.md): how uxagent is laid out in a project
    and what an agent may edit. Load before changes that span folders.
  - [`guiding-users.md`](context/guiding-users.md): how to work with designers who may be
    new to codebases. Load before `/ux-setup` and before any task where the user has to do
    something themselves.
  - [`design-system.md`](context/design-system.md): styling and component conventions.
    Load before editing components or styles.
  - [`component-catalog.md`](context/component-catalog.md): the component registry,
    workbench, and Code Connect rules. Load before adding a component, story, or mapping.
  - [`dev-only-pages.md`](context/dev-only-pages.md): the rules for sandbox and specimen
    pages. Load before adding a page that is not for the audience.
  - [`git-workflow.md`](context/git-workflow.md): branches, commits, and pull requests,
    for projects that use uxagent's git workflow. Load before creating a branch or
    committing.
  - [`design-system-platforms.md`](context/design-system-platforms.md) and
    [`design-system-platform-packages.md`](context/design-system-platform-packages.md):
    how each AI platform ingests a design system, and what the export hands it. Load when
    exporting.
  - [`troubleshooting/`](context/troubleshooting/README.md): gotchas indexed by symptom.
    Load only the entry that matches.
- **[`prompts/`](prompts/)**: ready-to-run task templates, parameterized and short:
  [`review-drift`](prompts/review-drift.md) (review the project's docs against its code)
  and [`regenerate-tokens`](prompts/regenerate-tokens.md) (bring in a new token export).
- **[`reference/`](reference/)**: facts that change slowly, read when a task needs them.
  [`design-in-code.md`](reference/design-in-code.md) is the validator contract and the
  principles behind it; [`tooling.md`](reference/tooling.md) covers third-party tools;
  [`github.md`](reference/github.md) covers repository settings, for projects that use
  uxagent's git workflow.
