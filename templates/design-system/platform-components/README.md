# Component ports

Ports of the project's components for the platform export. The `design-system-export` skill
writes them, one per component listed in `guidelines/components.md` whose code path exists,
and records them in `manifest.json` here. `npx uxagent export platforms` packages the ports
that pass its checks.

Until then this folder has no manifest and the export ships tokens and guidelines only.
Don't add a component that isn't in the registry.
