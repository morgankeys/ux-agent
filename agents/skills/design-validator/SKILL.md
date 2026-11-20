---
name: design-validator
description: Set up the design-system validator in the project and wire the validate role. The validator ships in uxagent and runs as `npx uxagent validate`; this skill checks what it needs, fills in the `validate` settings in ux/config.json (global stylesheet, token files, manifest, component file types), runs it, settles the first findings, wires the command and CI, and records the setup in ux/architecture.md. Use when the user invokes /design-validator, when /ux-setup reaches the ds-validator item, when validate has no real command yet, or when the validator needs settings for a new framework or file type.
---

# /design-validator

Sets up `validate` in a project: the design-system validator that writes the deviations
backlog and fails on scoping errors. The rules it implements are the contract in
[`design-in-code.md`](../../reference/design-in-code.md#validator-contract); this skill
holds the setup steps only.

The validator is part of uxagent. Nothing is copied into the project and no dependencies
are added to it: it runs with `npx uxagent validate` and is configured by the `validate`
key of `ux/config.json`. Safe to rerun.

**Read [`guiding-users.md`](../../context/guiding-users.md) before you start.** All of
this is agent work. The user's part is two decisions at most, both in step 3: which styles
are meant to be global, and any exemption. Ask them in design terms.

## What it reads

- **Settings:** `validate` in `ux/config.json`. Every path is relative to the project root.
- **The token usage map:** `design-system/token-usage.json`. Its `namespace` is the token
  prefix (`--<namespace>-`); `validate.namespace` overrides it if ever needed.
- **The token manifest** that `tokens` writes, named by `validate.manifest`. Optional.
- **Writes:** `design-system/deviations-backlog.md`.

It handles Svelte, Vue, and Astro components, CSS modules, and plain stylesheets that
scope with `@scope`. It runs on Node 22.22 or later as a dev tool, whatever the stack.

## Steps

### 1. Check what it needs

- **The source folder** (`paths.source` in `ux/config.json`, default `src/`) holds the
  styles and components. If `ux/architecture.md` doesn't record the stack yet, finish the
  `stack-choice` item in the [setup checklist](../ux-setup/checklist.md) first.
- **The token namespace** recorded as `namespace` in `design-system/token-usage.json`.
  The validator refuses to run while it is still `<prefix>`.
- **The token pipeline** (`tokens-pipeline`), so the generated token CSS and the token
  manifest exist. Without the manifest the validator still runs, with Figma scope checks
  off, and says so.
- **Existing settings.** If `validate` in `ux/config.json` already has values, keep them
  and fill in only what is missing.

### 2. Fill in `validate`

Edit the `validate` key in `ux/config.json`:

| Key | Set it to |
| --- | --- |
| `include` | Where styles live: component files and stylesheets. Defaults to the source folder's `.css`, `.svelte`, `.vue`, and `.astro` files. |
| `ignore` | Build output and anything generated besides tokens. Defaults to `**/node_modules/**`. |
| `tokenFiles` | The generated token CSS from `tokens`. Never scanned. |
| `manifest` | The token manifest `tokens` writes. |
| `globalStylesheets` | The one global stylesheet. If the project has none yet, create a minimal one (element defaults and type settings only) and load it once at the root. |
| `allowedVariables` | CSS variables a framework or tool sets itself, such as `--tw-*`. |
| `componentExtensions` | Component file types beyond `.svelte`, `.vue`, and `.astro`: map an extension to the framework whose `<style>` rules it follows, for example `{ ".mdx": "vue" }`. Add the extension to `include` too. |

Leave `allowedGlobalClasses`, `allowedValues`, and `exemptions` empty unless step 3 fills
them.

### 3. Run it and settle the first findings

Run `npx uxagent validate`.

- **Scoping errors** fail the run. Fix each by moving the style to its home ("Fixing a
  scoping error" in
  [Scoping: global or component](../../reference/design-in-code.md#scoping-global-or-component)).
  When it is unclear whether a style should apply everywhere, ask the user, in their
  terms: "Should this heading style apply on every page, or only in the card?" A utility
  class that really is for use anywhere goes in `allowedGlobalClasses` only once the
  design-system owner agrees.
- **Deviations** go to the backlog. Work through it as
  ["Working a deviation"](../../reference/design-in-code.md#working-a-deviation)
  says: use a token where one fits, otherwise write your best guess on each `Rationale:`
  line.
- **Exemptions** are for files that must break a deviation rule on purpose, such as one
  that defines primitives the export lacks. Each needs `why`, and the owner agrees first.
  Scoping errors can't be exempted.
- **A warning about a usage-map group** that matches no token means the map is out of
  date; tell the owner, don't edit the map to silence it.

### 4. Wire the role

- Set `commands.validate` in `ux/config.json` to the command that runs it, normally
  `npx uxagent validate`.
- If the project has a manifest with scripts (`package.json` or the stack's equivalent),
  add a `validate` script that runs the same command; `--strict` passes through.
- CI: if the project uses uxagent's CI skeleton, its `validate` step runs the `validate`
  role command; check that it does. If the project has its own CI, add a step that runs the
  role command without `--strict`, then `git diff --exit-code` so a stale backlog fails.
- Commit `design-system/deviations-backlog.md`.

### 5. Record it

In `ux/architecture.md`:

- **Validation:** that the validator runs from uxagent and is configured by `validate` in
  `ux/config.json`; which component file types it reads; where the manifest is; any
  exemptions and why.
- **Styling Rules:** which file is the global stylesheet, and that the allowed global
  classes list is `allowedGlobalClasses` in `validate`.

Done when the `ds-validator` item in the [setup checklist](../ux-setup/checklist.md) says so.

## Editor hints (optional)

The same rules can show in the editor while the user types. In a Stylelint config the
editor's extension reads, import the validator's config from uxagent:

```js
import { designSystemConfig } from 'uxagent/stylelint';
export default designSystemConfig({ extends: ['./stylelint.config.mjs'] });
```

Set `extends` to the project's own Stylelint config so the editor keeps showing `lint`'s
errors too. The project root is found from the current folder; pass `root` to name it.
Pointing the editor at this file is covered by [`/editor-setup`](../editor-setup/SKILL.md).
`lint` never loads it.

## Limits

- **Other frameworks.** A component file type that is not Svelte, Vue, or Astro is read
  only if its `<style>` blocks follow one of those three frameworks' scoping rules; map it
  with `componentExtensions`. A framework with different rules is not supported yet; open
  an issue on uxagent and note it in `ux/architecture.md`.
- **CSS-in-JS** is not CSS Stylelint can read without a custom syntax, and the validator
  does not check it.
- **Utility classes written in markup** (Tailwind and the like) are not CSS the validator
  sees. Say so in `ux/architecture.md` rather than implying they are checked.
