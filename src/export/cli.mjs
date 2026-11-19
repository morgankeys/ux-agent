// `uxagent export ...`: DESIGN.md helpers, the platform packages, and the port report.
import { loadConfig } from "../config/load.mjs";

const USAGE = `Usage: uxagent export <subcommand>

  design-md collect                 Print the bundle /export-design-md writes DESIGN.md from.
  design-md lint [file]             Lint DESIGN.md (default: the configured path) with Google's linter.
  platforms [targets...]            Write the platform packages (default: all targets).
        --list                      List the targets.
        --self-test                 Run the exporter against a throwaway project.
        --out <dir>                 Write here instead of the configured platform exports folder.
        --repo <dir>                Use the project at <dir> instead of the current one.
        --components <dir>          Read the component manifest from <dir>.
  port-report <component file>      Print the class names and data attributes a port must keep.
  inventory                         List the component registry rows and whether their source exists.`;

export async function cli(argv) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case "design-md": {
      const [action, arg] = rest;
      if (action !== "collect" && action !== "lint") break;
      const config = loadConfig();
      const mod = await import("./design-md/design-md.mjs");
      return action === "collect" ? mod.collect(config) : mod.lint(config, arg);
    }
    case "platforms":
      return (await import("./platforms/export.mjs")).platforms(rest);
    case "port-report":
      if (!rest[0]) break;
      return (await import("./platforms/port-report.mjs")).portReport(rest[0]);
    case "inventory":
      return (await import("./platforms/inventory.mjs")).inventory(loadConfig());
    default:
  }
  console.error(USAGE);
  return 1;
}
