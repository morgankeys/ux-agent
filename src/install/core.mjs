// The installer's engine: works out what uxagent should have written in a project, compares
// it with what is there, and applies the difference. `init`, `sync`, `doctor`, `eject`, and
// `restore` are thin commands over `plan()` and `apply()`.
//
// File kinds (docs/architecture.md): managed files are rewritten unless a person edited
// them; seeded files are written once and never again; ejected files belong to the project.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PATHS, LOCK_REL } from '../config/defaults.mjs';

export const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const VERSION = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
export const PKG_NAME = 'uxagent';

const MD_MARKERS = ['<!-- uxagent:start -->', '<!-- uxagent:end -->'];
const HASH_MARKERS = ['# uxagent:start', '# uxagent:end'];

const posix = (p) => p.split(path.sep).join('/');
export const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const readIf = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);

export const readManifest = () => JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'agents/manifest.json'), 'utf8'));

// ---------------------------------------------------------------------------------------
// Where the package is, as agents in the project should write it.

export function packageLocation(root) {
  for (let dir = root, up = ''; ; up += '../') {
    if (fs.existsSync(path.join(dir, 'node_modules', PKG_NAME, 'package.json'))) {
      return { path: `${up}node_modules/${PKG_NAME}`, installed: true };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { path: `node_modules/${PKG_NAME}`, installed: false };
}

// ---------------------------------------------------------------------------------------
// The lock file.

export function readLock(root) {
  const text = readIf(path.join(root, LOCK_REL));
  const lock = text ? JSON.parse(text) : {};
  return {
    uxagent: lock.uxagent ?? null,
    package: lock.package ?? null,
    managed: lock.managed ?? {},
    blocks: lock.blocks ?? [],
    seeded: lock.seeded ?? [],
    ejected: lock.ejected ?? {},
  };
}

function serializeLock(lock) {
  const sorted = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({
    $comment: 'Written by uxagent. Records what it put in this repo, so `npx uxagent sync` can update it safely. Commit this file; do not edit it.',
    uxagent: lock.uxagent,
    package: lock.package,
    managed: sorted(lock.managed),
    blocks: [...lock.blocks].sort(),
    seeded: [...lock.seeded].sort(),
    ejected: sorted(lock.ejected),
  }, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------
// Templates.

// `<!-- if:name -->…<!-- endif -->` blocks, `{{doc:path}}`, and `{{name}}`.
export function render(text, { flags, vars, doc }) {
  return text
    .replace(/^<!-- if:([\w-]+) -->\n([\s\S]*?)^<!-- endif -->\n/gm, (_, name, body) => (flags[name] ? body : ''))
    .replace(/\{\{doc:([^}]+)\}\}/g, (_, rel) => doc(rel))
    .replace(/\{\{(\w+)\}\}/g, (match, name) => vars[name] ?? match);
}

// The frontmatter block of a skill, verbatim, so a stub carries every key the skill sets.
function frontmatter(markdown) {
  return /^---\n[\s\S]*?\n---\n/.exec(markdown)?.[0] ?? '';
}

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [posix(path.relative(base, full))];
  });
}

// ---------------------------------------------------------------------------------------
// What should be in the project.

const SKILL_DIRS = { claude: '.claude/skills', cursor: '.cursor/skills' };
const ENTRY_FILES = { claude: 'CLAUDE.md', gemini: 'GEMINI.md', copilot: '.github/copilot-instructions.md' };

function entryFile(tool, agentsLink) {
  const title = { claude: 'CLAUDE.md', gemini: 'GEMINI.md', copilot: 'Copilot instructions' }[tool];
  const body = `See [\`AGENTS.md\`](${agentsLink}) for how to work in this repo. It is the single source of truth\nfor any AI tool working here.\n`;
  // Claude Code loads AGENTS.md only when CLAUDE.md imports it.
  return `# ${title}\n\n${tool === 'claude' ? '@AGENTS.md\n\n' : ''}${body}`;
}

function desired(config, lock, pkg) {
  const { root, paths, modules } = config;
  const manifest = readManifest();
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  const ours = (rel) => rel in lock.managed;

  const doc = (rel) => (lock.ejected[rel] ? `${paths.overrides}/${rel}` : `${pkg.path}/agents/${rel}`);
  const projectPath = (rel) => (rel === 'design-system' || rel.startsWith('design-system/')
    ? paths.designSystem + rel.slice('design-system'.length)
    : rel);
  const ctx = {
    flags: { ...modules, customDesignSystem: paths.designSystem !== DEFAULT_PATHS.designSystem },
    vars: { pkg: pkg.path, designSystem: paths.designSystem, source: paths.source },
    doc,
  };

  const files = new Map(); // managed whole files: path -> content
  const blocks = []; // managed blocks inside files the project owns
  const kept = []; // files left alone because the project has its own

  // Skills: on when the module is on and the project hasn't opted out.
  const skills = manifest.skills.filter((s) => modules[s.module] && config.skills[s.name] !== false);
  const shadowed = new Set();
  for (const skill of skills) {
    const source = fs.readFileSync(path.join(PKG_ROOT, 'agents/skills', skill.name, 'SKILL.md'), 'utf8');
    const target = doc(`skills/${skill.name}/SKILL.md`);
    const stub = `${frontmatter(source)}\nRead and follow \`${target}\`.\n\n`
      + 'If that file is missing, install the project\'s dependencies first, then read it.\n\n'
      + `Managed by uxagent. To change this skill, run \`npx uxagent eject skills/${skill.name}\`; to drop it, set \`"${skill.name}": false\` under \`skills\` in \`ux/config.json\`.\n`;
    for (const [tool, dir] of Object.entries(SKILL_DIRS)) {
      if (!config.agents.includes(tool)) continue;
      const rel = `${dir}/${skill.name}/SKILL.md`;
      if (exists(rel) && !ours(rel) && fs.readFileSync(path.join(root, rel), 'utf8') !== stub) {
        shadowed.add(skill.name);
        kept.push({ path: rel, reason: `the project has its own \`${skill.name}\` skill; uxagent's is not installed for ${tool}` });
      } else {
        files.set(rel, stub);
      }
    }
  }
  const liveSkills = new Set(skills.filter((s) => !shadowed.has(s.name)).map((s) => s.name));

  // Cursor rules.
  if (config.agents.includes('cursor')) {
    for (const rule of manifest.cursorRules.filter((r) => modules[r.module])) {
      const template = fs.readFileSync(path.join(PKG_ROOT, 'templates/cursor/rules', `${rule.name}.mdc`), 'utf8');
      files.set(`.cursor/rules/ux-${rule.name}.mdc`, render(template, ctx));
    }
  }

  // The AGENTS.md block.
  const rows = manifest.routes
    .filter((r) => modules[r.module] && (!r.skill || liveSkills.has(r.skill)))
    .map((r) => {
      const target = r.read.startsWith('project:') ? projectPath(r.read.slice('project:'.length)) : doc(r.read);
      return `| ${r.when} | \`${target}\`${r.note ? ` (${r.note})` : ''} |`;
    });
  const blockTemplate = fs.readFileSync(path.join(PKG_ROOT, 'templates/agents-block.md'), 'utf8');
  blocks.push({
    path: 'AGENTS.md',
    markers: MD_MARKERS,
    content: render(blockTemplate, { ...ctx, vars: { ...ctx.vars, routes: rows.join('\n') } }).trimEnd(),
    createWith: '# AGENTS.md\n\nInstructions for AI agents working in this repo.\n\n',
  });

  // Entry files for tools that don't read AGENTS.md on their own.
  for (const [tool, rel] of Object.entries(ENTRY_FILES)) {
    if (!config.agents.includes(tool)) continue;
    const link = posix(path.relative(path.dirname(rel), 'AGENTS.md'));
    const whole = entryFile(tool, link);
    const current = readIf(path.join(root, rel));
    if (current === null || ours(rel) || current === whole) {
      files.set(rel, whole);
    } else if (!/AGENTS\.md/.test(current.replace(/<!-- uxagent:start -->[\s\S]*?<!-- uxagent:end -->/, ''))) {
      blocks.push({
        path: rel,
        markers: MD_MARKERS,
        content: `${tool === 'claude' ? '@AGENTS.md\n\n' : ''}Also read [\`AGENTS.md\`](${link}): it holds the design-system rules for this repo.`,
      });
    }
  }

  // .gitignore
  blocks.push({
    path: '.gitignore',
    markers: HASH_MARKERS,
    content: `# Generated platform packages. Regenerate with \`npx uxagent export platforms\`.\n${paths.platformExports}/`,
  });

  // Seeds: starter files the project owns from the moment they are written.
  const seeds = new Map(); // project path -> absolute source
  const seedTree = (from, to) => {
    for (const rel of listFiles(path.join(PKG_ROOT, from))) seeds.set(`${to}/${rel}`, path.join(PKG_ROOT, from, rel));
  };
  seedTree('templates/ux', paths.ux);
  seedTree('templates/design-system', paths.designSystem);
  if (modules.repo) seedTree('templates/github', '.github');

  return { files, blocks, seeds, kept };
}

// ---------------------------------------------------------------------------------------
// Managed blocks.

function setBlock(current, [start, end], content, createWith = '') {
  const block = `${start}\n${content}\n${end}`;
  if (current === null) return `${createWith}${block}\n`;
  const from = current.indexOf(start);
  const to = current.indexOf(end);
  if (from >= 0 && to > from) return current.slice(0, from) + block + current.slice(to + end.length);
  const gap = current.endsWith('\n\n') || current === '' ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  return `${current}${gap}${block}\n`;
}

function removeBlock(current, [start, end]) {
  const from = current.indexOf(start);
  const to = current.indexOf(end);
  if (from < 0 || to < from) return current;
  return (current.slice(0, from).replace(/\n+$/, '\n') + current.slice(to + end.length).replace(/^\n+/, '\n')).replace(/^\n+$/, '');
}

const markersFor = (rel) => (rel.endsWith('.gitignore') ? HASH_MARKERS : MD_MARKERS);

// ---------------------------------------------------------------------------------------
// Plan and apply.

// Works out every change `sync` would make. Nothing is written.
export function plan(config, { force = false } = {}) {
  const { root } = config;
  const lock = readLock(root);
  const pkg = packageLocation(root);
  const want = desired(config, lock, pkg);
  const abs = (rel) => path.join(root, rel);

  const writes = []; // { path, content, action }
  const deletes = []; // paths
  const edited = []; // managed files a person changed; left alone
  const nextLock = { uxagent: VERSION, package: pkg.path, managed: {}, blocks: [], seeded: [...lock.seeded], ejected: { ...lock.ejected } };

  for (const [rel, content] of want.files) {
    const current = readIf(abs(rel));
    const recorded = lock.managed[rel];
    if (current === content) {
      nextLock.managed[rel] = hash(content);
    } else if (current === null) {
      writes.push({ path: rel, content, action: 'create' });
      nextLock.managed[rel] = hash(content);
    } else if (force || hash(current) === recorded) {
      writes.push({ path: rel, content, action: 'update' });
      nextLock.managed[rel] = hash(content);
    } else {
      // Recorded as ours but changed since. Keep the recorded hash so it keeps showing up.
      edited.push(rel);
      nextLock.managed[rel] = recorded;
    }
  }

  // Managed files that are no longer wanted (a skill opted out, a module turned off).
  for (const [rel, recorded] of Object.entries(lock.managed)) {
    if (want.files.has(rel)) continue;
    const current = readIf(abs(rel));
    if (current === null) continue;
    if (force || hash(current) === recorded) deletes.push(rel);
    else want.kept.push({ path: rel, reason: 'no longer managed by uxagent, but it was edited, so it was not deleted' });
  }

  for (const block of want.blocks) {
    const current = readIf(abs(block.path));
    const next = setBlock(current, block.markers, block.content, block.createWith);
    if (next !== current) writes.push({ path: block.path, content: next, action: current === null ? 'create' : 'update section in' });
    nextLock.blocks.push(block.path);
  }
  for (const rel of lock.blocks) {
    if (want.blocks.some((b) => b.path === rel)) continue;
    const current = readIf(abs(rel));
    if (current === null) continue;
    const next = removeBlock(current, markersFor(rel));
    if (next !== current) writes.push({ path: rel, content: next, action: 'remove section from' });
  }

  // A seed is written only if it is absent and was never seeded before, so a file the
  // project deleted stays deleted and a seed added by a later version still arrives.
  for (const [rel, source] of want.seeds) {
    if (lock.seeded.includes(rel)) continue;
    nextLock.seeded.push(rel);
    if (!fs.existsSync(abs(rel))) writes.push({ path: rel, source, action: 'seed' });
  }

  // Overrides.
  const overrides = [];
  for (const [rel, recorded] of Object.entries(lock.ejected)) {
    const source = readIf(path.join(PKG_ROOT, 'agents', rel));
    const target = `${config.paths.overrides}/${rel}`;
    if (!fs.existsSync(abs(target))) overrides.push({ path: target, problem: `is missing. Run \`npx uxagent restore ${rel}\` to go back to the packaged file.` });
    else if (source === null) overrides.push({ path: target, problem: 'overrides a file uxagent no longer ships.' });
    else if (hash(source) !== recorded) overrides.push({ path: target, problem: `overrides \`${rel}\`, which has changed in uxagent since. Compare it with \`${pkg.path}/agents/${rel}\`, then run \`npx uxagent eject ${rel} --ack\`.` });
  }

  const lockText = serializeLock(nextLock);
  const lockChanged = readIf(abs(LOCK_REL)) !== lockText;
  return { root, pkg, writes, deletes, edited, kept: want.kept, overrides, lockText, lockChanged, previousVersion: lock.uxagent };
}

function pruneEmpty(root, rel) {
  for (let dir = path.dirname(rel); dir !== '.' && dir !== '/'; dir = path.dirname(dir)) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full) || fs.readdirSync(full).length) return;
    fs.rmdirSync(full);
  }
}

export function apply(result) {
  const { root } = result;
  for (const w of result.writes) {
    const file = path.join(root, w.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (w.source) fs.copyFileSync(w.source, file);
    else fs.writeFileSync(file, w.content);
  }
  for (const rel of result.deletes) {
    fs.rmSync(path.join(root, rel));
    pruneEmpty(root, rel);
  }
  if (result.lockChanged) {
    fs.mkdirSync(path.dirname(path.join(root, LOCK_REL)), { recursive: true });
    fs.writeFileSync(path.join(root, LOCK_REL), result.lockText);
  }
}

// A short, plain account of a plan, for people and agents.
export function describe(result, { applied }) {
  const lines = [];
  const verb = (action) => (applied ? { create: 'Created', update: 'Updated', seed: 'Added' }[action] : { create: 'Would create', update: 'Would update', seed: 'Would add' }[action])
    ?? `${applied ? '' : 'Would '}${action}`.replace(/^./, (c) => c.toUpperCase());
  const seeds = result.writes.filter((w) => w.action === 'seed');
  for (const w of result.writes.filter((x) => x.action !== 'seed')) lines.push(`  ${verb(w.action)} ${w.path}`);
  if (seeds.length > 6) {
    const folders = [...new Set(seeds.map((s) => s.path.split('/')[0]))];
    lines.push(`  ${verb('seed')} ${seeds.length} starter files in ${folders.map((f) => `${f}/`).join(', ')}`);
  } else {
    for (const s of seeds) lines.push(`  ${verb('seed')} ${s.path}`);
  }
  for (const rel of result.deletes) lines.push(`  ${applied ? 'Removed' : 'Would remove'} ${rel}`);
  for (const rel of result.edited) {
    lines.push(`  Left alone: ${rel} was edited by hand. Run \`npx uxagent sync --force\` to replace it, or eject the file it points to instead.`);
  }
  for (const k of result.kept) lines.push(`  Left alone: ${k.path} (${k.reason}).`);
  for (const o of result.overrides) lines.push(`  Check: ${o.path} ${o.problem}`);
  if (!result.pkg.installed) {
    lines.push(`  Note: uxagent is not installed in this project yet, so the files under ${result.pkg.path}/ are missing. Install it as a dev dependency.`);
  }
  return lines;
}

export const pending = (result) => result.writes.length + result.deletes.length + (result.lockChanged ? 1 : 0);
