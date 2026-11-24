# Review ux and design-system for drift against the code

Find places where `ux/`, `design-system/`, and anything in `ux/context/` no longer describe
what the project's code actually does, and fix the docs.

## Goal

Every claim in the project's `ux/` and `design-system/` docs matches the code as it is
today.

## Inputs

- `<scope>`: the whole repo, or a folder or topic to focus on (e.g. "token pipeline").

## Steps

1. Load [`repo-structure.md`](../context/repo-structure.md) and the project's `AGENTS.md`
   for orientation.
2. Read `ux/architecture.md` and `commands` in `ux/config.json`. For every command, path,
   script name, and rule they state, confirm it exists in the project and behaves as
   described. Confirm each path in `ux/config.json` (including those under `validate`)
   exists.
3. Do the same for each file in `ux/context/` and each project-owned entry in the
   `AGENTS.md` routing table that touches `<scope>`, plus the `.cursor/rules/*.mdc` globs
   (do they still match real paths?).
4. Check the component registry in `design-system/guidelines/components.md` against the
   project's code: every component has a row, and every Story and Code Connect `✓` has a
   file behind it.
5. Check that each project rule or fact is stated in one place and linked from the others:
   facts in `ux/architecture.md` and `design-system/`, learned conventions in
   `ux/context/`. Do not restate what the packaged context, skills, or reference already
   say; link to it. Entry points (`README.md`, guideline files, `.cursor/rules/`) may keep
   a one-line reminder plus a link. Replace any fuller restatement with a link.
6. Run `npx uxagent doctor`. Every stub in `.claude/skills/`, `.cursor/skills/`, and
   `.cursor/rules/` should point at a file that exists; if one does not, run
   `npx uxagent sync` rather than editing it by hand.
7. Run `npx uxagent setup` and check `ux/setup-status.md` against the project; refresh it
   with `npx uxagent setup --sync`.
8. Fix the docs, not the code, unless the code is plainly wrong; if it is, report it
   instead of changing it in this task.
9. If the project uses uxagent's git workflow, commit per
   [`git-workflow.md`](../context/git-workflow.md) (type `docs`), then push the feature
   branch. Do not open a pull request unless asked.

## Done when

- Each drift found is either fixed or listed in your reply with why it was left.
- No routing-table row, rule glob, or stub points at a missing file.
- `npx uxagent doctor` is clean.
- No rule or tool fact is stated in full in more than one place.
