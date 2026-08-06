import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../src/adapters/real/db.ts";
import { WorkRepo } from "../src/adapters/real/workRepo.ts";
import { optionalArg, optionalIntArg, parseArgs } from "./cli.ts";

function uuid(seed: number): string {
  const h =
    ((seed * 2_654_435_761) >>> 0).toString(16).padStart(8, "0") +
    seed.toString(16).padStart(8, "0");
  return `${h.slice(0, 8)}-${h.slice(0, 4)}-4${h.slice(1, 4)}-8${h.slice(2, 5)}-${h.slice(0, 12)}`;
}

function seedHighCardinality(
  dir: string,
  workCount: number,
  uniqueTagCount: number,
  tagsPerWork: number,
): { db: ReturnType<typeof openDb>; repo: WorkRepo } {
  mkdirSync(join(dir, "db"), { recursive: true });
  const db = openDb({
    kind: "files",
    catalogPath: `${dir}/db/catalog.sqlite`,
    userPath: `${dir}/db/user.sqlite`,
  });
  const repo = new WorkRepo(db);
  const sqlite = db.sqlite;
  sqlite.exec("BEGIN");
  const insertWork = sqlite.prepare(`
    INSERT INTO works (
      id, title, title_sort_key, status, physical_path, meta_path,
      total_duration_sec, track_count, urls_json, playlists_json
    ) VALUES (?, ?, ?, 'ok', ?, ?, 10, 1, '[]', '[]')
  `);
  const insertWorkState = sqlite.prepare(`
    INSERT INTO work_states (work_id, added_at, bookmarked)
    VALUES (?, '2026-07-19T00:00:00.000Z', 0)
  `);
  for (let i = 0; i < workCount; i++) {
    const id = uuid(i);
    const title = `作品${i}`;
    insertWork.run(id, title, title, `/lib/${i}`, `/lib/${i}/mimimilli.json`);
    insertWorkState.run(id);
  }
  const insertTag = sqlite.prepare(
    "INSERT INTO tags (name, search_key, facet_sort_key) VALUES (?, ?, ?)",
  );
  const tagIds: number[] = [];
  for (let t = 0; t < uniqueTagCount; t++) {
    const name = `カテゴリ${t % 200}/固有値${t}`;
    const res = insertTag.run(name, name, name);
    tagIds.push(Number(res.lastInsertRowid));
  }
  const insertWorkTag = sqlite.prepare("INSERT INTO work_tags (work_id, tag_id) VALUES (?, ?)");
  for (let i = 0; i < workCount; i++) {
    const workId = uuid(i);
    for (let t = 0; t < tagsPerWork; t++) {
      const tagIdx = (i * tagsPerWork + t) % uniqueTagCount;
      insertWorkTag.run(workId, tagIds[tagIdx]!);
    }
  }
  sqlite.exec("COMMIT");
  return { db, repo };
}

function timeListSummaries(repo: WorkRepo): {
  firstMs: number;
  secondMs: number;
  summaryCount: number;
} {
  const t0 = performance.now();
  const first = repo.listSummaries();
  const t1 = performance.now();
  repo.listSummaries();
  const t2 = performance.now();
  return {
    firstMs: t1 - t0,
    secondMs: t2 - t1,
    summaryCount: first.summaries.length,
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const uniqueTagCount = optionalIntArg(args, "unique-tags", 20_000);
  const workCount = optionalIntArg(args, "works", 3_000);
  const tagsPerWork = optionalIntArg(args, "tags-per-work", 6);
  const outDir = optionalArg(args, "out-dir") ?? "/tmp/mimimilli-bench-hc";

  const dir = join(outDir, `hc-${uniqueTagCount}`);
  const { db, repo } = seedHighCardinality(dir, workCount, uniqueTagCount, tagsPerWork);
  const result = timeListSummaries(repo);
  db.close();

  console.log(
    JSON.stringify(
      {
        uniqueTagCount,
        workCount,
        tagsPerWork,
        summaryCount: result.summaryCount,
        firstMs: Number(result.firstMs.toFixed(2)),
        secondMs: Number(result.secondMs.toFixed(2)),
        secondNotSlowerThanFirst: result.secondMs <= result.firstMs * 1.1,
      },
      null,
      2,
    ),
  );
}

main();
