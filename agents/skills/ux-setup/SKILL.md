---
name: ux-setup
description: Review how far this project is set up for uxagent and walk the user through what's left, in a new repo or an existing codebase. Checks the project against the canonical setup checklist (stack, token pipeline, validator, linters, Figma tools, component catalog, unfilled stubs), records progress in ux/setup-status.md, and respects opt-outs. Use when the user invokes /ux-setup, has just installed uxagent, asks what still needs setting up or installing, wants to skip or re-enable a tool, or has updated uxagent.
---

# /ux-setup

Checks the project against the setup checklist, reports what is left, and walks the user
through it one step at a time.

Two files, kept apart on purpose:

- **[`checklist.md`](checklist.md)**: the canonical definitions: every item, who does it,
  which module it belongs to, what it needs first, and how to tell it is done. It ships
  with uxagent. Never record progress in it.
- **`ux/setup-status.md`**: this project's progress, one row per item id. This skill
  creates and maintains it; people may edit it by hand.

This file holds the steps only. What each item means is in the checklist; how to do an
item is in the skill or doc its row links to.

**Read [`guiding-users.md`](../../context/guiding-users.md) before you start.** Setup is
often a user's first hour with uxagent, and many users have not set up a codebase before.
The checklist is written for agents: its ids, levels, and role names are your working
notes, not what you say to the user. Your job is to lead them through it.

Safe to rerun at any point in a project. A run with nothing to do just reports that.

| Invocation | Does |
| --- | --- |
| `/ux-setup` | Check everything, say where things stand, then guide the user through the next step. |
| `/ux-setup status` | Check and show the full breakdown only. Change nothing but the status file. |
| `/ux-setup skip <item or tool>` | Opt out (step 5). |
| `/ux-setup include <item or tool>` | Undo an opt-out, or opt in to an `optional` item. |

## Steps

### 1. Scan

```bash
npx uxagent setup
```

It reads the checklist and the project's `ux/config.json` and prints the facts that need
no judgment: which modules are off, the Figma decision, which commands are wired, how the
status file compares with the checklist, which items do not apply and why, and every open
stub (a placeholder file with its line numbers, or a config value still `null`). Then read
[`checklist.md`](checklist.md) in full.

If the command says there is no `ux/config.json`, uxagent is not installed here yet: run
`npx uxagent init` first (it is safe to rerun), then scan again.

### 2. Sync the status file

```bash
npx uxagent setup --sync
```

Creates `ux/setup-status.md` on the first run, and afterwards adds a row for any item
the checklist has gained. Items of a module that is off start as `n/a`. It never changes
an existing row. If the scan listed rows whose item is no longer in the checklist, tell
the user and delete those rows. If it listed rows that should be `n/a` (the module was
turned off since), set them.

### 3. Evaluate every item

Go through the checklist in order and settle each row's status from the project, not from
what the row said last time:

| Status | When |
| --- | --- |
| `done` | Its "Done when" holds right now. |
| `waiting` | Something it needs isn't `done`. Name what in Notes: the item id, and the person if it is a `user` item. A need that is `n/a` or `opted out` doesn't count. |
| `todo` | Everything it needs is `done`, and it isn't. |
| `opted out` | The user said to skip it. Only this skill's step 5, or the user's own edit, sets this. |
| `n/a` | It can never apply: its module is off in `ux/config.json`, a `figma` item when `figma` is `false`, an item that needs one that is `n/a`, or a tool the stack can't use. Say why in Notes. |

Rules for the pass:

- **Recheck `done` rows.** Verify each against its "Done when" again. If it no longer
  holds, set it back to `todo` and say in the report what regressed. A stub the scan
  lists as open under a `done` item usually means this; the checklist's "Stubs" section
  says who owns each line of a shared file.
- ***Ask* items are the exception.** They can't be seen from the project. Keep a `done`
  the user already gave; ask only when the row is still `todo`, and batch those questions
  into one message.
- **Leave `opted out` alone.** Don't recheck it, and don't raise it again.
- **Prefer evidence to commands.** Read manifests, configs, and scripts first. Run a
  role's command (`lint`, `build`, `validate`, `stories-build`, `connect`) only when
  dependencies are already installed; otherwise judge from the files and say the command
  was not run. Never install anything during the check.
- **Don't guess.** If you can't tell, the row stays `todo` with the open question in
  Notes.
- **Existing codebases.** The first `validate` run may report many deviations and
  scoping errors. That is expected. Deviations go to the backlog and are never dropped;
  say plainly that working them down is gradual and not part of setup.

Write the result to `ux/setup-status.md`: Status, today's date under Checked for every
row you verified, and Notes kept to one line (what is missing, what it waits on, or why it
was skipped). Keep Notes a person wrote unless they are now wrong.

### 4. Report

Write for the user in front of you, following
[`guiding-users.md`](../../context/guiding-users.md). The default is short and guided:

1. **Where things stand**, in a sentence or two of plain words: what is working already
   and roughly how much is left. On a first run, also say in one or two sentences what
   setup will involve and that you will do the technical parts.
2. **Anything that broke** since the last run (rows that were `done` and no longer are),
   and that you will fix it.
3. **What you need from them**, if anything is theirs to do right now: the first such
   step only, with what it is for and exactly how to do it. Mention how many more of
   their steps follow, not what they are.
4. **What you will do next** yourself, described by what it gives them.
5. **One clear next move**, then wait: either their step, or "shall I go ahead?"

Offer the full breakdown; show it when the user asks, with `/ux-setup status`, or when they
have shown they are comfortable with the detail. It lists, leaving out empty groups:
their steps, steps ready for an agent, steps waiting and what unblocks them, optional
tools not yet decided, content still stubbed (as counts, such as "7 of 10 guideline files
are placeholders"), and what was skipped. Describe each item in plain words and put its id
in backticks after it. With `/ux-setup status`, stop after the breakdown.

### 5. Opt-outs

The user can skip any `default` or `optional` item, a whole group ("no Figma tools"), or a
tool by name ("skip Storybook") at any point, including in answer to the report.

- Set the row to `opted out`, with the date and the user's reason in Notes. Set the items
  that need it to `n/a`.
- A `required` item can't be skipped. Say which rule depends on it (the checklist row
  links to it) and what breaks without it. The choice of tool is still open: any
  converter, validator language, or workbench that meets the contract counts.
- Skipping Figma altogether is not a row edit: set `figma` to `false` in
  `ux/config.json`. Every `figma` item becomes `n/a`, and
  [`component-catalog.md`](../../context/component-catalog.md#not-using-figma) lists the
  placeholders that can then be deleted.
- Turning off a whole module (`modules` in `ux/config.json`) is the user's call; run
  `npx uxagent sync` afterwards so its managed files are removed, then `/ux-setup` again
  to mark its items `n/a`.
- After an opt-out, offer to delete the placeholders that piece left behind (the scan
  shows them as open stubs), so they don't read as unfilled work. Where the checklist
  item says a role becomes `n/a`, set that role to `"n/a"` in `commands`.
- `/ux-setup include <item>` sets the row back to `todo` and re-evaluates it.

### 6. Walk through what's left

Work in checklist order, one item at a time, and re-run the scan after each. Before each
one, say in a sentence what it is for; after it, say what changed.

- **Their steps (`user`):** give one action with exact directions, then wait. When they
  say it is done, verify what can be verified before marking it. If it didn't work, say
  what you see and what to try, without blame.
- **Your steps (`agent`):** say what you are about to set up and what it gives them, then
  do it by following the skill or doc the checklist row links to. Don't restate or
  improvise its procedure, and don't ask the user to run commands for you. Tokens go
  through [`design-tokens`](../design-tokens/SKILL.md); the validator through
  [`/design-validator`](../design-validator/SKILL.md); the workbench and Code Connect
  through [`/component-catalog`](../component-catalog/SKILL.md).
- **Shared steps (`both`):** these need a decision. Ask about what the user knows (what
  they are building, who will see it, whether developers will take it over), recommend
  one option with a one-line reason, and proceed with it unless they object.
- **The stack (`stack-choice`):**
  - *The project already has a stack.* Don't choose one. Read the manifest, the config
    files, and the source folder, then record what is there in `ux/architecture.md`
    (framework, language, styling approach) and set `paths.source` in `ux/config.json` if
    the code is not under `src/`. Wire the roles in `commands` to the project's own
    scripts. Don't change the stack to suit uxagent.
  - *A bare repo.* This is a choice and a scaffold. Never open with a list of frameworks:
    ask what they are building and recommend one. Scaffolders usually want an empty
    folder, so scaffold into a temporary folder and move the result in, or use the
    scaffolder's option for a non-empty folder. Either way, keep `ux/` and
    `design-system/` untouched.
- **Default tools:** don't ask about each one. Before the first install, list the default
  set in a few plain lines (what each is for), say any of them can be skipped now or
  later, and ask once whether to go ahead with all of them.
- **Optional tools:** offer each once, with what it adds and what skipping costs.
- **Required items:** set them up without asking the user to decide, and say in a
  sentence what each guards against.
- **Tools in general:** before installing one, read its entry in
  [`tooling.md`](../../reference/tooling.md) for where to get it and its gotchas. Pin
  the version. If the user would rather use a different tool for the same job, use it and
  record it in `ux/architecture.md`.
- **Secrets:** when a step needs a token (publishing Code Connect), tell the user which
  file it goes in (`.env` at the project root). Never ask them to paste it into the chat.
- **Branches and commits:** if the `repo` module is on, follow
  [`git-workflow.md`](../../context/git-workflow.md). Use the branch the linked skill
  names (`tokens/<slug>` for the token pipeline, `chore/component-catalog` for the
  catalog), otherwise a `chore/setup-<slug>` branch per piece of work, and commit
  `ux/setup-status.md` with the change that moved its rows. Mention once that work is saved
  in steps and can be undone; don't narrate git after that. If `repo` is off, use the
  project's own branch and commit habits.
- **When a check finds problems** while you work: fix technical ones yourself; raise
  design ones with the user. The split is in the operating notes in the uxagent section
  of `AGENTS.md`. Never skip a check or switch it off to get past it.
- **Pace:** setup doesn't have to finish in one sitting. At a natural stopping point, say
  what is working now and that `/ux-setup` picks up where it left off.
- When every item an agent can do is `done`, `opted out`, or `n/a`, say so, say what the
  user can do with their project now, and list what still waits on them.

### 7. Existing codebases (the `repo` module is off)

The project's own git workflow, PR process, CI, linters, and editor config stay in charge.
uxagent's `/pr` skill is not installed, and existing skills are never replaced. Don't set
up lint, CI, or editor items; they are `n/a`.

Offer `repo-suggestions` once, after the stack and the validator are in place:

1. Read how the project works today: branching and commit habits, PR template and
   review rules, CI config, linters, editor config.
2. Compare it with uxagent's reference: [`git-workflow.md`](../../context/git-workflow.md),
   [`github.md`](../../reference/github.md), and [`/pr`](../pr/SKILL.md).
3. Offer improvements as suggestions, one at a time, each with what it adds and what it
   would change. The user accepts or declines each one. Change nothing without a yes, and
   don't raise a declined one again.
4. Always include one suggestion: add the `validate` step to the project's existing CI, so
   scoping errors fail a build. Show the exact step for their CI system before adding it.

## Updating uxagent

After `npm update uxagent` (or the project's package manager's equivalent), run
`npx uxagent sync` to refresh the managed files, then `/ux-setup`. The new checklist
arrives with the package, and any new item shows up as a new row to walk through. Existing
rows are never changed by the update.

## Notes

- **The status file is a record, not the truth.** The project is. That is why every run
  rechecks `done` rows instead of trusting them.
- **Non-negotiable rules still apply during setup.** In particular, never mark
  `tokens-alpha-guard` or `stack-dev-guard` done on the strength of a guard that was
  weakened to pass (the alpha and dev-only pages rules in the uxagent section of `AGENTS.md`).
- **Adding to the checklist:** see "Changing this checklist" at the end of
  [`checklist.md`](checklist.md). A new placeholder in a seeded file gets a stub row in the
  same change.
