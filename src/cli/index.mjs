// Command dispatch. Each command module exports `cli(argv)` and returns an exit code;
// modules are loaded on demand so `uxagent validate` doesn't pay for the installer.
import fs from 'node:fs';
import { ConfigError } from '../config/load.mjs';

const COMMANDS = {
  init: { load: () => import('../install/init.mjs'), help: 'Set uxagent up in this repo (creates ux/ and design-system/, wires agent files).' },
  sync: { load: () => import('../install/sync.mjs'), help: 'Re-apply uxagent\'s managed files after an update or a config change. --check only reports.' },
  doctor: { load: () => import('../install/doctor.mjs'), help: 'Check the install: missing or edited managed files, overrides with upstream changes.' },
  eject: { load: () => import('../install/eject.mjs'), help: 'Copy a skill or context file into ux/overrides/ so the project can change it.' },
  restore: { load: () => import('../install/eject.mjs'), help: 'Drop an override and go back to the packaged file.', entry: 'restoreCli' },
  validate: { load: () => import('../validate/validate.mjs'), help: 'Design-system validation. Writes the deviations backlog; fails on scoping errors. --strict fails on any deviation.' },
  setup: { load: () => import('../setup/scan.mjs'), help: 'Report setup progress against the checklist. --sync creates or updates ux/setup-status.md.' },
  export: { load: () => import('../export/cli.mjs'), help: 'Export the design system: `export design-md collect|lint`, `export platforms [targets]`, `export port-report <file>`.' },
};

function usage() {
  const lines = ['Usage: uxagent <command> [options]', ''];
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  for (const [name, { help }] of Object.entries(COMMANDS)) lines.push(`  ${name.padEnd(width)}  ${help}`);
  lines.push('', '  --version  Print the installed version.');
  return lines.join('\n');
}

export async function main(argv) {
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help' || name === '-h') {
    console.log(usage());
    return name ? 0 : 1;
  }
  if (name === '--version' || name === '-v') {
    console.log(JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version);
    return 0;
  }
  const command = COMMANDS[name];
  if (!command) {
    console.error(`uxagent: unknown command \`${name}\`.\n\n${usage()}`);
    return 1;
  }
  try {
    const mod = await command.load();
    return (await mod[command.entry ?? 'cli'](rest)) ?? 0;
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`uxagent ${name}: ${err.message}`);
      return 2;
    }
    throw err;
  }
}
