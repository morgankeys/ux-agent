# Design system conventions

Durable styling and component conventions for the project's UI. Load this before editing
components, styles, or anything that renders UI. Stack-specific detail, including how this
project scopes styles, is in `ux/architecture.md`.

For the token pipeline — how token CSS is generated, and the alpha transform — see
[`design-tokens`](../skills/design-tokens/SKILL.md). Figma is the default source. The same
pipeline applies when tokens are maintained in this repo, another repository, or another
design tool: they still land in the folders below, and generated token CSS is what
components use.

## Figma sources

Where the project's Figma files are recorded is `figma` in `ux/config.json`:

- `site`: the Figma file with the pages and features to implement.
- `library`: the Figma file with the core styles; tokens are exported from here.
- `false`: the project doesn't use Figma.

A `null` link is undecided; ask the user rather than guessing. The same links, for humans,
are in `design-system/README.md`. If tokens come from this repo, another repository, or
another design tool, `design-system/README.md` says so and points at where they are
maintained.

When `figma` is `false`, agents and `/component-catalog` skip Figma-only steps, such as
Code Connect, for good (see [`component-catalog.md`](component-catalog.md#not-using-figma)).

## Where design-system sources live

All under `design-system/`:

- `figma/tokens/` — Figma variables exports and their unpacked JSON (input to `tokens`).
- `figma/assets/` — mockups, images, and icons exported from Figma.
- `supplemental/` — tokens and assets that aren't Figma variables (from production code,
  hand-maintained, …). Check here before concluding a value has no token.
- `guidelines/` — written patterns and guidelines that tokens don't capture, one file per
  topic (color, typography, layout, components, …). Load only the files your task needs;
  `guidelines/README.md` lists each one and when to read it. Read `components.md` before
  building UI, so you reuse a component instead of recreating it.

`design-system/exports/DESIGN.md` is a generated, portable summary of all this for other AI tools. Don't
read it as a source or edit it; regenerate it with `/export-design-md` after changing
guidelines or tokens.

When a guideline and a token disagree on a value, the token wins. Guidelines say when and
why to use a token; they don't restate its value.

## Styling rules

**Scoped styles only.** Component styling lives in the component's own scoped styles, the
way this project scopes them (`ux/architecture.md`). No inline styles, and no global CSS
outside the minimal global stylesheet and the generated token files.

**Global or component, never both.** Before writing a style, decide which it is. Global
means it should apply everywhere (element defaults, type settings, resets); it goes in the
global stylesheet as an element rule. Anything that targets one component goes in that
component's own scoped styles, and an escape to global scope (`:global()` and the like) stays
nested under the component's own selector. `validate` fails on a style in the wrong place.
When it is unclear whether a style should apply everywhere, ask the user. The rules, and
the allowed global classes list for the few true utilities:
["Scoping: global or component"](../reference/design-in-code.md#scoping-global-or-component).

**Token variables only.** Every themed property uses a CSS custom property from the
generated token files, under the project's namespace `--<prefix>-*` (`namespace` in
`design-system/token-usage.json`; `design-system/README.md` describes the system):

- **Color**: `--<prefix>-color-*`, including state-layer overlays
- **Typography**: font family, size, weight, line-height, letter-spacing
- **Shape**: border radius
- **Spacing**: margin, padding, gap

The token groups are listed in `design-system/token-usage.json`.

**Discovering variable names: grep the generated CSS, never guess.** Search the generated
token files for a likely name and confirm it exists before using it. If they are gitignored,
run `tokens` first on a fresh clone.

**Never hand-edit generated token CSS.** Change the transform and rerun `tokens`.

**Use each token for what it is for.** A token that exists is not automatically the right
one. Before picking a token, read its intent: the `description` in the token manifest, its
group's `intent` in `design-system/token-usage.json`, and the matching `design-system/guidelines/`
file. `validate` flags a token in the wrong property, selector, or pairing; the
[`token-usage-review`](../skills/token-usage-review/SKILL.md) skill covers meaning that no
rule can check. Run it before opening a pull request that changes styles. The contract is
under "Token usage" in
[`design-in-code.md`](../reference/design-in-code.md#token-usage).

## Handling deviations

`validate` is the only check that reports design-system findings; `lint` is technical
only ([Validation and linting](../reference/design-in-code.md#validation-and-linting)).
When `validate` flags a hardcoded value or a misused token, follow
["Working a deviation"](../reference/design-in-code.md#working-a-deviation):
use a token if one fits, otherwise leave the deviation in the backlog with a `Rationale:`
line. Never weaken a rule or widen the token usage map to clear a finding.

**Run `validate` after styling changes** and review the backlog diff before committing.

## Component variants

Variant axes are exposed as `data-*` attributes on the component root, not as
component-local custom properties (which the validator flags as outside the token
namespace). Each combination is an explicit attribute-selector rule, for example
`.icon-button[data-size="sm"] .icon-button__container`.

Every primitive carries `data-component="<Name>"` plus one `data-<axis>` per variant
dimension (`data-variant`, `data-size`, and so on). Because these attributes are the
styling hooks, they cannot drift from what is rendered. In DevTools,
`$$('[data-component="<Name>"]')` lists every instance.

## References

- [`design-tokens`](../skills/design-tokens/SKILL.md) — token
  regeneration workflow and the alpha gotcha
- [`troubleshooting/rounded-clipping.md`](troubleshooting/rounded-clipping.md) — clipping
  and layering rounded surfaces without edge fringes
- [`token-usage-review`](../skills/token-usage-review/SKILL.md) —
  agent review of whether tokens are used for their intended purpose
- [`design-in-code.md`](../reference/design-in-code.md) — principles, validator contract,
  token usage checks, deviations backlog
- `ux/architecture.md` — how this project's stack implements it
