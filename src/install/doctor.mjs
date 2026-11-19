// `uxagent doctor`: is the install whole and current?
import fs from 'node:fs';
import path from 'node:path';
import { LOCK_REL } from '../config/defaults.mjs';
import { loadConfig } from '../config/load.mjs';
import { VERSION, pending, plan } from './core.mjs';

export function doctor({ root, cwd, log = console.log } = {}) {
  const config = loadConfig({ root, cwd });
  const result = plan(config);
  const problems = [];

  if (!result.pkg.installed) {
    problems.push('uxagent is not installed in this project. Add it as a dev dependency and install, so agents can read its skills.');
  }
  if (!fs.existsSync(path.join(config.root, LOCK_REL))) {
    problems.push(`${LOCK_REL} is missing. Run \`npx uxagent sync\`.`);
  } else if (result.previousVersion !== VERSION) {
    problems.push(`This repo was last synced with uxagent ${result.previousVersion}; ${VERSION} is installed. Run \`npx uxagent sync\`.`);
  } else if (pending(result)) {
    const names = [...result.writes.map((w) => w.path), ...result.deletes];
    problems.push(`Out of date: ${names.slice(0, 5).join(', ')}${names.length > 5 ? `, and ${names.length - 5} more` : ''}. Run \`npx uxagent sync\`.`);
  }
  for (const rel of result.edited) {
    problems.push(`${rel} is managed by uxagent but was edited by hand. Run \`npx uxagent sync --force\` to replace it, or eject the file it points to.`);
  }
  for (const o of result.overrides) problems.push(`${o.path} ${o.problem}`);

  if (problems.length) {
    log(`uxagent doctor: ${problems.length} problem${problems.length === 1 ? '' : 's'}.`);
    for (const p of problems) log(`  - ${p}`);
  } else {
    log(`uxagent doctor: ok (uxagent ${VERSION}, preset ${config.preset}).`);
  }
  for (const k of result.kept) log(`  Note: ${k.path}: ${k.reason}.`);
  return { code: problems.length ? 1 : 0, problems };
}

export async function cli(argv) {
  if (argv.length) {
    console.error(`uxagent doctor: unknown option ${argv[0]}.`);
    return 2;
  }
  return doctor().code;
}
