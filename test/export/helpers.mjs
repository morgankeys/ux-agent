import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../../bin/uxagent.mjs', import.meta.url));

export function tempProject(t, { designSystem = 'design-system' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxagent-export-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'ux/config.json', JSON.stringify({ version: 1, preset: 'greenfield', paths: { designSystem, source: 'src' } }, null, 2));
  write(root, `${designSystem}/guidelines/overview.md`, '# Overview\n\n## Summary\n\nA calm product UI for reading long articles.\n\n## Principles\n\n1. **Quiet** — chrome recedes so the text leads.\n');
  write(root, `${designSystem}/guidelines/components.md`, '# Components\n\n## Inventory\n\n| Component | Figma | Code |\n| --- | --- | --- |\n| Button | | src/Button.vue |\n');
  write(root, `${designSystem}/figma/tokens/unpacked/Color/modes.tokens.json`, JSON.stringify({
    color: { primary: { $type: 'color', $value: { hex: '#112233', alpha: 1, components: { red: 0.07, green: 0.13, blue: 0.2 } } } },
  }));
  write(root, 'src/Button.vue', '<button class="btn" data-kind="primary">Go</button>\n');
  return root;
}

export function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// Runs `uxagent export <args>` from `cwd`.
export function run(cwd, args) {
  const r = spawnSync(process.execPath, [BIN, 'export', ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
