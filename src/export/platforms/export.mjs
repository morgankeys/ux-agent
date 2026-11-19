// Design system -> platform packages. Deterministic. Reads the project's source files only to
// validate a component manifest the skill has already written.
//
//   uxagent export platforms [targets...] [--list] [--self-test] [--out <dir>]
//                            [--repo <project dir>] [--components <dir>]
//
// Exit 3 when there is nothing to export. A rejected component is skipped
// and named; the docs package is still written.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadConfig } from "../../config/load.mjs";
import { loadComponents } from "./components.mjs";
import { buildModel } from "./model.mjs";
import { TARGETS, renderArchives } from "./targets.mjs";
import { readGuidelines, tokenGroups } from "../design-md/read-docs.mjs";

export function parseArgs(argv) {
  const opts = { targets: [], out: null, repo: null, components: null, selfTest: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") opts.list = true;
    else if (arg === "--self-test") opts.selfTest = true;
    else if (arg === "--out" || arg === "--repo" || arg === "--components") {
      if (argv[i + 1] === undefined) throw new Error(`${arg} needs a value`);
      opts[arg.slice(2)] = resolve(argv[++i]);
    } else if (arg.startsWith("--")) throw new Error(`unknown flag ${arg}`);
    else opts.targets.push(arg);
  }
  return opts;
}

export function exportDesignSystem({ config, out, componentsDir, targets }) {
  const chosen = targets.length ? targets : Object.keys(TARGETS);
  for (const id of chosen) {
    if (!TARGETS[id]) throw new Error(`unknown target ${id}. Known: ${Object.keys(TARGETS).join(", ")}`);
  }
  const guidelines = readGuidelines(config);
  const groups = tokenGroups(config);
  const tokenCount = groups.reduce((n, group) => n + group.tokens.length, 0);
  if (!guidelines.length && !tokenCount) {
    const error = new Error("Nothing to export yet: every guideline is a stub and there are no tokens.");
    error.code = 3;
    throw error;
  }
  const loaded = loadComponents(config, componentsDir);
  const model = buildModel(config, loaded.components);
  model.warnings.push(...loaded.skipped.map((line) => `component skipped: ${line}`));
  const built = chosen.map((id) => ({ id, result: TARGETS[id].build(model) }));
  const dest = out ?? config.abs(config.paths.platformExports);
  rmSync(dest, { recursive: true, force: true });
  for (const { id, result } of built) {
    const dir = join(dest, id);
    for (const [path, content] of Object.entries(result.files)) {
      const file = join(dir, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    for (const [name, bytes] of Object.entries(renderArchives(result.archives ?? []))) {
      writeFileSync(join(dir, name), bytes);
    }
  }
  return { dest, warnings: model.warnings, components: loaded.components.map((component) => component.name) };
}

export async function platforms(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    return 1;
  }
  if (opts.list) {
    for (const [id, target] of Object.entries(TARGETS)) console.log(`${id}\t${target.title}`);
    return 0;
  }
  if (opts.selfTest) {
    try {
      (await import("./self-test.mjs")).selfTest();
      return 0;
    } catch (err) {
      console.error(`self-test failed: ${err.message}`);
      return 1;
    }
  }
  const config = loadConfig(opts.repo ? { root: opts.repo } : {});
  try {
    const result = exportDesignSystem({
      config,
      out: opts.out,
      componentsDir: opts.components ?? config.abs(config.paths.platformComponents),
      targets: opts.targets,
    });
    console.log(`Wrote ${result.dest}`);
    console.log(result.components.length ? `Components: ${result.components.join(", ")}` : "Components: none");
    for (const warning of result.warnings) console.error(`warning: ${warning}`);
    return 0;
  } catch (err) {
    console.error(err.message);
    return err.code === 3 ? 3 : 1;
  }
}
