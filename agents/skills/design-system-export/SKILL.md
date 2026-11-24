---
name: design-system-export
description: >-
  Export the project's design system into packages for Lovable, Replit,
  Bolt.new, v0, and Figma Make. Use when asked to export or share the design
  system, or to package the project's components for those platforms.
---

# Design-system export

The design system lives in `design-system/`. This skill publishes it for other
prototyping platforms. The project's code is not the source of tokens or guidelines. It is
checked only for component implementations the inventory already lists.

Two pieces:

- **Command** — deterministic. Reads `design-system/`, writes
  `design-system/exports/platforms/<target>/`. `npx uxagent export platforms` runs it with
  no agent in the loop. It is the only writer of that folder.
- **This skill** — the front door. It always runs the command. When the inventory points
  at a component that exists in the project, it ports the markup and runs the command
  again so those components are attached.

`/export-design-md` remains the only writer of `design-system/exports/DESIGN.md`. Both
read `design-system/` through the same code.

Platform intake and import steps:
[`design-system-platforms.md`](../../context/design-system-platforms.md) and
[`design-system-platform-packages.md`](../../context/design-system-platform-packages.md).

## Run the Docs export

From the project root (Node 22 or newer):

```bash
npx uxagent export platforms
```

```bash
npx uxagent export platforms lovable v0
```

```bash
npx uxagent export platforms --list
```

Exit code 3 means every guideline is still a stub and there are no tokens. Stop and name
the files to fill in. Do not invent a sample system.

The command writes token CSS from the token JSON. Opaque colors stay hex. A Figma color
with `alpha` below 1 is emitted as `rgb(r g b / a)`, because `hex` is RGB only. Modes
found in the token JSON use `:root` for the default mode and
`:root[data-mode="<id>"]` for the others. The id is the mode's name, not a selector
copied from the project's own CSS.

shadcn and Tailwind name mappings are not guessed. Exports speak in the system's own
token names.

Output goes to `design-system/exports/platforms/` (`--out <dir>` writes elsewhere). It is generated and git-ignored. Do not hand-edit it.

## Port components, when they exist

Skip this whole section when the inventory has nothing to port. The Docs export is
complete without it.

```bash
npx uxagent export inventory
```

That prints each real row of the component registry
(`design-system/guidelines/components.md`). Placeholder rows are omitted.

- **present** — the code path exists. You may port it.
- **missing** or **no code path** — skip it.
- A project file that is not in the inventory — leave it out.

For each present row:

1. Read the source. List the contract:

   ```bash
   npx uxagent export port-report path/from/the/inventory
   ```

2. Write a React port at `design-system/platform-components/<Name>.tsx`.
   Match the source class names and `data-*` attributes exactly. Use a default export.
   Put lifted styles in a sibling `.css` file if the source has a style block, and import
   it from the port. Do not restyle. Do not rename tokens. Do not add colors, sizes, or
   radii as raw values. Do not use inline styles.

3. Add the row to `design-system/platform-components/manifest.json`:

   ```json
   {
     "components": [
       {
         "name": "Button",
         "source": "path/from/the/inventory",
         "file": "Button.tsx",
         "css": "Button.css",
         "summary": "One line from the inventory notes."
       }
     ]
   }
   ```

   `source` must match the inventory's code path (relative to the project root). `css` is optional.

4. Run the export again. The command checks each port: the name is in the inventory, the
   source exists, class names and data attributes match, there is a default export, and
   the port has no inline style or hardcoded color. A port that fails is skipped and
   named. The Docs package is still written. Fix the port and run again.

Commit the manifest and the ports with the export change so a later
`npx uxagent export platforms` can package them without porting again. Re-port when the source markup or its props change.
A styles-only change in the project is picked up on the next port; the command does not read
component source on its own.

When a manifest validates, Lovable gains a project zip, Replit gains component source
under the skill's `assets/`, and Bolt, v0, and Figma Make gain a source package. v0's
registry lists those components and does not invent a shadcn theme.

## Verify

On a project that has tokens or filled guidelines, run the export and read the warnings.
`design-system/exports/platforms/design-md/README.md` points at
`design-system/exports/DESIGN.md`; it does not contain a second copy. Lovable's `instructions.md` and Bolt's `project-prompt.md` must
stay at or under 10,000 characters. The command exits 1 when they do not.

```bash
npx uxagent export platforms --self-test
```

That runs against a temporary project, not this project's `design-system/`.
