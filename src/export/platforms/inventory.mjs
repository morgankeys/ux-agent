// Lists registry rows and whether the source path exists. The skill uses this
// to decide what it may port. Placeholder rows are omitted.
import { existsSync } from "node:fs";
import { readInventory } from "./components.mjs";

export function inventory(config) {
  const rows = readInventory(config);
  if (!rows.length) {
    console.log("No components in the inventory.");
    return 0;
  }
  for (const row of rows) {
    const state = !row.code ? "no code path" : existsSync(config.abs(row.code)) ? "present" : "missing";
    console.log(`${row.name}\t${row.code || "—"}\t${state}`);
  }
  return 0;
}
