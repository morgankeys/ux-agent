// Reads `ux/config.json` and resolves every path uxagent uses in a project. All code that
// needs a project path asks here; nothing else hardcodes `design-system/` or `ux/`.
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENT_TOOLS, CONFIG_REL, CONFIG_VERSION, DEFAULT_PATHS, DEFAULT_VALIDATE, LOCK_REL, MODULES, PRESETS, ROLES,
} from './defaults.mjs';

export class ConfigError extends Error {}

const posix = (p) => p.split(path.sep).join('/').replace(/\/+$/, '');

// The nearest folder at or above `start` that holds ux/config.json, or null.
export function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, CONFIG_REL))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Every project path, relative to the project root, with forward slashes.
export function resolvePaths(rawPaths = {}) {
  const designSystem = posix(rawPaths.designSystem ?? DEFAULT_PATHS.designSystem);
  const source = posix(rawPaths.source ?? DEFAULT_PATHS.source);
  const exports = posix(rawPaths.exports ?? `${designSystem}/exports`);
  return {
    ux: 'ux',
    config: CONFIG_REL,
    lock: LOCK_REL,
    setupStatus: 'ux/setup-status.md',
    architecture: 'ux/architecture.md',
    personas: 'ux/personas',
    assets: 'ux/assets',
    context: 'ux/context',
    overrides: 'ux/overrides',
    source,
    designSystem,
    designSystemReadme: `${designSystem}/README.md`,
    guidelines: `${designSystem}/guidelines`,
    registry: `${designSystem}/guidelines/components.md`,
    supplemental: `${designSystem}/supplemental`,
    figma: `${designSystem}/figma`,
    figmaTokens: `${designSystem}/figma/tokens`,
    figmaTokensUnpacked: `${designSystem}/figma/tokens/unpacked`,
    figmaAssets: `${designSystem}/figma/assets`,
    usageMap: `${designSystem}/token-usage.json`,
    backlog: `${designSystem}/deviations-backlog.md`,
    usageReview: `${designSystem}/token-usage-review.md`,
    platformComponents: `${designSystem}/platform-components`,
    exports,
    designMd: `${exports}/DESIGN.md`,
    platformExports: `${exports}/platforms`,
  };
}

export function resolveModules(preset, rawModules = {}) {
  const base = PRESETS[preset]?.modules ?? {};
  const out = { core: true };
  for (const name of MODULES) out[name] = rawModules[name] ?? base[name] ?? true;
  return out;
}

// Normalizes a parsed config object. Split from loadConfig so `init` can resolve a config
// it has not written yet.
export function resolveConfig(raw, root) {
  if (raw.version !== undefined && raw.version > CONFIG_VERSION) {
    throw new ConfigError(
      `${CONFIG_REL} is version ${raw.version}; this uxagent reads up to version ${CONFIG_VERSION}. Update uxagent.`,
    );
  }
  const preset = raw.preset ?? 'greenfield';
  if (!PRESETS[preset]) throw new ConfigError(`Unknown preset \`${preset}\` in ${CONFIG_REL}. Use one of: ${Object.keys(PRESETS).join(', ')}.`);
  const agents = raw.agents ?? AGENT_TOOLS;
  for (const a of agents) {
    if (!AGENT_TOOLS.includes(a)) throw new ConfigError(`Unknown agent tool \`${a}\` in ${CONFIG_REL}. Use any of: ${AGENT_TOOLS.join(', ')}.`);
  }
  for (const name of Object.keys(raw.modules ?? {})) {
    if (!MODULES.includes(name)) throw new ConfigError(`Unknown module \`${name}\` in ${CONFIG_REL}. Modules: ${MODULES.join(', ')}.`);
  }
  const paths = resolvePaths(raw.paths);
  for (const key of ['designSystem', 'source', 'exports']) {
    if (path.isAbsolute(paths[key]) || paths[key].split('/').includes('..')) {
      throw new ConfigError(`paths.${key} in ${CONFIG_REL} must be a folder inside the project, relative to its root.`);
    }
  }
  const figma = raw.figma === false ? false : { site: raw.figma?.site ?? null, library: raw.figma?.library ?? null };
  const commands = Object.fromEntries(ROLES.map((role) => [role, raw.commands?.[role] ?? null]));
  const validate = { ...DEFAULT_VALIDATE, ...(raw.validate ?? {}) };
  if (!validate.include) validate.include = [`${paths.source}/**/*.{css,svelte,vue,astro}`];

  return {
    root,
    configPath: path.join(root, CONFIG_REL),
    raw,
    preset,
    agents,
    agentFiles: raw.agentFiles ?? 'package',
    modules: resolveModules(preset, raw.modules),
    skills: raw.skills ?? {},
    figma,
    commands,
    paths,
    validate,
    // Absolute path of a root-relative path.
    abs: (rel) => path.resolve(root, rel),
  };
}

// Loads the config of the project that contains `cwd` (or of `root`, when given).
export function loadConfig({ root, cwd = process.cwd() } = {}) {
  const projectRoot = root ? path.resolve(root) : findRoot(cwd);
  if (!projectRoot || !fs.existsSync(path.join(projectRoot, CONFIG_REL))) {
    throw new ConfigError(`No ${CONFIG_REL} found here or in a parent folder. Run \`npx uxagent init\` first.`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(projectRoot, CONFIG_REL), 'utf8'));
  } catch (err) {
    throw new ConfigError(`Could not read ${CONFIG_REL}: ${err.message}`);
  }
  return resolveConfig(raw, projectRoot);
}

// Rewrites one top-level key of the config file, keeping the rest of the file as written.
export function updateConfig(root, mutate) {
  const file = path.join(root, CONFIG_REL);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  mutate(raw);
  fs.writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
  return raw;
}
