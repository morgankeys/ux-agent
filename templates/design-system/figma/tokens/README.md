# Figma tokens

Drop zone for token exports. The default is a Figma variables export (`.zip`), one zip per
collection. The `tokens` command unpacks each zip into its own folder under `unpacked/`,
which is tracked in git so token changes are reviewable in pull requests.

Procedure: the `design-tokens` skill. The `tokens` command for this project is set in
`commands` in `ux/config.json`.
