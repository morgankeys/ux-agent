// Optional: the validator's rules for the editor's Stylelint extension, so design-system
// findings show while editing. Exported as `uxagent/stylelint`. In the project's own
// Stylelint config for the editor (in VS Code, point `stylelint.configFile` at it):
//
//   import { designSystemConfig } from 'uxagent/stylelint';
//   export default designSystemConfig({ extends: ['./stylelint.config.mjs'] });
//
// `extends` keeps the editor showing `lint`'s CSS errors too: set it to lint's config
// file. The project root is found from the current folder (the nearest `ux/config.json`);
// pass `root` to name it. `lint` never uses this, and `validate` builds the same config
// itself. See /editor-setup.
import { findRoot } from '../config/load.mjs';
import { designSystemConfig } from './stylelint-config.mjs';

export { designSystemConfig };

// With no options: the design-system rules alone. Outside a uxagent project it is empty.
export default findRoot() ? designSystemConfig() : {};
