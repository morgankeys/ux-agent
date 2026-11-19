import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function tempRepo(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxagent-install-'));
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
  return root;
}

export function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
export const exists = (root, rel) => fs.existsSync(path.join(root, rel));
export const readJson = (root, rel) => JSON.parse(read(root, rel));

export function setConfig(root, mutate) {
  const config = readJson(root, 'ux/config.json');
  mutate(config);
  write(root, 'ux/config.json', `${JSON.stringify(config, null, 2)}\n`);
}

// Collects log lines instead of printing them.
export function logger() {
  const lines = [];
  const log = (line = '') => lines.push(line);
  log.text = () => lines.join('\n');
  return log;
}

// Every file in the repo with its content, for comparing two states.
export function snapshot(root) {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(root, full)] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(root);
  return out;
}
