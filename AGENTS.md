# AGENTS.md

This repo is **uxagent**, an npm package that installs design-system guardrails and agent
skills into any repo. You are working on the package itself, not in a project that uses
it.

Read [`docs/architecture.md`](docs/architecture.md) before changing anything. It covers
the package layout, what a project looks like after `npx uxagent init`, the three kinds of
file (managed, seeded, ejected), the config, and the rules for writing the docs that ship.

## Where things are

| Folder | What |
| --- | --- |
| `src/` | The CLI: config loader, installer (`init`, `sync`, `doctor`, `eject`), validator, exports, setup scan. |
| `agents/` | What agents in a project read: skills, context, prompts, reference. Listed in `agents/manifest.json`. |
| `templates/` | What `init` seeds into a project, and the templates `sync` renders. |
| `schema/` | The JSON schema for `ux/config.json`. |
| `test/` | `node --test` suites, and the doc checks in `test/docs/`. |

## Rules

1. **`agents/` and `templates/` describe a project, not this repo.** Their paths
   (`ux/architecture.md`, `design-system/guidelines/`) are paths in a project. Follow
   "Writing the docs" in `docs/architecture.md`.
2. **No project paths in code.** Ask `loadConfig()` (`src/config/load.mjs`).
3. **Adding, renaming, or removing a file under `agents/`** means updating
   `agents/manifest.json` in the same change.
4. **A new placeholder in a seeded file** gets a stub row in
   `agents/skills/ux-setup/checklist.md` in the same change.
5. **The validator and its contract change together** (see "Changing the validator" in
   `docs/architecture.md`).
6. **Never make `sync` overwrite a file it did not write**, and never make it rewrite a
   seeded file. Projects trust it with their repo.

## Checks

Run both before committing:

```bash
npm test
```

```bash
npm run test:docs
```

To try the package in a real project, pack it and install the tarball in a scratch repo:

```bash
npm pack
```
