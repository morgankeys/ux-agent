## uxagent

This repo uses [uxagent](https://github.com/morgankeys/ux-agent): design-system guardrails
and skills for building UI with AI agents. This section is written by `npx uxagent sync`;
don't edit it by hand. Settings are in `ux/config.json`.

- `ux/` holds the config, setup progress, `architecture.md` (how this codebase implements
  the design system), example users and organizations, and conventions this project has
  learned (`ux/context/`).
- `{{designSystem}}/` holds the design system: token sources, guidelines, the component
  registry, the token usage map, and the deviations backlog.
- The code that uses the design system is under `{{source}}/`.
- uxagent's own skills and reference docs are in `{{pkg}}/agents/`. If that folder is
  missing, install the project's dependencies first.
<!-- if:customDesignSystem -->
- uxagent's docs write `design-system/` for the design-system folder. In this repo it is
  `{{designSystem}}/`.
<!-- endif -->

Commands are named by role (`dev`, `build`, `lint`, `check`, `tokens`, `validate`, …).
`commands` in `ux/config.json` maps each role to this project's real command.

### Read before acting

Load these on demand. If your task involves the left column, read the right column first.

| If your task involves... | Read this first |
| --- | --- |
{{routes}}

### Non-negotiable rules

These apply to every task.

- **Never hand-edit generated files.** If a file's header says `GENERATED` or `do not edit
  by hand`, regenerate it with the documented command. The one carve-out: where a
  generated file reserves fields for human and agent notes, those fields are meant to be
  edited and are read back on the next run (for example, the `Rationale:` lines in the
  deviations backlog). Files uxagent manages (this section, its skill stubs, its Cursor
  rules) change through `ux/config.json` and `npx uxagent sync`.
<!-- if:validator -->
- **Never weaken lint or validation rules to suppress design-system deviations.**
  `validate` reports them. Fix the root cause or log the deviation in the backlog. Do not
  disable or loosen a rule, add an ignore comment, or widen the token usage map, in the
  validator or in any linter. When you log one, write your best guess of why on its
  rationale line; leave the "needs review" sentinel only when the reason is genuinely
  unclear.
- **Component styles are scoped and token-driven.** No inline styles, no hardcoded color,
  spacing, or radius. A style is either global (in the global stylesheet) or a
  component's (in its scoped block), never in the other's place; `validate` fails when
  one is. Never weaken that check or add to the allowed global classes list to clear it.
<!-- endif -->
<!-- if:repo -->
- **Keep tracks of work organized.** A new thread starts a new branch from an up-to-date
  `main`. Use another base only when the user specifies one, and stay on the current
  branch only when the user says to keep working on it. If the repo is already dirty with
  work this chat did not create, ask what to do and leave that work untouched. Once the
  branch for this chat is clear, commit and push without a separate ask. Never commit
  directly to `main` or `staging` unless this chat was told to work on that branch.
  Opening a pull request still waits for an ask.
<!-- endif -->
<!-- if:dev-pages -->
- **Sandbox, specimen, and sample pages never ship.** They render only on the local dev
  server. Never weaken whatever build check enforces this.
<!-- endif -->
<!-- if:tokens -->
- **The token pipeline must preserve alpha.** A translucent token must come out of the
  pipeline translucent, and the build includes a regression guard that fails when one
  doesn't. Never simplify, remove, or bypass that guard; fix the transform. Why and how:
  "the alpha gotcha" in `{{doc:skills/design-tokens/SKILL.md}}`.
<!-- endif -->

### Operating notes

- The person you are working with may be a designer who has not set up a codebase before.
  Lead them through anything they have to do themselves, in plain words, one step at a
  time, and do the technical work for them. See `{{doc:context/guiding-users.md}}`.
<!-- if:validator -->
- `validate` and the token usage review are never skipped or switched off. What happens
  to a finding depends on its kind:
  - **Technical problems** (formatting, code lint, invalid CSS, type errors, a failing
    build): fix them yourself and carry on. Tell the user only when the fix is risky: it
    could change how the product looks or behaves, removes or rewrites their work, or
    needs a decision.
  - **Design problems** (design-system deviations, token misuse) come only from `validate`
    and the token usage review, never from `lint`, and never fail CI once recorded. Fix
    the clear ones. For the rest, tell the user what was found and ask whether to fix them
    now or carry on. Either way they stay recorded in the deviations backlog or the token
    usage review file, never dropped.
  - **Scoping errors** (a style outside its global or component home) are the one design
    finding that fails `validate` and CI. Fix them before carrying on; ask the user only
    when it is unclear whether a style should apply everywhere.
<!-- endif -->
- Keep the code, `ux/`, and `{{designSystem}}/` in sync when a change spans them.
- When you learn a durable convention, record it in `ux/context/` and add a row for it to
  this file, outside this section.
