# uxagent

Design-system guardrails and agent skills for building UI with AI agents. Install it in
any repo, new or existing, ask your agent to run `/ux-setup`, and point it at a Figma
file.

uxagent adds two folders and some wiring to your repo. Your code stays where it is.

## What you get

- **`design-system/`** is the source of truth for design: token exports from Figma,
  written guidelines, the component registry, and a map of what each token is for.
- **`ux/`** holds how this project uses the design system: one config file, setup
  progress, example users and organizations, and conventions your agents learn as they
  work.
- **Checks that keep the code on the design system.** `npx uxagent validate` finds
  hardcoded colors, spacing, and type, tokens used for the wrong job, and styles outside
  their component. What it finds is recorded in a backlog, never silently dropped.
- **Skills for your agents**: setting up tokens, cataloguing components in Storybook and
  Figma Code Connect, reviewing token use, and exporting the design system to other AI
  tools. Claude Code, Cursor, GitHub Copilot, and Gemini all read the same material,
  starting at `AGENTS.md`.

Every project needs a source of truth for tokens. The default is Figma:

**Figma → tokens → code → capture back to Figma**.

A team can instead keep tokens in the repo, or in another repository, and feed both the
code and Figma. Other design tools work too, as long as the tokens are stored in the repo.

## Install

uxagent is not on npm yet. Until it is, install it from GitHub. In your repo:

```bash
npm install -D github:morgankeys/ux-agent
```

```bash
npx uxagent init
```

Then ask your agent to run **`/ux-setup`**. It looks at what your repo already has, tells
you what it needs from you, does the technical work itself, and walks you through the rest
one step at a time. You don't need to have set up a codebase before.

`init` works out whether this is a new repo or an existing codebase:

- **A new repo** gets everything, including a git workflow, a CI skeleton, and lint
  setup.
- **An existing codebase** keeps its own git, CI, lint, and pull request conventions.
  uxagent adds only the design-system parts, and never replaces a file or skill that is
  already there. `/ux-setup` can suggest improvements to your conventions; nothing
  changes unless you say yes.

To choose yourself, pass `--preset greenfield` or `--preset existing`. If your repo
already has a `design-system/` folder, pass `--design-system <folder>` to put uxagent's
somewhere else.

### What to bring

- **Your design files.** Links to the Figma file with your core styles and components
  (the library) and the one with the screens you want to build. Not using Figma is fine;
  say so and the Figma steps are skipped.
- **Your design tokens.** The colors, type, and spacing from your library, exported from
  Figma. `/ux-setup` shows you how.
- **An idea of what you're building**, and who will see it.
- **Content, when you have it.** Example users and organizations, images, and any written
  design guidelines. These can come later.

Most of the tools are optional; tell the agent to skip any you don't want. Rerun
`/ux-setup` whenever you like to see what is still open.

## What goes where

| In your repo | What | Who changes it |
| --- | --- | --- |
| `design-system/`, `ux/` | Your design system and project settings, started from uxagent's templates | You and your agents |
| The uxagent section of `AGENTS.md`, the skill stubs in `.claude/` and `.cursor/` | Wiring that points agents at uxagent's skills | uxagent (`npx uxagent sync`) |
| `node_modules/uxagent/` | The skills, reference docs, and the checks themselves | Updates to uxagent |

Because the skills and checks stay in the package, updating them never touches your
design system or your code.

## Updating

```bash
npm update uxagent
```

```bash
npx uxagent sync
```

Then run `/ux-setup` to pick up anything new.

## Making it yours

- **Skip a skill:** set it to `false` under `skills` in `ux/config.json`, then run
  `npx uxagent sync`.
- **Change a skill:** `npx uxagent eject <skill>` copies it into `ux/overrides/`, where
  it is yours to edit. `npx uxagent restore <skill>` goes back to the packaged one.
- **Use your own skill instead:** if your repo already has a skill with the same name
  (your own `/pr`, say), uxagent leaves it in place and doesn't install its own.
- **Turn off a whole area:** `modules` in `ux/config.json` (tokens, validator, dev-only
  pages, Figma, component catalog, export, repo conventions).

## Commands

| Command | What it does |
| --- | --- |
| `npx uxagent init` | Sets up a repo. Safe to rerun. |
| `npx uxagent sync` | Refreshes uxagent's wiring after an update or a config change. `--check` only reports. |
| `npx uxagent doctor` | Checks the install is whole and current. |
| `npx uxagent validate` | Checks the code against the design system. `--strict` fails on any finding. |
| `npx uxagent setup` | Reports setup progress. `/ux-setup` uses this. |
| `npx uxagent export …` | Packages the design system for other AI tools. `/export-design-md` and the `design-system-export` skill use this. |
| `npx uxagent eject <skill>` / `restore <skill>` | Takes over a packaged skill, or gives it back. |

Needs Node 22.22 or later.

## Working on uxagent

See [`AGENTS.md`](AGENTS.md) and [`docs/architecture.md`](docs/architecture.md).
