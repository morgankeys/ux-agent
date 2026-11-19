import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { loadConfig } from '../../src/config/load.mjs';
import { PKG_ROOT, VERSION, readManifest } from '../../src/install/core.mjs';
import { doctor } from '../../src/install/doctor.mjs';
import { eject, restore } from '../../src/install/eject.mjs';
import { detect, init } from '../../src/install/init.mjs';
import { sync } from '../../src/install/sync.mjs';
import { exists, logger, read, readJson, setConfig, snapshot, tempRepo, write } from './helpers.mjs';

const setUp = (root, opts = {}) => init({ root, install: false, log: logger(), ...opts });
const skills = readManifest().skills.map((s) => s.name);

test('init in a bare repo sets up everything', () => {
  const root = tempRepo();
  const log = logger();
  assert.equal(init({ root, install: false, log }).code, 0);

  const config = loadConfig({ root });
  assert.equal(config.preset, 'greenfield');
  assert.deepEqual(config.agents, ['claude', 'cursor', 'copilot', 'gemini']);
  assert.equal(config.modules.repo, true);

  for (const skill of skills) {
    assert.ok(exists(root, `.claude/skills/${skill}/SKILL.md`), `claude stub for ${skill}`);
    assert.ok(exists(root, `.cursor/skills/${skill}/SKILL.md`), `cursor stub for ${skill}`);
  }
  for (const file of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md', '.gitignore', 'package.json',
    'ux/architecture.md', 'ux/README.md', 'design-system/README.md', 'design-system/token-usage.json',
    'design-system/guidelines/components.md', '.github/workflows/ci.yml', '.cursor/rules/ux-design-system.mdc']) {
    assert.ok(exists(root, file), file);
  }
  assert.match(read(root, 'CLAUDE.md'), /^@AGENTS\.md$/m);
  assert.match(read(root, '.gitignore'), /design-system\/exports\/platforms\//);
  assert.equal(readJson(root, 'ux/uxagent.lock.json').uxagent, VERSION);
  assert.match(log.text(), /\/ux-setup/);
});

test('every path the AGENTS.md block and the stubs point at exists', () => {
  const root = tempRepo();
  setUp(root);
  // Stand in for the installed package.
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(PKG_ROOT, path.join(root, 'node_modules/uxagent'), 'dir');

  const block = read(root, 'AGENTS.md');
  assert.doesNotMatch(block, /\{\{|<!-- (if|endif)/, 'no template syntax left');
  const rows = block.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| ---') && !l.startsWith('| If your task'));
  assert.ok(rows.length > 20);
  for (const row of rows) {
    const target = /\| `([^`]+)`[^|]*\|$/.exec(row)?.[1];
    assert.ok(target, `row has a target: ${row}`);
    assert.ok(exists(root, target), `${target} exists`);
  }
  for (const skill of skills) {
    const stub = read(root, `.claude/skills/${skill}/SKILL.md`);
    assert.match(stub, new RegExp(`^name: ${skill}$`, 'm'));
    assert.match(stub, /^description:/m);
    const target = /Read and follow `([^`]+)`/.exec(stub)[1];
    assert.ok(exists(root, target), `${target} exists`);
  }
  for (const rule of fs.readdirSync(path.join(root, '.cursor/rules'))) {
    const text = read(root, `.cursor/rules/${rule}`);
    assert.doesNotMatch(text, /\{\{|<!-- (if|endif)/);
    for (const m of text.matchAll(/`(node_modules\/[^`]+)`/g)) assert.ok(exists(root, m[1]), `${m[1]} exists`);
  }
  assert.equal(doctor({ root, log: logger() }).code, 0);
});

test('sync is idempotent, and --check reports drift without writing', () => {
  const root = tempRepo();
  setUp(root);
  const before = snapshot(root);
  assert.equal(sync({ root, log: logger() }).code, 0);
  assert.deepEqual(snapshot(root), before);
  assert.equal(sync({ root, check: true, log: logger() }).code, 0);

  fs.rmSync(path.join(root, '.claude/skills/ux-setup/SKILL.md'));
  const afterDelete = snapshot(root);
  assert.equal(sync({ root, check: true, log: logger() }).code, 1);
  assert.deepEqual(snapshot(root), afterDelete, '--check writes nothing');
  assert.equal(sync({ root, log: logger() }).code, 0);
  assert.deepEqual(snapshot(root), before);
});

test('init again only syncs', () => {
  const root = tempRepo();
  setUp(root);
  setConfig(root, (c) => { c.commands.dev = 'npm run dev'; });
  const before = snapshot(root);
  const log = logger();
  assert.equal(init({ root, install: false, log }).code, 0);
  assert.deepEqual(snapshot(root), before);
  assert.match(log.text(), /already set up/);
});

test('an existing codebase keeps its own conventions and files', () => {
  const agents = '# Our agents file\n\nHouse rules.\n';
  const ownPr = '---\nname: pr\ndescription: Ours.\n---\n\nOur PR process.\n';
  const root = tempRepo({
    'package.json': JSON.stringify({ name: 'app', dependencies: { react: '^19.0.0' } }),
    'app/page.tsx': 'export default () => null;\n',
    'AGENTS.md': agents,
    'CLAUDE.md': '# Claude\n\nUse pnpm.\n',
    '.claude/skills/pr/SKILL.md': ownPr,
    '.gitignore': 'node_modules\n',
    '.github/workflows/ci.yml': 'name: ours\n',
  });
  assert.deepEqual(detect(root), { preset: 'existing', agents: ['claude'], source: 'app' });
  const log = logger();
  assert.equal(init({ root, install: false, log }).code, 0);

  const config = loadConfig({ root });
  assert.equal(config.preset, 'existing');
  assert.equal(config.modules.repo, false);
  assert.deepEqual(config.agents, ['claude']);
  assert.equal(config.paths.source, 'app');

  // Their files are kept; ours are added beside or inside them.
  assert.ok(read(root, 'AGENTS.md').startsWith(agents));
  assert.match(read(root, 'AGENTS.md'), /<!-- uxagent:start -->[\s\S]*<!-- uxagent:end -->/);
  assert.match(read(root, 'CLAUDE.md'), /Use pnpm\.[\s\S]*<!-- uxagent:start -->\n@AGENTS\.md/);
  assert.equal(read(root, '.claude/skills/pr/SKILL.md'), ownPr);
  assert.equal(read(root, '.github/workflows/ci.yml'), 'name: ours\n');
  assert.ok(read(root, '.gitignore').startsWith('node_modules\n'));

  // The repo module is off: no git rules, no /pr or /editor-setup, no other tools' files.
  const block = read(root, 'AGENTS.md');
  assert.doesNotMatch(block, /Keep tracks of work organized|git-workflow|skills\/pr\/|editor-setup/);
  assert.match(block, /under `app\/`/);
  assert.ok(!exists(root, '.claude/skills/editor-setup'));
  assert.ok(!exists(root, '.cursor'));
  assert.ok(!exists(root, 'GEMINI.md'));
  assert.ok(!exists(root, '.github/pull_request_template.md'));
  assert.ok(exists(root, '.claude/skills/ux-setup/SKILL.md'));
});

test('a project skill with the same name wins, and its routing row is dropped', () => {
  const root = tempRepo({ '.claude/skills/pr/SKILL.md': '---\nname: pr\n---\nOurs.\n' });
  const log = logger();
  init({ root, install: false, preset: 'greenfield', log });
  assert.equal(read(root, '.claude/skills/pr/SKILL.md'), '---\nname: pr\n---\nOurs.\n');
  assert.match(log.text(), /has its own `pr` skill/);
  assert.doesNotMatch(read(root, 'AGENTS.md'), /skills\/pr\/SKILL\.md/);
  assert.match(read(root, 'AGENTS.md'), /git-workflow\.md/, 'the rest of the repo module stays');
});

test('an existing CLAUDE.md that already points at AGENTS.md is left alone', () => {
  const claude = '# Claude\n\nSee AGENTS.md.\n';
  const root = tempRepo({ 'CLAUDE.md': claude });
  setUp(root);
  assert.equal(read(root, 'CLAUDE.md'), claude);
});

test('opting out of a skill or a module removes what it added', () => {
  const root = tempRepo();
  setUp(root);
  setConfig(root, (c) => { c.skills.pr = false; c.modules.export = false; });
  sync({ root, log: logger() });
  assert.ok(!exists(root, '.claude/skills/pr'));
  assert.ok(!exists(root, '.cursor/skills/pr'));
  assert.ok(!exists(root, '.claude/skills/export-design-md'));
  assert.doesNotMatch(read(root, 'AGENTS.md'), /skills\/pr\/|export-design-md/);
  assert.ok(exists(root, '.claude/skills/ux-setup/SKILL.md'));

  setConfig(root, (c) => { delete c.skills.pr; c.agents = ['claude']; });
  sync({ root, log: logger() });
  assert.ok(exists(root, '.claude/skills/pr/SKILL.md'));
  assert.ok(!exists(root, '.cursor'));
  assert.ok(!exists(root, 'GEMINI.md'));
});

test('a managed file edited by hand is left alone and reported', () => {
  const root = tempRepo();
  setUp(root);
  const stub = '.claude/skills/design-tokens/SKILL.md';
  write(root, stub, `${read(root, stub)}\nMy note.\n`);
  const log = logger();
  assert.equal(sync({ root, log }).code, 0);
  assert.match(read(root, stub), /My note\./);
  assert.match(log.text(), /design-tokens\/SKILL\.md was edited by hand/);
  assert.equal(sync({ root, check: true, log: logger() }).code, 1);
  assert.equal(doctor({ root, log: logger() }).code, 1);

  sync({ root, force: true, log: logger() });
  assert.doesNotMatch(read(root, stub), /My note\./);
});

test('seeded files are never rewritten, and a deleted one stays deleted', () => {
  const root = tempRepo();
  setUp(root);
  write(root, 'design-system/guidelines/color.md', '# Our color rules\n');
  fs.rmSync(path.join(root, 'ux/personas'), { recursive: true });
  sync({ root, force: true, log: logger() });
  assert.equal(read(root, 'design-system/guidelines/color.md'), '# Our color rules\n');
  assert.ok(!exists(root, 'ux/personas'));
});

test('content outside the uxagent block survives a sync', () => {
  const root = tempRepo();
  setUp(root);
  write(root, 'AGENTS.md', `# Ours\n\nBefore.\n\n${read(root, 'AGENTS.md').split('\n').slice(4).join('\n')}\n## After\n\nKept.\n`);
  setConfig(root, (c) => { c.modules.catalog = false; });
  sync({ root, log: logger() });
  const text = read(root, 'AGENTS.md');
  assert.match(text, /^# Ours\n\nBefore\.\n/);
  assert.match(text, /<!-- uxagent:end -->\n\n## After\n\nKept\.\n$/);
  assert.doesNotMatch(text, /component-catalog/);
  assert.equal((text.match(/<!-- uxagent:start -->/g) ?? []).length, 1);
});

test('a custom design-system folder is used everywhere', () => {
  const root = tempRepo();
  setUp(root, { designSystem: 'docs/ds', source: 'web/src' });
  assert.ok(exists(root, 'docs/ds/guidelines/color.md'));
  assert.ok(!exists(root, 'design-system'));
  const block = read(root, 'AGENTS.md');
  assert.match(block, /`docs\/ds\/guidelines\/components\.md`/);
  assert.match(block, /In this repo it is\s+`docs\/ds\/`/);
  assert.match(read(root, '.gitignore'), /docs\/ds\/exports\/platforms\//);
  assert.match(read(root, '.cursor/rules/ux-design-system.mdc'), /globs: web\/src\/\*\*/);
});

test('init refuses to seed into a design-system folder that already has files', () => {
  const root = tempRepo({ 'design-system/package.json': '{}' });
  assert.throws(() => setUp(root), /--design-system/);
  assert.ok(!exists(root, 'ux/config.json'));
});

test('init stops in a prototyping-kit prototype unless forced', () => {
  const root = tempRepo({ 'Agents/skills/setup/SKILL.md': 'x', 'Docs/Design system/README.md': 'x' });
  const log = logger();
  assert.equal(init({ root, install: false, log }).code, 1);
  assert.match(log.text(), /prototyping-kit/);
  assert.ok(!exists(root, 'ux'));
  assert.equal(init({ root, install: false, force: true, log: logger() }).code, 0);
});

test('eject copies a skill for the project to change; restore drops it', () => {
  const root = tempRepo();
  setUp(root);
  const log = logger();
  assert.equal(eject('pr', { root, log }).code, 0);
  const override = 'ux/overrides/skills/pr/SKILL.md';
  assert.ok(exists(root, override));
  assert.match(read(root, '.claude/skills/pr/SKILL.md'), /Read and follow `ux\/overrides\/skills\/pr\/SKILL\.md`/);
  assert.match(read(root, 'AGENTS.md'), /`ux\/overrides\/skills\/pr\/SKILL\.md`/);
  // Relative links in the copy point back at the packaged files.
  for (const m of read(root, override).matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
    if (/^[a-z]+:/.test(m[1])) continue;
    assert.match(m[1], /^(\.\.\/)+node_modules\/uxagent\/agents\//, m[1]);
  }

  // The project's edits survive a sync, and doctor is quiet about an up-to-date override.
  write(root, override, `${read(root, override)}\nOur step.\n`);
  sync({ root, force: true, log: logger() });
  assert.match(read(root, override), /Our step\./);
  assert.equal(eject('skills/pr', { root, log: logger() }).code, 0);
  assert.match(read(root, override), /Our step\./, 'ejecting again does not overwrite');

  // When the packaged file changes, sync says so until the project acknowledges it.
  const lock = readJson(root, 'ux/uxagent.lock.json');
  lock.ejected['skills/pr/SKILL.md'] = 'stale';
  write(root, 'ux/uxagent.lock.json', JSON.stringify(lock));
  const report = logger();
  sync({ root, log: report });
  assert.match(report.text(), /has changed in uxagent since/);
  eject('pr', { root, ack: true, log: logger() });
  const quiet = logger();
  sync({ root, log: quiet });
  assert.doesNotMatch(quiet.text(), /has changed in uxagent since/);

  assert.equal(restore('pr', { root, log: logger() }).code, 0);
  assert.ok(!exists(root, 'ux/overrides'));
  assert.match(read(root, '.claude/skills/pr/SKILL.md'), /node_modules\/uxagent\/agents\/skills\/pr\/SKILL\.md/);
  assert.deepEqual(readJson(root, 'ux/uxagent.lock.json').ejected, {});
});

test('eject accepts context files and rejects unknown names', () => {
  const root = tempRepo();
  setUp(root);
  eject('context/git-workflow.md', { root, log: logger() });
  assert.ok(exists(root, 'ux/overrides/context/git-workflow.md'));
  assert.match(read(root, 'AGENTS.md'), /`ux\/overrides\/context\/git-workflow\.md`/);
  assert.match(read(root, '.cursor/rules/ux-git-workflow.mdc'), /ux\/overrides\/context\/git-workflow\.md/);
  assert.throws(() => eject('nope', { root, log: logger() }), /No packaged file matches/);
  assert.throws(() => eject('../package.json', { root, log: logger() }), /No packaged file matches/);
});

test('doctor reports a missing install and a version change', () => {
  const root = tempRepo();
  setUp(root);
  const log = logger();
  assert.equal(doctor({ root, log }).code, 1);
  assert.match(log.text(), /not installed in this project/);

  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(PKG_ROOT, path.join(root, 'node_modules/uxagent'), 'dir');
  assert.equal(doctor({ root, log: logger() }).code, 0);

  const lock = readJson(root, 'ux/uxagent.lock.json');
  lock.uxagent = '0.0.1';
  write(root, 'ux/uxagent.lock.json', JSON.stringify(lock));
  const stale = logger();
  assert.equal(doctor({ root, log: stale }).code, 1);
  assert.match(stale.text(), /last synced with uxagent 0\.0\.1/);
  const updated = logger();
  sync({ root, log: updated });
  assert.match(updated.text(), /updated from 0\.0\.1/);
  assert.equal(doctor({ root, log: logger() }).code, 0);
});

test('a seed added by a later version arrives on sync', () => {
  const root = tempRepo();
  setUp(root);
  // As if this repo was set up before uxagent shipped the motion guideline.
  const lock = readJson(root, 'ux/uxagent.lock.json');
  lock.seeded = lock.seeded.filter((p) => p !== 'design-system/guidelines/motion.md');
  write(root, 'ux/uxagent.lock.json', JSON.stringify(lock));
  fs.rmSync(path.join(root, 'design-system/guidelines/motion.md'));
  sync({ root, log: logger() });
  assert.ok(exists(root, 'design-system/guidelines/motion.md'));
});
