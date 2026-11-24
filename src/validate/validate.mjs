// `validate`: design-system validation. Rewrites the deviations backlog, prints a
// summary, and exits 0 with deviations present, 1 on any scoping error (or, with
// --strict, any deviation), 2 when it could not run. Contract: "Exit codes and CI" in
// design-in-code.md (agents/reference/). Run as `npx uxagent validate [--strict]`.
import path from 'node:path';
import stylelint from 'stylelint';
import { writeBacklog } from './backlog.mjs';
import { designSystemConfig } from './stylelint-config.mjs';
import { ConfigError, GATE_RULES, loadSettings } from './settings.mjs';
import { findRoot } from '../config/load.mjs';

const RULE_SUFFIX = / \(ds\/[a-z0-9-]+\)$/;
const CONTRACT = "the validator contract (design-in-code.md in uxagent's reference docs)";

// `root` is the project root; when omitted it is found from `cwd` (default: the current folder).
export async function validate({ root, cwd = process.cwd(), strict = false, log = console.log } = {}) {
  let settings;
  let config;
  try {
    const projectRoot = root ?? findRoot(cwd);
    if (!projectRoot) throw new ConfigError('No ux/config.json found here or in a parent folder. Run `npx uxagent init` first.');
    settings = loadSettings(projectRoot);
    config = designSystemConfig({ root: settings.root });
  } catch (err) {
    if (err instanceof ConfigError) {
      log(`validate: ${err.message}`);
      return { code: 2 };
    }
    throw err;
  }

  const result = await stylelint.lint({
    files: settings.include,
    ignorePattern: [...settings.ignore, ...settings.tokenFiles],
    cwd: settings.root,
    config,
    configBasedir: settings.root,
    allowEmptyInput: true,
  });

  const rel = (file) => path.relative(settings.root, file).split(path.sep).join('/');
  const seen = new Set();
  const deviations = [];
  const scopingErrors = [];
  const broken = [];
  for (const r of result.results) {
    if (!r.source) continue;
    for (const w of r.warnings) {
      if (w.rule === 'CssSyntaxError') {
        broken.push(`${rel(r.source)}:${w.line}  ${w.text}`);
        continue;
      }
      if (!w.rule?.startsWith('ds/')) continue;
      const finding = { file: rel(r.source), line: w.line, rule: w.rule.slice(3), detail: w.text.replace(RULE_SUFFIX, '') };
      const k = `${finding.file}|${finding.line}|${finding.rule}|${finding.detail}`;
      if (seen.has(k)) continue;
      seen.add(k);
      (GATE_RULES.includes(finding.rule) ? scopingErrors : deviations).push(finding);
    }
    for (const w of r.invalidOptionWarnings ?? []) broken.push(`${rel(r.source)}  ${w.text}`);
  }

  if (broken.length) {
    log('validate: some styles could not be parsed. Fix them (run `lint`), then validate again:');
    for (const b of broken) log(`  ${b}`);
    return { code: 2, deviations, scopingErrors };
  }

  const changed = writeBacklog(settings.backlogPath, deviations);

  const counts = {};
  for (const d of deviations) counts[d.rule] = (counts[d.rule] ?? 0) + 1;
  log(`validate: ${deviations.length} deviation${deviations.length === 1 ? '' : 's'}.`);
  for (const [rule, n] of Object.entries(counts).sort()) log(`  ${rule}: ${n}`);
  log(`  Backlog ${changed ? 'updated' : 'unchanged'}: ${rel(settings.backlogPath)}`);

  for (const w of usageMapWarnings(settings)) log(`warning: ${w}`);

  if (scopingErrors.length) {
    log(`validate: ${scopingErrors.length} scoping error${scopingErrors.length === 1 ? '' : 's'}. Move each style to its home`);
    log(`  (see "Scoping: global or component" in ${CONTRACT}):`);
    for (const e of scopingErrors.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      log(`  ${e.file}:${e.line}  ${e.rule}  ${e.detail}`);
    }
  }

  const code = scopingErrors.length || (strict && deviations.length) ? 1 : 0;
  return { code, deviations, scopingErrors, changed };
}

export function usageMapWarnings(settings) {
  if (!settings.manifest) {
    return ['No token manifest found, so Figma scope checks are off. Set `validate.manifest` in ux/config.json once `tokens` writes one.'];
  }
  const names = Object.keys(settings.manifest).filter((n) => n.startsWith(settings.prefix));
  const out = [];
  for (const g of settings.usage.groups) {
    const hit = names.some((n) => (!g.collection || settings.manifest[n]?.collection === g.collection) && g.match(n.slice(settings.prefix.length)));
    if (!hit) out.push(`usage-map group \`${g.id}\` matches no token in the manifest.`);
  }
  return out;
}

// `npx uxagent validate [--strict]`. Returns the exit code.
export async function cli(argv = [], { cwd = process.cwd(), log = console.log } = {}) {
  const unknown = argv.filter((a) => a !== '--strict');
  if (unknown.length) {
    log(`validate: unknown option \`${unknown[0]}\`. Usage: npx uxagent validate [--strict]`);
    return 2;
  }
  const { code } = await validate({ cwd, strict: argv.includes('--strict'), log });
  return code;
}
