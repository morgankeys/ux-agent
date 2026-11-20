// Prints the class names and data attributes on a source file, so a port can
// match them. Usage: uxagent export port-report <component file>
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractContract } from "./components.mjs";

export function portReport(file) {
  const contract = extractContract(readFileSync(resolve(file), "utf8"));
  console.log(`classes: ${[...contract.classes].join(" ") || "(none)"}`);
  console.log(`data: ${[...contract.dataAttrs].join(" ") || "(none)"}`);
  return 0;
}
