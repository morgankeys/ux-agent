// `uxagent init`: set uxagent up in a repo. Writes ux/config.json, then hands over to
// `sync`, which seeds the starter files and writes the managed ones. Safe to rerun.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AGENT_TOOLS, CONFIG_REL, PRESETS, initialConfig } from '../config/defaults.mjs';
import { ConfigError } from '../config/load.mjs';
import { PKG_NAME, VERSION, packageLocation } from './core.mjs';
import { sync } from './sync.mjs';

const MANIFESTS = ['Cargo.toml', 'Gemfile', 'pyproject.toml', 'requirements.txt', 'go.mod', 'pom.xml', 'build.gradle', 'composer.json', 'Package.swift', 'mix.exs'];
const SOURCE_DIRS = ['src', 'app', 'lib', 'packages', 'apps'];

const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// A repo made from the prototyping-kit template, which uxagent replaces.
const isKitPrototype = (root) => exists(root, 'Agents/skills') && exists(root, 'Docs/Design system');

export function detect(root) {
  let existing = MANIFESTS.some((m) => exists(root, m)) || SOURCE_DIRS.some((d) => exists(root, d));
  if (exists(root, 'package.json')) {
    const pkg = readJson(path.join(root, 'package.json'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => d !== PKG_NAME);
    if (deps.length) existing = true;
  }
  const signs = {
    claude: ['CLAUDE.md', '.claude'],
    cursor: ['.cursor', '.cursorrules'],
    copilot: ['.github/copilot-instructions.md'],
    gemini: ['GEMINI.md', '.gemini'],
  };
  const found = AGENT_TOOLS.filter((tool) => signs[tool].some((s) => exists(root, s)));
  const source = ['src', 'app', 'lib'].find((d) => exists(root, d)) ?? 'src';
  return { preset: existing ? 'existing' : 'greenfield', agents: found, source };
}

function packageManager(root) {
  if (exists(root, 'pnpm-lock.yaml')) return { name: 'pnpm', add: ['pnpm', 'add', '-D'] };
  if (exists(root, 'yarn.lock')) return { name: 'yarn', add: ['yarn', 'add', '-D'] };
  if (exists(root, 'bun.lock') || exists(root, 'bun.lockb')) return { name: 'bun', add: ['bun', 'add', '-d'] };
  return { name: 'npm', add: ['npm', 'install', '-D'] };
}

function parse(argv) {
  const opts = { install: true, force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (argv[i + 1] === undefined) throw new ConfigError(`${arg} needs a value.`);
      return argv[++i];
    };
    if (arg === '--preset') opts.preset = value();
    else if (arg === '--agents') opts.agents = value().split(',').map((a) => a.trim()).filter(Boolean);
    else if (arg === '--design-system') opts.designSystem = value();
    else if (arg === '--source') opts.source = value();
    else if (arg === '--no-install') opts.install = false;
    else if (arg === '--force') opts.force = true;
    else throw new ConfigError(`Unknown option ${arg}. Options: --preset <${Object.keys(PRESETS).join('|')}>, --agents <${AGENT_TOOLS.join(',')}>, --design-system <folder>, --source <folder>, --no-install, --force.`);
  }
  return opts;
}

export function init(opts = {}) {
  const { root = process.cwd(), log = console.log } = opts;

  if (exists(root, CONFIG_REL)) {
    log('uxagent init: this repo is already set up, so this run only syncs it.');
    return sync({ root, log });
  }
  if (isKitPrototype(root) && !opts.force) {
    log('uxagent init: this looks like a prototype made from the prototyping-kit template (it has Agents/ and Docs/Design system/).');
    log('  uxagent replaces that template, and moving a prototype across automatically is not built yet.');
    log('  To set uxagent up beside the old folders anyway and move things by hand, rerun with --force.');
    return { code: 1 };
  }

  const found = detect(root);
  const preset = opts.preset ?? found.preset;
  if (!PRESETS[preset]) throw new ConfigError(`Unknown preset \`${preset}\`. Use one of: ${Object.keys(PRESETS).join(', ')}.`);
  // In a new repo, wire every tool. In an existing one, only the tools it already uses.
  const agents = opts.agents ?? (preset === 'existing' && found.agents.length ? found.agents : AGENT_TOOLS);
  for (const a of agents) if (!AGENT_TOOLS.includes(a)) throw new ConfigError(`Unknown agent tool \`${a}\`. Use any of: ${AGENT_TOOLS.join(', ')}.`);
  const designSystem = (opts.designSystem ?? 'design-system').replace(/\/+$/, '');
  const dsDir = path.join(root, designSystem);
  if (fs.existsSync(dsDir) && fs.readdirSync(dsDir).length) {
    throw new ConfigError(`${designSystem}/ already exists and has files in it. Choose where the design-system sources should go with --design-system <folder> (for example ux/design-system).`);
  }

  // The config.
  const config = initialConfig({ preset, agents, paths: { designSystem, source: opts.source ?? found.source } });
  config.$schema = `../${packageLocation(root).path}/schema/config.schema.json`;
  fs.mkdirSync(path.join(root, 'ux'), { recursive: true });
  fs.writeFileSync(path.join(root, CONFIG_REL), `${JSON.stringify(config, null, 2)}\n`);

  log(`uxagent init: setting up as ${preset === 'existing' ? 'an existing codebase' : 'a new repo'} (preset \`${preset}\`), for ${agents.join(', ')}.`);
  if (preset === 'existing') log('  The repo\'s own git, CI, lint, and pull request conventions stay in charge. Rerun with --preset greenfield to have uxagent set those up too.');
  if (!exists(root, '.git')) log('  Note: this folder is not a git repository yet.');

  // The dependency, so agents can read the skills from node_modules.
  const pkgFile = path.join(root, 'package.json');
  if (!fs.existsSync(pkgFile)) {
    const name = path.basename(root).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._-]+/, '') || 'project';
    fs.writeFileSync(pkgFile, `${JSON.stringify({ name, private: true }, null, 2)}\n`);
    log('  Created package.json.');
  }
  const pkg = readJson(pkgFile);
  const listed = pkg.dependencies?.[PKG_NAME] ?? pkg.devDependencies?.[PKG_NAME];
  if (!listed || !packageLocation(root).installed) {
    const pm = packageManager(root);
    const command = [...pm.add, `${PKG_NAME}@${VERSION}`];
    let installed = false;
    if (opts.install !== false) {
      log(`  Installing uxagent with ${pm.name}…`);
      installed = spawnSync(command[0], command.slice(1), { cwd: root, stdio: 'ignore' }).status === 0;
    }
    if (!installed) log(`  uxagent still needs installing in this project: \`${command.join(' ')}\`.`);
  }

  const result = sync({ root, log });
  if (result.code === 0) {
    log('');
    log('Next: ask your agent to run /ux-setup. It checks what this repo has, and walks you through the rest.');
  }
  return result;
}

export async function cli(argv) {
  return init(parse(argv)).code;
}
