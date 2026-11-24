---
name: export-design-md
description: >-
  Generate a portable DESIGN.md from the design system's guidelines and tokens, then lint it with Google's DESIGN.md linter. Use when the user invokes /export-design-md, asks for a DESIGN.md to drop into another AI tool (Lovable, Figma Make, Stitch, v0), or after a change to the design-system guidelines or tokens when design-system/exports/DESIGN.md already exists.
---

# /export-design-md

Builds `design-system/exports/DESIGN.md`, a portable, single-file summary of this
project's design system in Google's [DESIGN.md](https://github.com/google-labs-code/design.md)
format. It is meant to be dropped into other AI tools for fast, exploratory prototyping.
The project stays the source of truth: the export is always generated from
`design-system/`, never edited by hand.

Commands below run from the project root. The helpers are `npx uxagent export design-md
collect` and `npx uxagent export design-md lint [file]`; the linter is fetched with `npx` at
a pinned version.

## What goes in, what stays out

- **In:** brand and principles, color, typography, layout and spacing, elevation, shape,
  motion, accessibility, and voice — whatever in `design-system/guidelines/` is actually filled in —
  plus token values from `design-system/figma/tokens/` and `design-system/supplemental/`.
- **Out:** components, and everything specific to this project: file paths, commands, lint
  rules, validation, git workflow, the deviations backlog. The export must make sense to a
  tool that has never seen this project.

## Steps

### 1. Collect the sources

```bash
npx uxagent export design-md collect
```

Prints one bundle: each filled guideline (stub placeholders, comments, and project-only
sections already stripped), every token flattened to `path | type | value` with alpha kept
as 8-digit hex, and the marker line to use. This bundle is the **only** input; don't pull
in anything else.

Exit code 3 means every guideline is a stub and there are no tokens. Stop and tell the
user there is nothing to export yet, and which files to fill in first.

### 2. Write `design-system/exports/DESIGN.md`

Overwrite the file each time; never patch the previous export.

**Front matter (tokens).** Normative values, taken only from the token digest:

- `version: alpha`, `name` (the product or system name from the overview), and a
  one-line `description`.
- `colors`: map the color roles in the color guideline to their token values. Name them by
  role in kebab-case (`primary`, `on-primary`, `surface`, `primary-hover`); include
  `primary`. Keep translucent tokens' alpha (8-digit hex); never flatten them to 6 digits.
- `typography`: one entry per style in the type scale (`fontFamily`, `fontSize` in px or
  rem, `fontWeight`, `lineHeight`, `letterSpacing`).
- `rounded` and `spacing`: the radius and spacing scales, with units (`8px`).
- `omitted`: always `components` (reason: portable export), plus any token group with no
  source, each with a short reason.
- No `components` key.

Leave a group out (and list it in `omitted`) rather than inventing values for it.

**Marker.** The marker line from the bundle, directly after the closing `---`.

**Body (prose).** An optional `# <name>` title, then `##` sections in this order, each
only if its source has content:

| Section | From |
| --- | --- |
| Overview | `overview.md`, plus a short voice-and-tone paragraph from `content.md` |
| Colors | `color.md` |
| Typography | `typography.md` |
| Layout | `layout.md` |
| Elevation & Depth | `elevation.md` |
| Shapes | `shape.md` |
| Motion | `motion.md` |
| Accessibility | `accessibility.md` |
| Do's and Don'ts | The Do / Don't lists from every guideline, merged and deduplicated |

Any other topic file in the bundle gets its own section before Do's and Don'ts. Write
tight prose: describe each role or style and when to use it, citing values the way the
DESIGN.md spec does (`**Primary (#2B638B):** main actions only`). Summarize; don't paste
tables of token names. Don't add guidance the sources don't contain.

### 3. Lint

```bash
npx uxagent export design-md lint
```

Runs Google's linter, then uxagent's own checks (marker present, no Components section, no
project paths). Fix every error and repo-check failure and lint again. Fix warnings that come
from your mapping (a broken reference, a missing `primary`, sections out of order). A
warning that reflects a gap in the sources, like `missing-typography` while
`typography.md` is a stub, stays: report it rather than inventing tokens. Infos need no
action.

### 4. Report

Tell the user the file path, the sections included and the ones omitted (with the stub or
missing source behind each), and any remaining lint warnings. Commit the export with the
change that prompted it, on a feature branch per [`git-workflow.md`](../../context/git-workflow.md), if the project uses uxagent's git workflow.

## Keeping it current

`design-system/exports/DESIGN.md` goes stale whenever guidelines or tokens change. When a change touches
`design-system/` and the export exists, re-run this skill in the same change, or say
that the export is now out of date.
