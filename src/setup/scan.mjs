// `npx uxagent setup`: what can be told about setup progress without judgment.
//
//   npx uxagent setup          Read-only. Prints the project's modules and Figma decision, how
//                              ux/setup-status.md compares with the checklist (new items, leftover
//                              rows, rows that should be n/a), and every stub that is still open.
//   npx uxagent setup --sync   Creates ux/setup-status.md with one row per checklist item, or adds
//                              rows for items the file doesn't have yet. Items of a module that is
//                              off (or Figma items when Figma is not used) start as `n/a`. Never
//                              changes or removes an existing row.
//
// Item and stub definitions are read from the checklist in the package
// (agents/skills/ux-setup/checklist.md); nothing is listed here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES } from '../config/defaults.mjs';
import { loadConfig } from '../config/load.mjs';

export const CHECKLIST = fileURLToPath(new URL('../../agents/skills/ux-setup/checklist.md', import.meta.url));
export const KNOWN_MODULES = ['core', ...MODULES];

// Cells of a Markdown table row whose first cell is a backticked id, or null.
const idRow = (line) => {
  if (!/^\|\s*`[a-z0-9-]+`\s*\|/.test(line)) return null;
  return line.split('|').slice(1, -1).map((cell) => cell.trim());
};
const unquote = (cell) => cell.replace(/^`+|`+$/g, '');

// Parses the checklist into items and stubs. Throws on a malformed table.
//   item: { id, who, level, module, needs, section }
//   stub: { id, kind: 'file' | 'config', where, marker, item }
export function parseChecklist(text = fs.readFileSync(CHECKLIST, 'utf8')) {
  const items = [];
  const stubs = [];
  let section = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim();
    const cells = idRow(line);
    if (!cells) continue;
    const id = unquote(cells[0]);
    if (section === 'Stubs') {
      if (cells.length !== 4) throw new Error(`checklist: stub row \`${id}\` needs 4 columns (is there a "|" in the marker?)`);
      const where = unquote(cells[1]);
      const isConfig = where.startsWith('config:');
      stubs.push({
        id,
        kind: isConfig ? 'config' : 'file',
        where: isConfig ? where.slice('config:'.length).trim() : where,
        marker: unquote(cells[2]),
        item: unquote(cells[3]),
      });
    } else if (/^\d+\. /.test(section)) {
      if (cells.length !== 7) throw new Error(`checklist: item row \`${id}\` needs 7 columns`);
      const module = unquote(cells[4]);
      if (!KNOWN_MODULES.includes(module)) throw new Error(`checklist: item \`${id}\` has unknown module \`${module}\``);
      const needs = [...cells[5].matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
      items.push({ id, who: cells[2], level: cells[3], module, needs, section: section.replace(/^\d+\. /, '') });
    }
  }
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error('checklist: duplicate item id');
  const stubIds = new Set();
  for (const stub of stubs) {
    if (stubIds.has(stub.id)) throw new Error(`checklist: duplicate stub id \`${stub.id}\``);
    stubIds.add(stub.id);
    if (!ids.has(stub.item)) throw new Error(`checklist: stub \`${stub.id}\` points at unknown item \`${stub.item}\``);
  }
  return { items, stubs };
}

// Why an item does not apply to this project, or null.
export function notApplicable(config, item) {
  if (!config.modules[item.module]) return `module \`${item.module}\` is off`;
  if (item.module === 'figma' && config.figma === false) return 'Figma is not used';
  return null;
}

// Checklist stubs name files by the default layout; map the design-system folder.
export function projectPath(config, rel) {
  if (rel === 'design-system' || rel.startsWith('design-system/')) {
    return config.paths.designSystem + rel.slice('design-system'.length);
  }
  return rel;
}

const configValue = (config, keyPath) =>
  keyPath.split('.').reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), config);

function parseStatus(config) {
  const file = config.abs(config.paths.setupStatus);
  if (!fs.existsSync(file)) return null;
  const rows = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const cells = idRow(line);
    if (cells) rows.set(unquote(cells[0]), { status: cells[1] ?? '', notes: cells[3] ?? '' });
  }
  return rows;
}

function lineNumbers(text, marker) {
  const lines = [];
  text.split('\n').forEach((line, index) => {
    if (line.includes(marker)) lines.push(index + 1);
  });
  return lines;
}

function figmaSummary(figma) {
  if (figma === false) return 'not used';
  if (figma.site === null || figma.library === null) {
    const missing = ['site', 'library'].filter((key) => figma[key] === null);
    return `undecided (no ${missing.join(' or ')} link in \`ux/config.json\`)`;
  }
  return 'used (links recorded)';
}

// Evaluates every stub: open, filled, gone (file missing), or off (its item does not apply).
function evaluateStubs(config, items, stubs) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const result = { open: [], filled: [], gone: [], off: [] };
  for (const stub of stubs) {
    const item = byId.get(stub.item);
    const why = notApplicable(config, item);
    if (why) {
      result.off.push({ ...stub, why });
    } else if (stub.kind === 'config') {
      (configValue(config, stub.where) === null ? result.open : result.filled).push({ ...stub, display: `config ${stub.where}` });
    } else {
      const rel = projectPath(config, stub.where);
      const file = config.abs(rel);
      if (!fs.existsSync(file)) {
        result.gone.push({ ...stub, display: rel });
        continue;
      }
      const lines = lineNumbers(fs.readFileSync(file, 'utf8'), stub.marker);
      if (lines.length) result.open.push({ ...stub, display: `${rel}:${lines.join(',')}` });
      else result.filled.push({ ...stub, display: rel });
    }
  }
  return result;
}

function scan(config) {
  const { items, stubs } = parseChecklist();
  const status = parseStatus(config);
  const statusRel = config.paths.setupStatus;
  const off = Object.entries(config.modules).filter(([, on]) => !on).map(([name]) => name);

  console.log('# Setup scan\n');
  console.log(`Project: ${config.root} (preset: ${config.preset})`);
  console.log(`Modules off: ${off.join(', ') || 'none'}`);
  console.log(`Figma: ${figmaSummary(config.figma)}`);
  const roles = (test) => Object.entries(config.commands).filter(([, c]) => test(c)).map(([role]) => role).join(', ') || 'none';
  console.log(`Commands wired: ${roles((c) => typeof c === 'string' && c !== 'n/a')}; not wired: ${roles((c) => c === null)}; n/a: ${roles((c) => c === 'n/a')}`);

  const notApplicableItems = items.map((item) => ({ item, why: notApplicable(config, item) })).filter((x) => x.why);

  console.log(`\n## Status file (${statusRel})\n`);
  if (!status) {
    console.log(`Missing. ${items.length} checklist items, none tracked yet. Run \`npx uxagent setup --sync\` to create it.`);
  } else {
    const known = new Set(items.map((item) => item.id));
    const fresh = items.filter((item) => !status.has(item.id));
    const leftover = [...status.keys()].filter((id) => !known.has(id));
    const counts = {};
    for (const [id, row] of status) {
      if (known.has(id)) counts[row.status || '(empty)'] = (counts[row.status || '(empty)'] ?? 0) + 1;
    }
    console.log(`${status.size} rows: ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ') || 'none'}`);
    console.log(`New in the checklist, not tracked yet: ${fresh.map((i) => i.id).join(', ') || 'none'}`);
    console.log(`Rows whose item is no longer in the checklist: ${leftover.join(', ') || 'none'}`);
    const shouldBeNa = notApplicableItems.filter(({ item }) => status.has(item.id) && !['n/a', 'opted out'].includes(status.get(item.id).status));
    console.log(`Rows that should be n/a: ${shouldBeNa.map(({ item, why }) => `${item.id} (${why})`).join(', ') || 'none'}`);
  }

  console.log('\n## Items that do not apply\n');
  console.log(`${notApplicableItems.length} of ${items.length} checklist items`);
  for (const { item, why } of notApplicableItems) console.log(`  n/a  ${item.id}  (${why})`);

  const { open, filled, gone, off: stubsOff } = evaluateStubs(config, items, stubs);
  console.log('\n## Stubs\n');
  console.log(`${open.length} open, ${filled.length} filled, ${gone.length} file gone, ${stubsOff.length} n/a (of ${stubs.length})\n`);
  const byItem = new Map();
  for (const stub of open) byItem.set(stub.item, [...(byItem.get(stub.item) ?? []), stub]);
  for (const [item, list] of byItem) {
    const tracked = status?.get(item)?.status;
    console.log(`${item}${tracked ? ` [${tracked}]` : ''}`);
    for (const stub of list) console.log(`  open  ${stub.id}  ${stub.display}`);
  }
  if (gone.length) {
    console.log('\nFile gone (not open: deleted on purpose, or never seeded):');
    for (const stub of gone) console.log(`  ${stub.id}  ${stub.display}  (${stub.item})`);
  }
  return 0;
}

const HEADER = `# Setup status

Where this project stands against the uxagent setup checklist. Written by \`/ux-setup\`; item
definitions are in the checklist that ships with the package
(\`node_modules/uxagent/agents/skills/ux-setup/checklist.md\`), so this file only records
progress. Edit a row by hand whenever that is quicker: tick off a step you did, or write
\`opted out\` to drop a tool.

Status is one of \`todo\`, \`waiting\` (on the item or person named in Notes), \`done\`,
\`opted out\`, or \`n/a\`. Checked is the date an agent or person last confirmed the row.

| Item | Status | Checked | Notes |
| --- | --- | --- | --- |
`;

function sync(config) {
  const { items } = parseChecklist();
  const status = parseStatus(config);
  const file = config.abs(config.paths.setupStatus);
  const today = new Date().toISOString().slice(0, 10);
  const row = (item) => {
    const why = notApplicable(config, item);
    return why ? `| \`${item.id}\` | n/a | ${today} | ${why} |` : `| \`${item.id}\` | todo | | |`;
  };
  if (!status) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, HEADER + items.map(row).join('\n') + '\n');
    console.log(`Created ${config.paths.setupStatus} with ${items.length} rows.`);
    return 0;
  }
  const fresh = items.filter((item) => !status.has(item.id));
  if (!fresh.length) {
    console.log(`${config.paths.setupStatus} already has a row for every checklist item.`);
    return 0;
  }
  // Append after the last table row, so text a person added below the table stays below it.
  const lines = fs.readFileSync(file, 'utf8').replace(/\n+$/, '').split('\n');
  let last = -1;
  lines.forEach((line, index) => {
    if (line.startsWith('|')) last = index;
  });
  if (last === -1) {
    console.error(`${config.paths.setupStatus} has no table to add rows to. Delete it and run \`npx uxagent setup --sync\` again.`);
    return 2;
  }
  lines.splice(last + 1, 0, ...fresh.map(row));
  fs.writeFileSync(file, lines.join('\n') + '\n');
  console.log(`Added ${fresh.length} rows to ${config.paths.setupStatus}: ${fresh.map((i) => i.id).join(', ')}`);
  return 0;
}

export async function cli(argv) {
  const unknown = argv.filter((arg) => arg !== '--sync');
  if (unknown.length) {
    console.error(`uxagent setup: unknown argument \`${unknown[0]}\`. Use no argument to scan, or --sync.`);
    return 1;
  }
  const config = loadConfig();
  try {
    return argv.includes('--sync') ? sync(config) : scan(config);
  } catch (err) {
    if (err.message.startsWith('checklist:')) {
      console.error(err.message);
      return 2;
    }
    throw err;
  }
}
