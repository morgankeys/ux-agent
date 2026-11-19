// Builds the design-system Stylelint config. `validate` uses it, and so can an editor
// (see editor-config.mjs, exported as `uxagent/stylelint`). `lint`'s own config never
// loads it.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRoot, loadConfig, ConfigError } from '../config/load.mjs';
import { ALL_RULES, GATE_RULES, resolveComponentExtensions } from './settings.mjs';

const pluginPath = fileURLToPath(new URL('./plugin.mjs', import.meta.url));

// `root` is the project root; when omitted it is found from the current folder.
export function designSystemConfig({ root, extends: base } = {}) {
  const projectRoot = root ? path.resolve(root) : findRoot();
  if (!projectRoot) {
    throw new ConfigError('No ux/config.json found here or in a parent folder. Run `npx uxagent init` first.');
  }
  const rules = {};
  for (const id of ALL_RULES) {
    rules[`ds/${id}`] = [true, { root: projectRoot, severity: GATE_RULES.includes(id) ? 'error' : 'warning' }];
  }
  // Component files (and HTML) carry their styles in <style> blocks, which postcss-html reads.
  const extensions = Object.keys(resolveComponentExtensions(loadConfig({ root: projectRoot }).validate))
    .map((e) => e.slice(1));
  return {
    ...(base ? { extends: base } : {}),
    plugins: [pluginPath],
    rules,
    overrides: [{ files: [`**/*.{${[...new Set([...extensions, 'html'])].join(',')}}`], customSyntax: 'postcss-html' }],
  };
}
