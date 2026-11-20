// Structural agreement between files that describe the same thing. Wording still needs a
// review; this catches the drift a script can see.
//   node test/docs/docs-agree.mjs
import fs from 'node:fs';
import path from 'node:path';
import { MODULES, ROLES } from '../../src/config/defaults.mjs';
import { ROOT, codeIn, exists, read, report, tableRows, trackedFiles } from './lib.mjs';

const problems = [];
const manifest = JSON.parse(read('agents/manifest.json'));
const modules = new Set(['core', ...MODULES]);

const frontmatterName = (rel) => /^---\n[\s\S]*?^name:\s*(.+)$[\s\S]*?\n---/m.exec(read(rel))?.[1].trim();

// 1. The manifest lists exactly the skills that exist, each named after its folder.
const skillDirs = fs
  .readdirSync(path.join(ROOT, 'agents/skills'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const listed = manifest.skills.map((s) => s.name);
for (const skill of skillDirs) {
  const source = `agents/skills/${skill}/SKILL.md`;
  if (!exists(source)) {
    problems.push(`${source} is missing.`);
    continue;
  }
  if (frontmatterName(source) !== skill) problems.push(`${source}: frontmatter name is \`${frontmatterName(source)}\`, not \`${skill}\`.`);
  if (!/^description:/m.test(read(source))) problems.push(`${source} has no description.`);
  if (!listed.includes(skill)) problems.push(`agents/manifest.json doesn't list the skill \`${skill}\`.`);
}
for (const skill of listed) {
  if (!skillDirs.includes(skill)) problems.push(`agents/manifest.json lists \`${skill}\`, which has no folder in agents/skills/.`);
}

// 2. Every manifest entry names a known module and a file that exists; every skill has a
//    routing row and a line in the index.
const seededPath = (rel) => {
  if (rel === 'ux/config.json') return 'src/config/defaults.mjs'; // written by init, not seeded
  for (const [prefix, dir] of [['ux/', 'templates/ux/'], ['design-system/', 'templates/design-system/']]) {
    if (rel.startsWith(prefix)) return dir + rel.slice(prefix.length);
  }
  return null;
};
for (const entry of [...manifest.skills, ...manifest.routes, ...manifest.cursorRules]) {
  if (!modules.has(entry.module)) problems.push(`agents/manifest.json: \`${entry.name ?? entry.read}\` has unknown module \`${entry.module}\`.`);
}
for (const route of manifest.routes) {
  const target = route.read.startsWith('project:') ? seededPath(route.read.slice('project:'.length)) : `agents/${route.read}`;
  if (!target || !exists(target)) problems.push(`agents/manifest.json routes to \`${route.read}\`, which doesn't exist.`);
  if (route.skill && !listed.includes(route.skill)) problems.push(`agents/manifest.json: a route names the skill \`${route.skill}\`, which isn't listed.`);
}
const index = read('agents/README.md');
for (const skill of manifest.skills) {
  if (!manifest.routes.some((r) => r.skill === skill.name && r.read === `skills/${skill.name}/SKILL.md`)) {
    problems.push(`agents/manifest.json has no routing row for the skill \`${skill.name}\`.`);
  }
  if (!index.includes(`\`${skill.name}\``)) problems.push(`agents/README.md doesn't list \`${skill.name}\`.`);
}
for (const rule of manifest.cursorRules) {
  if (!exists(`templates/cursor/rules/${rule.name}.mdc`)) problems.push(`templates/cursor/rules/${rule.name}.mdc is missing.`);
}

// 3. Every `{{doc:…}}` in a template names a packaged file.
for (const file of ['templates/agents-block.md', ...trackedFiles('templates/cursor/rules/*.mdc')]) {
  for (const m of read(file).matchAll(/\{\{doc:([^}]+)\}\}/g)) {
    if (!exists(`agents/${m[1]}`)) problems.push(`${file} points at \`${m[1]}\`, which doesn't exist under agents/.`);
  }
}

// 4. The validator contract and the validator name the same rules, and agree on which are
//    scoping errors.
const contract = read('agents/reference/design-in-code.md');
const contractRules = [...tableRows(contract, '## Validator contract'), ...tableRows(contract, '### Usage rules')]
  .map(([rule, flags]) => ({ id: codeIn(rule), gate: /\*\*Scoping error\.\*\*/.test(flags ?? '') }))
  .filter((r) => r.id);
const settings = read('src/validate/settings.mjs');
const listOf = (name) => [...(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`).exec(settings)?.[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
const built = new Set([...listOf('DEVIATION_RULES'), ...listOf('GATE_RULES')]);
const builtGates = new Set(listOf('GATE_RULES'));
if (!contractRules.length || !built.size) problems.push('Could not read the rules from the contract or from src/validate/settings.mjs.');
for (const r of contractRules) {
  if (!built.has(r.id)) problems.push(`Rule \`${r.id}\` is in the contract but not in the validator.`);
  if (r.gate !== builtGates.has(r.id)) problems.push(`Rule \`${r.id}\`: the contract and the validator disagree on whether it is a scoping error.`);
}
for (const id of built) {
  if (!contractRules.some((r) => r.id === id)) problems.push(`Rule \`${id}\` is in the validator but not in the contract.`);
}

// 5. The setup checklist is self-consistent. (test/setup/ checks it against the scan and
//    the templates.) Columns: Item, What, Who, Level, Module, Needs, Done when.
const checklist = read('agents/skills/ux-setup/checklist.md');
const sections = checklist.split('\n').filter((l) => /^## \d+\. /.test(l));
const items = sections.flatMap((h) => tableRows(checklist, h)).map((row) => ({ id: codeIn(row[0]), module: codeIn(row[4]) ?? row[4], needs: row[5] ?? '' }));
const ids = new Set();
for (const { id, module } of items) {
  if (ids.has(id)) problems.push(`Checklist item \`${id}\` is defined twice.`);
  ids.add(id);
  if (!modules.has(module)) problems.push(`Checklist item \`${id}\` has unknown module \`${module}\`.`);
}
for (const { id, needs } of items) {
  for (const m of needs.matchAll(/`([a-z0-9-]+)`/g)) {
    if (!ids.has(m[1])) problems.push(`Checklist item \`${id}\` needs \`${m[1]}\`, which is not an item.`);
  }
}
for (const row of tableRows(checklist, '## Stubs')) {
  const item = codeIn(row[3]);
  if (item && !ids.has(item)) problems.push(`Stub ${codeIn(row[0])} belongs to \`${item}\`, which is not an item.`);
}

// 6. Every role the seeded CI workflow runs is a known role.
const ci = read('templates/github/workflows/ci.yml');
for (const m of ci.matchAll(/^\s*- name: ([a-z-]+)\s*$/gm)) {
  if (m[1] !== 'setup' && !ROLES.includes(m[1])) problems.push(`templates/github/workflows/ci.yml runs \`${m[1]}\`, which is not a role.`);
}

// 7. Nothing shipped still describes the old template layout.
const stale = /\b(Code|Docs|Agents|Export)\/|new-prototype|template-only|prototyping-kit|ds-validate\.config/;
for (const file of trackedFiles('agents', 'templates')) {
  read(file).split('\n').forEach((line, i) => {
    if (stale.test(line)) problems.push(`${file}:${i + 1} still names the old template layout: ${line.trim().slice(0, 80)}`);
  });
}

report('docs agree', problems);
