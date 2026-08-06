import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDb } from "../src/adapters/real/db.ts";
import { parseArgs, requireArg } from "./cli.ts";
import type { BenchManifest } from "./manifest.ts";

function loadManifest(dir: string): BenchManifest {
  const raw = readFileSync(join(dir, "manifest.json"), "utf8");
  return JSON.parse(raw) as BenchManifest;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = resolve(requireArg(args, "data-dir"));
  const manifest = loadManifest(dataDir);
  const db = openDb({
    kind: "files",
    catalogPath: manifest.catalogDb,
    userPath: manifest.userDb,
  });

  const workCount = (
    db.sqlite.query("SELECT COUNT(*) AS count FROM main.works").get() as { count: number }
  ).count;
  const tagRowCount = (
    db.sqlite.query("SELECT COUNT(*) AS count FROM main.work_tags").get() as { count: number }
  ).count;
  const uniqueTagNames = (
    db.sqlite.query("SELECT COUNT(*) AS count FROM main.tags").get() as { count: number }
  ).count;
  const avgTagsPerWork = tagRowCount / workCount;

  console.log(
    JSON.stringify(
      {
        workCount,
        tagAssignments: tagRowCount,
        uniqueTagNames,
        avgTagsPerWork: Number(avgTagsPerWork.toFixed(2)),
        duplicateRate: Number((1 - uniqueTagNames / tagRowCount).toFixed(4)),
        memoizationUpperBoundCallsPerListSummaries: uniqueTagNames,
      },
      null,
      2,
    ),
  );

  db.close();
}

main();
