# Figma

Drop zone for design-tool imports. Figma is the default: treat these files as a mirror of
Figma, and re-export when the source changes rather than editing here. Tokens from this
repo, another repository, or another design tool can land in the same place when they use
the same export shape.

- [`tokens/`](tokens/) — variables exports (`.zip`) and their unpacked JSON. Procedure:
  the `design-tokens` skill.
- [`assets/`](assets/) — assets exported from Figma: mockups, images, icons, and so on.

Tokens or assets that don't come from Figma go in [`../supplemental/`](../supplemental/).
