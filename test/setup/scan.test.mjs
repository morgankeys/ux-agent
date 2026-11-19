// The setup scan reads the checklist the way the checklist is written, and the checklist
// agrees with the seeded templates. Projects are built in temp folders.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { initialConfig } from '../../src/config/defaults.mjs';
import { KNOWN_MODULES, parseChecklist } from '../../src/setup/scan.mjs';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BIN = path.join(PKG, 'bin/uxagent.mjs');
const { items, stubs } = parseChecklist();
const temps = [];

after(() => temps.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

// A project with the seeded folders copied in and a config written from initialConfig().
function makeProject({ preset = 'greenfield', paths = {}, modules, figma, commands } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxagent-setup-'));
  temps.push(root);
  const config = initialConfig({ preset, paths });
  if (modules) config.modules = modules;
  if (figma !== undefined) config.figma = figma;
  if (commands) Object.assign(config.commands, commands);
  fs.mkdirSync(path.join(root, 'ux'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ux/config.json'), JSON.stringify(config, null, 2));
  fs.cpSync(path.join(PKG, 'templates/ux'), path.join(root, 'ux'), { recursive: true });
  fs.cpSync(path.join(PKG, 'templates/design-system'), path.join(root, config.paths.designSystem), { recursive: true });
  fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'templates/github/workflows/ci.yml'), path.join(root, '.github/workflows/ci.yml'));
  return root;
}

const run = (root, ...args) => {
  const result = spawnSync('node', [BIN, 'setup', ...args], { cwd: root, encoding: 'utf8' });
  return { code: result.status, out: result.stdout, err: result.stderr };
};

const statusRows = (root) => {
  const rows = new Map();
  for (const line of fs.readFileSync(path.join(root, 'ux/setup-status.md'), 'utf8').split('\n')) {
    const m = /^\| `([a-z0-9-]+)` \| ([^|]*) \|([^|]*)\|([^|]*)\|/.exec(line);
    if (m) rows.set(m[1], { status: m[2].trim(), notes: m[4].trim() });
  }
  return rows;
};

// Where a checklist stub's file lives in templates/.
const templateFile = (where) => {
  if (where.startsWith('.github/')) return path.join(PKG, 'templates/github', where.slice('.github/'.length));
  return path.join(PKG, 'templates', where);
};

describe('the checklist', () => {
  test('parses into items and stubs', () => {
    assert.ok(items.length > 30, `only ${items.length} items`);
    assert.ok(stubs.length > 30, `only ${stubs.length} stubs`);
  });

  test('every item has a known module, and the module is one the config knows', () => {
    for (const item of items) assert.ok(KNOWN_MODULES.includes(item.module), `${item.id}: ${item.module}`);
    assert.deepEqual(new Set(KNOWN_MODULES), new Set(['core', 'tokens', 'validator', 'dev-pages', 'figma', 'catalog', 'export', 'repo']));
  });

  test('every need names a known item', () => {
    const ids = new Set(items.map((item) => item.id));
    for (const item of items) for (const need of item.needs) assert.ok(ids.has(need), `${item.id} needs unknown ${need}`);
  });

  test('every stub points at a known item', () => {
    const ids = new Set(items.map((item) => item.id));
    for (const stub of stubs) assert.ok(ids.has(stub.item), `${stub.id} -> ${stub.item}`);
  });

  test('config stubs name a real config key', () => {
    const config = initialConfig();
    for (const stub of stubs.filter((s) => s.kind === 'config')) {
      const value = stub.where.split('.').reduce((v, key) => v?.[key], config);
      assert.notEqual(value, undefined, `${stub.id}: ${stub.where}`);
    }
  });

  test('uses no pre-package paths or words', () => {
    const text = fs.readFileSync(path.join(PKG, 'agents/skills/ux-setup/checklist.md'), 'utf8');
    for (const old of ['Code/', 'Docs/', 'Agents/', 'prototype', 'template-only', 'new-prototype']) {
      assert.ok(!text.includes(old), `checklist still mentions ${old}`);
    }
  });

  test('every file stub marker is present in the seeded template', () => {
    const missing = [];
    for (const stub of stubs.filter((s) => s.kind === 'file')) {
      const file = templateFile(stub.where);
      if (!fs.existsSync(file) || !fs.readFileSync(file, 'utf8').includes(stub.marker)) {
        missing.push(`${stub.id}: ${stub.marker} in ${stub.where}`);
      }
    }
    assert.deepEqual(missing, [], `markers missing from templates/:\n${missing.join('\n')}`);
  });
});

describe('npx uxagent setup', () => {
  test('scans a fresh greenfield project', () => {
    const root = makeProject();
    const { code, out } = run(root);
    assert.equal(code, 0);
    assert.match(out, /Modules off: none/);
    assert.match(out, /Figma: undecided/);
    assert.match(out, new RegExp(`${items.length} checklist items, none tracked yet`));
    assert.match(out, /open  stub-figma-site  config figma\.site/);
    assert.match(out, /open  stub-cmd-dev  config commands\.dev/);
    const summary = /(\d+) open, (\d+) filled, (\d+) file gone, (\d+) n\/a \(of (\d+)\)/.exec(out);
    assert.ok(summary, 'no stub summary');
    assert.equal(Number(summary[5]), stubs.length);
    assert.equal(summary.slice(1, 5).reduce((a, n) => a + Number(n), 0), stubs.length);
  });

  test('scan is read-only', () => {
    const root = makeProject();
    run(root);
    assert.ok(!fs.existsSync(path.join(root, 'ux/setup-status.md')));
  });

  test('--sync writes one row per item, and rerunning changes nothing', () => {
    const root = makeProject();
    assert.equal(run(root, '--sync').code, 0);
    const rows = statusRows(root);
    assert.deepEqual([...rows.keys()], items.map((item) => item.id));
    for (const row of rows.values()) assert.equal(row.status, 'todo');
    const before = fs.readFileSync(path.join(root, 'ux/setup-status.md'), 'utf8');
    assert.match(run(root, '--sync').out, /already has a row for every checklist item/);
    assert.equal(fs.readFileSync(path.join(root, 'ux/setup-status.md'), 'utf8'), before);
  });

  test('--sync adds only missing rows and keeps edits', () => {
    const root = makeProject();
    run(root, '--sync');
    const file = path.join(root, 'ux/setup-status.md');
    let text = fs.readFileSync(file, 'utf8');
    text = text.replace('| `stack-ci` | todo | | |\n', '').replace('| `project-install` | todo | | |', '| `project-install` | done | 2026-01-01 | ok |');
    fs.writeFileSync(file, text + '\nA note below the table.\n');
    const { out } = run(root, '--sync');
    assert.match(out, /Added 1 rows .*stack-ci/);
    const rows = statusRows(root);
    assert.equal(rows.get('project-install').status, 'done');
    assert.equal(rows.size, items.length);
    assert.match(fs.readFileSync(file, 'utf8'), /A note below the table\./);
  });

  test('items of a disabled module are n/a, with the reason', () => {
    const root = makeProject({ preset: 'existing', modules: { export: false, catalog: false } });
    assert.match(run(root).out, /Modules off: .*repo/);
    run(root, '--sync');
    const rows = statusRows(root);
    for (const item of items) {
      const off = ['repo', 'export', 'catalog'].includes(item.module);
      if (off) {
        assert.equal(rows.get(item.id).status, 'n/a', item.id);
        assert.match(rows.get(item.id).notes, new RegExp(`module \`${item.module}\` is off`));
      } else {
        assert.equal(rows.get(item.id).status, 'todo', item.id);
      }
    }
    assert.equal(rows.get('stack-ci').status, 'n/a');
    assert.equal(rows.get('repo-suggestions').status, 'todo');
  });

  test('stubs of a disabled module are not open', () => {
    const root = makeProject({ preset: 'existing' });
    const { out } = run(root);
    assert.doesNotMatch(out, /open  stub-ci /);
    assert.doesNotMatch(out, /open  stub-cmd-lint /);
    assert.match(out, /open  stub-cmd-dev /);
  });

  test('figma: false makes every figma item n/a and closes the figma stubs', () => {
    const root = makeProject({ figma: false });
    const { out } = run(root);
    assert.match(out, /Figma: not used/);
    assert.doesNotMatch(out, /open  stub-figma-/);
    assert.doesNotMatch(out, /open  stub-registry-row/);
    run(root, '--sync');
    const rows = statusRows(root);
    for (const item of items.filter((i) => i.module === 'figma')) {
      assert.equal(rows.get(item.id).status, 'n/a', item.id);
      assert.equal(rows.get(item.id).notes, 'Figma is not used');
    }
    assert.equal(rows.get('project-figma').status, 'todo');
  });

  test('a config stub closes when its command is set or n/a', () => {
    const root = makeProject({ commands: { dev: 'npm run dev', check: 'n/a' } });
    const { out } = run(root);
    assert.doesNotMatch(out, /open  stub-cmd-dev /);
    assert.doesNotMatch(out, /open  stub-cmd-check /);
    assert.match(out, /open  stub-cmd-build /);
  });

  test('a file stub closes when its marker is gone, and a missing file is not open', () => {
    const root = makeProject();
    const color = path.join(root, 'design-system/guidelines/color.md');
    fs.writeFileSync(color, fs.readFileSync(color, 'utf8').replaceAll('- **Do** …', '- **Do** use the primary role.'));
    fs.rmSync(path.join(root, 'design-system/guidelines/motion.md'));
    const { out } = run(root);
    assert.doesNotMatch(out, /open  stub-guideline-color /);
    assert.doesNotMatch(out, /open  stub-guideline-motion /);
    assert.match(out, /stub-guideline-motion  design-system\/guidelines\/motion\.md/);
    assert.match(out, /open  stub-guideline-layout /);
  });

  test('a non-default paths.designSystem is honoured', () => {
    const root = makeProject({ paths: { designSystem: 'docs/ds' } });
    assert.ok(!fs.existsSync(path.join(root, 'design-system')));
    const { out } = run(root);
    assert.match(out, /open  stub-guideline-color  docs\/ds\/guidelines\/color\.md:/);
    assert.match(out, /open  stub-namespace-map  docs\/ds\/token-usage\.json:/);
    assert.match(out, /, 0 file gone,/);
    run(root, '--sync');
    assert.equal(statusRows(root).size, items.length);
  });

  test('rows that should be n/a are reported', () => {
    const root = makeProject({ preset: 'existing' });
    run(root, '--sync');
    const file = path.join(root, 'ux/setup-status.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\| `stack-ci` \| n\/a \|[^\n]*/, '| `stack-ci` | todo | | |'));
    assert.match(run(root).out, /Rows that should be n\/a: stack-ci \(module `repo` is off\)/);
  });

  test('outside a project it fails with a hint', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxagent-none-'));
    temps.push(dir);
    const result = spawnSync('node', [BIN, 'setup'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /npx uxagent init/);
  });

  test('an unknown argument is an error', () => {
    const root = makeProject();
    const result = run(root, '--bogus');
    assert.equal(result.code, 1);
    assert.match(result.err, /unknown argument/);
  });
});
