// `uxagent eject <file>` copies a packaged skill or context file into ux/overrides/ so the
// project can change it; `uxagent restore <file>` drops the copy. Stubs and the AGENTS.md
// block follow automatically, because `sync` points them at whichever file is in effect.
import fs from 'node:fs';
import path from 'node:path';
import { LOCK_REL } from '../config/defaults.mjs';
import { ConfigError, loadConfig } from '../config/load.mjs';
import { PKG_ROOT, hash, packageLocation, readLock, readManifest } from './core.mjs';
import { sync } from './sync.mjs';

const AGENTS = path.join(PKG_ROOT, 'agents');
const posix = (p) => p.split(path.sep).join('/');

// Accepts `pr`, `skills/pr`, `skills/pr/SKILL.md`, or `context/git-workflow.md`.
export function resolveTarget(name) {
  const clean = posix(name).replace(/^(\.\/)?(agents\/)?/, '').replace(/\/$/, '');
  const candidates = [clean, `${clean}/SKILL.md`, `skills/${clean}/SKILL.md`, `${clean}.md`, `context/${clean}.md`];
  const rel = candidates.find((c) => !c.split('/').includes('..') && fs.existsSync(path.join(AGENTS, c)) && fs.statSync(path.join(AGENTS, c)).isFile());
  if (!rel || rel === 'manifest.json') {
    const skills = readManifest().skills.map((s) => s.name).join(', ');
    throw new ConfigError(`No packaged file matches \`${name}\`. Give a skill name (${skills}) or a path under uxagent's agents/ folder, such as context/git-workflow.md.`);
  }
  return rel;
}

// Relative links in the copy would point nowhere from ux/overrides/, so re-aim each one
// at the packaged file (or at another override, when that file is ejected too).
function relink(markdown, rel, { root, overridesDir, pkgPath, ejected }) {
  const fromDir = path.join(root, overridesDir, path.dirname(rel));
  return markdown.replace(/\]\(([^)\s#]+)(#[^)\s]*)?\)/g, (match, target, anchor = '') => {
    if (/^[a-z]+:/i.test(target) || target.startsWith('/')) return match;
    const targetRel = posix(path.normalize(path.join(path.dirname(rel), decodeURIComponent(target))));
    if (targetRel.startsWith('..')) return match;
    const dest = ejected[targetRel] ? path.join(root, overridesDir, targetRel) : path.join(root, pkgPath, 'agents', targetRel);
    return `](${posix(path.relative(fromDir, dest))}${anchor})`;
  });
}

function writeLock(root, mutate) {
  const file = path.join(root, LOCK_REL);
  const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  raw.ejected = raw.ejected ?? {};
  mutate(raw.ejected);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
}

export function eject(name, { root, cwd, ack = false, log = console.log } = {}) {
  const config = loadConfig({ root, cwd });
  const rel = resolveTarget(name);
  const source = fs.readFileSync(path.join(AGENTS, rel), 'utf8');
  const target = path.join(config.root, config.paths.overrides, rel);
  const lock = readLock(config.root);
  const shown = `${config.paths.overrides}/${rel}`;

  if (fs.existsSync(target)) {
    if (!ack) {
      log(`uxagent eject: ${shown} already exists and was left as it is.`);
      log('  If uxagent\'s version changed and you have brought across what you want, rerun with --ack to record that.');
      return { code: 0, path: shown };
    }
    writeLock(config.root, (ejected) => { ejected[rel] = hash(source); });
    log(`uxagent eject: recorded that ${shown} is up to date with uxagent's ${rel}.`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, relink(source, rel, {
      root: config.root, overridesDir: config.paths.overrides, pkgPath: packageLocation(config.root).path, ejected: { ...lock.ejected, [rel]: true },
    }));
    writeLock(config.root, (ejected) => { ejected[rel] = hash(source); });
    log(`uxagent eject: copied ${rel} to ${shown}. It is this project's file now; uxagent won't change it.`);
  }
  sync({ root: config.root, log });
  return { code: 0, path: shown };
}

export function restore(name, { root, cwd, log = console.log } = {}) {
  const config = loadConfig({ root, cwd });
  const rel = resolveTarget(name);
  const lock = readLock(config.root);
  const shown = `${config.paths.overrides}/${rel}`;
  const target = path.join(config.root, shown);
  if (!(rel in lock.ejected) && !fs.existsSync(target)) {
    log(`uxagent restore: ${rel} is not overridden in this project.`);
    return { code: 0 };
  }
  if (fs.existsSync(target)) {
    fs.rmSync(target);
    for (let dir = path.dirname(target); dir.startsWith(path.join(config.root, config.paths.overrides)); dir = path.dirname(dir)) {
      if (fs.readdirSync(dir).length) break;
      fs.rmdirSync(dir);
    }
  }
  writeLock(config.root, (ejected) => { delete ejected[rel]; });
  log(`uxagent restore: removed ${shown}. uxagent's ${rel} is in effect again.`);
  sync({ root: config.root, log });
  return { code: 0 };
}

function parse(argv, command) {
  const flags = argv.filter((a) => a.startsWith('--'));
  const names = argv.filter((a) => !a.startsWith('--'));
  const allowed = command === 'eject' ? ['--ack'] : [];
  const bad = flags.find((f) => !allowed.includes(f));
  if (bad || names.length !== 1) {
    console.error(`Usage: uxagent ${command} <skill name or file under agents/>${command === 'eject' ? ' [--ack]' : ''}`);
    return null;
  }
  return { name: names[0], ack: flags.includes('--ack') };
}

export async function cli(argv) {
  const args = parse(argv, 'eject');
  return args ? eject(args.name, { ack: args.ack }).code : 2;
}

export async function restoreCli(argv) {
  const args = parse(argv, 'restore');
  return args ? restore(args.name).code : 2;
}
