// `uxagent sync`: re-apply managed files after an update or a change to ux/config.json.
import { loadConfig } from '../config/load.mjs';
import { VERSION, apply, describe, pending, plan } from './core.mjs';

export function sync({ root, cwd, check = false, force = false, log = console.log } = {}) {
  const config = loadConfig({ root, cwd });
  if (config.agentFiles !== 'package') {
    log(`uxagent sync: \`agentFiles: "${config.agentFiles}"\` in ux/config.json is not supported yet. Use "package".`);
    return { code: 2 };
  }
  const result = plan(config, { force });
  const changes = pending(result);
  if (!check) apply(result);

  const lines = describe(result, { applied: !check });
  if (check) {
    const drift = changes > 0 || result.edited.length > 0;
    log(drift ? 'uxagent sync --check: out of date. Run `npx uxagent sync`.' : 'uxagent sync --check: up to date.');
    for (const line of lines) log(line);
    return { code: drift ? 1 : 0, result };
  }
  if (result.previousVersion && result.previousVersion !== VERSION) {
    log(`uxagent sync: updated from ${result.previousVersion} to ${VERSION}.`);
  }
  log(changes ? 'uxagent sync: done.' : 'uxagent sync: nothing to change.');
  for (const line of lines) log(line);
  return { code: 0, result };
}

export async function cli(argv) {
  const unknown = argv.filter((a) => !['--check', '--force'].includes(a));
  if (unknown.length) {
    console.error(`uxagent sync: unknown option ${unknown[0]}. Options: --check, --force.`);
    return 2;
  }
  return sync({ check: argv.includes('--check'), force: argv.includes('--force') }).code;
}
