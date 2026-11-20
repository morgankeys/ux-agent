// Defaults, presets, and the fixed vocabulary of the config file. Everything else that
// reads `ux/config.json` goes through load.mjs, so a default lives in exactly one place.

export const CONFIG_REL = 'ux/config.json';
export const LOCK_REL = 'ux/uxagent.lock.json';
export const CONFIG_VERSION = 1;

// Agent tools uxagent can write entry files and skill stubs for.
export const AGENT_TOOLS = ['claude', 'cursor', 'copilot', 'gemini'];

// `core` is always on and is not listed in the config.
export const MODULES = ['tokens', 'validator', 'dev-pages', 'figma', 'catalog', 'export', 'repo'];

// Command roles. Docs and skills name commands by role; `commands` in the config maps
// each role to the project's real command. `null` means not wired yet.
export const ROLES = ['dev', 'build', 'lint', 'check', 'tokens', 'validate', 'stories', 'stories-build', 'connect'];

export const PRESETS = {
  // A new repo: uxagent sets up everything, including git, CI, and lint conventions.
  greenfield: { modules: { repo: true } },
  // An existing codebase: its own git, CI, lint, and PR conventions stay in charge.
  existing: { modules: { repo: false } },
};

export const DEFAULT_PATHS = {
  designSystem: 'design-system',
  source: 'src',
};

export const DEFAULT_VALIDATE = {
  include: null, // derived from paths.source when null
  ignore: ['**/node_modules/**'],
  tokenFiles: [],
  globalStylesheets: [],
  manifest: null,
  allowedGlobalClasses: [],
  allowedValues: [],
  allowedVariables: [],
  exemptions: [],
};

// What `uxagent init` writes for a preset. Kept minimal: anything equal to a default is
// left out, so a later change to a default reaches existing projects.
export function initialConfig({ preset = 'greenfield', agents = AGENT_TOOLS, paths = {} } = {}) {
  const config = {
    $schema: './config.schema.json',
    version: CONFIG_VERSION,
    preset,
    agents,
    paths: { ...DEFAULT_PATHS, ...paths },
    figma: { site: null, library: null },
    commands: Object.fromEntries(ROLES.map((role) => [role, null])),
    modules: {},
    skills: {},
    validate: {
      include: null,
      tokenFiles: [],
      globalStylesheets: [],
      manifest: null,
      allowedGlobalClasses: [],
      allowedVariables: [],
      exemptions: [],
    },
  };
  return config;
}
