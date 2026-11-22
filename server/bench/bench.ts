import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  WORKS_DEFAULT_PAGE_SIZE,
  type Condition,
  type GroupBy,
  type SortId,
} from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { createRealAdapter } from "../src/adapters/real/index.ts";
import { openDb } from "../src/adapters/real/db.ts";
import { WorkQueryRepository } from "../src/adapters/real/workQueryRepository.ts";
import { optionalArg, optionalIntArg, parseArgs, requireArg } from "./cli.ts";
import type { BenchManifest } from "./manifest.ts";
import { summarizeLatencies, type LatencyStats } from "./stats.ts";

export interface BenchCaseResult {
  name: string;
  path: string;
  stats: LatencyStats;
}

export interface BenchReport {
  generatedAt: string;
  manifest: BenchManifest;
  warmup: number;
  iterations: number;
  cases: BenchCaseResult[];
}

function loadManifest(dir: string): BenchManifest {
  const raw = readFileSync(join(dir, "manifest.json"), "utf8");
  return JSON.parse(raw) as BenchManifest;
}

async function measureCase(
  name: string,
  path: string,
  run: () => Promise<Response>,
  warmup: number,
  iterations: number,
): Promise<BenchCaseResult> {
  for (let i = 0; i < warmup; i++) {
    const res = await run();
    await res.arrayBuffer().catch(() => undefined);
  }
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const res = await run();
    await res.arrayBuffer().catch(() => undefined);
    if (res.status >= 400) {
      throw new Error(`${name}: HTTP ${res.status}`);
    }
    samples.push(performance.now() - start);
  }
  return { name, path, stats: summarizeLatencies(samples) };
}

function formatMarkdown(report: BenchReport): string {
  const lines = [
    "# Performance baseline",
    "",
    `Generated: ${report.generatedAt}`,
    `Works: ${report.manifest.workCount}`,
    `Warmup: ${report.warmup}, Iterations: ${report.iterations}`,
    "",
    "| Case | Path | p50 (ms) | p95 (ms) |",
    "| --- | --- | ---: | ---: |",
  ];
  for (const row of report.cases) {
    lines.push(
      `| ${row.name} | \`${row.path}\` | ${row.stats.p50.toFixed(2)} | ${row.stats.p95.toFixed(2)} |`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = resolve(requireArg(args, "data-dir"));
  const outDir = resolve(optionalArg(args, "out-dir") ?? dataDir);
  const warmup = optionalIntArg(args, "warmup", 3);
  const iterations = optionalIntArg(args, "iterations", 20);

  const manifest = loadManifest(dataDir);
  const adapter = createRealAdapter({
    database: { kind: "files", catalogPath: manifest.catalogDb, userPath: manifest.userDb },
    dataRoot: dirname(manifest.catalogDb),
    thumbnailCacheDir: join(dataDir, "cache", "thumbnails"),
    dlsiteCache: { path: join(dataDir, "db", "dlsite-cache.sqlite") },
  });
  const app = createApp(adapter);
  const request = (path: string) => app.request(path, { headers: { Host: "127.0.0.1:8080" } });

  const cases: Array<{ name: string; path: string; run: () => Promise<Response> }> = [
    {
      name: "works-page-1",
      path: "/api/works",
      run: async () => request("/api/works"),
    },
    {
      name: "works-deep-page",
      path: `/api/works?page=${manifest.deepPage}`,
      run: async () => request(`/api/works?page=${manifest.deepPage}`),
    },
    {
      name: "works-search-q",
      path: `/api/works?q=${encodeURIComponent(manifest.sampleSearchQ)}`,
      run: async () => request(`/api/works?q=${encodeURIComponent(manifest.sampleSearchQ)}`),
    },
    {
      name: "works-search-tag",
      path: `/api/works?tags=${encodeURIComponent(manifest.sampleTag)}`,
      run: async () => request(`/api/works?tags=${encodeURIComponent(manifest.sampleTag)}`),
    },
    ...manifest.sorts.map((sort) => {
      const query =
        sort === "random" ? `sort=random&seed=42&limit=${WORKS_DEFAULT_PAGE_SIZE}` : `sort=${sort}`;
      const path = `/api/works?${query}`;
      return {
        name: `works-sort-${sort}`,
        path,
        run: async () => request(path),
      };
    }),
    {
      name: "smart-folder-no-rules",
      path: `/api/smart-folders/${manifest.smartFolderNoRulesId}/works?sort=added-desc`,
      run: async () =>
        request(`/api/smart-folders/${manifest.smartFolderNoRulesId}/works?sort=added-desc`),
    },
    {
      name: "smart-folder-with-rules",
      path: `/api/smart-folders/${manifest.smartFolderWithRulesId}/works?sort=added-desc`,
      run: async () =>
        request(`/api/smart-folders/${manifest.smartFolderWithRulesId}/works?sort=added-desc`),
    },
    ...["cv", "サークル", "tag", "year"].map((axis) => {
      const path = `/api/axes/${encodeURIComponent(axis)}`;
      return { name: `values-${axis}`, path, run: async () => request(path) };
    }),
    {
      name: "values-cv-in-smart-folder",
      path: `/api/smart-folders/${manifest.smartFolderWithRulesId}/groups`,
      run: async () =>
        app.request(`/api/smart-folders/${manifest.smartFolderWithRulesId}/groups`, {
          method: "POST",
          headers: { Host: "127.0.0.1:8080", "Content-Type": "application/json" },
          body: JSON.stringify({ groupBy: { kind: "prefix", prefix: "cv" } }),
        }),
    },
    {
      name: "counts-views",
      path: "/api/works?view=<recent|added|fav|error>&limit=1",
      run: async () => {
        let last: Response = new Response(null, { status: 200 });
        for (const view of ["recent", "added", "fav", "error"]) {
          last = await request(`/api/works?view=${view}&limit=1`);
          await last.arrayBuffer();
        }
        return last;
      },
    },
    {
      name: "counts-smart-folders",
      path: "/api/smart-folders",
      run: async () => request("/api/smart-folders"),
    },
    {
      name: "fs-root",
      path: "/api/fs",
      run: async () => request("/api/fs"),
    },
    {
      name: "media-audio-resolve",
      path: `/api/media/audio/${manifest.sampleWorkId}/${manifest.sampleAudioRelPath}`,
      run: async () =>
        request(`/api/media/audio/${manifest.sampleWorkId}/${manifest.sampleAudioRelPath}`),
    },
  ];

  const countConditions: Condition[] = [
    { type: "and", children: [{ type: "played" }] },
    { type: "and", children: [{ type: "added", withinDays: 30 }] },
    { type: "and", children: [{ type: "bookmarked" }] },
    { type: "and", children: [{ type: "hasError" }] },
  ];
  const ctx = { now: Date.now() };
  const emptyCondition: Condition = { type: "and", children: [] };
  const cvCondition: Condition = {
    type: "and",
    children: [{ type: "tag", tag: manifest.sampleTag }],
  };
  const listQuery = (condition: Condition, sort: SortId, page = 1, seed?: number) => ({
    condition,
    sort,
    seed,
    page,
    limit: WORKS_DEFAULT_PAGE_SIZE,
  });
  const done = async () => new Response(null, { status: 200 });
  const conditionCases: typeof cases = [
    {
      name: "cond-list-page-1",
      path: "(adapter.queryWorks 条件なし)",
      run: async () => (
        await adapter.queryWorks(listQuery(emptyCondition, "added-desc"), ctx),
        done()
      ),
    },
    {
      name: "cond-list-deep-page",
      path: `(adapter.queryWorks page=${manifest.deepPage})`,
      run: async () => (
        await adapter.queryWorks(listQuery(emptyCondition, "added-desc", manifest.deepPage), ctx),
        done()
      ),
    },
    {
      name: "cond-list-text",
      path: "(adapter.queryWorks text)",
      run: async () => (
        await adapter.queryWorks(
          listQuery(
            { type: "and", children: [{ type: "text", q: manifest.sampleSearchQ }] },
            "added-desc",
          ),
          ctx,
        ),
        done()
      ),
    },
    {
      name: "cond-list-tag-folder",
      path: "(adapter.queryWorks tag, title-asc)",
      run: async () => (await adapter.queryWorks(listQuery(cvCondition, "title-asc"), ctx), done()),
    },
    {
      name: "cond-list-random",
      path: "(adapter.queryWorks random)",
      run: async () => (
        await adapter.queryWorks(listQuery(emptyCondition, "random", 1, 42), ctx),
        done()
      ),
    },
    {
      name: "cond-list-not-duration",
      path: "(adapter.queryWorks not(duration))",
      run: async () => (
        await adapter.queryWorks(
          listQuery(
            {
              type: "and",
              children: [
                { type: "not", child: { type: "duration", op: "lte", sec: 3600 } },
                { type: "or", children: [{ type: "bookmarked" }, { type: "hasError" }] },
              ],
            },
            "added-desc",
          ),
          ctx,
        ),
        done()
      ),
    },
    ...(
      [
        ["cv", { kind: "prefix", prefix: "cv" }],
        ["サークル", { kind: "prefix", prefix: "サークル" }],
        ["tag", { kind: "tag" }],
        ["year", { kind: "addedYear" }],
      ] satisfies Array<[string, GroupBy]>
    ).map(([name, groupBy]) => ({
      name: `cond-groups-${name}`,
      path: `(adapter.groupWorks ${name})`,
      run: async () => (
        await adapter.groupWorks({ condition: emptyCondition, groupBy }, ctx),
        done()
      ),
    })),
    {
      name: "cond-groups-cv-in-folder",
      path: "(adapter.groupWorks cv, 条件あり)",
      run: async () => (
        await adapter.groupWorks(
          { condition: cvCondition, groupBy: { kind: "prefix", prefix: "cv" } },
          ctx,
        ),
        done()
      ),
    },
    {
      name: "cond-counts-4",
      path: "(adapter.countByConditions 4条件を1往復)",
      run: async () => (await adapter.countByConditions(countConditions, ctx), done()),
    },
    {
      name: "cond-counts-4-each",
      path: "(adapter.countByConditions 4条件を1条件ずつ)",
      run: async () => {
        for (const condition of countConditions) await adapter.countByConditions([condition], ctx);
        return done();
      },
    },
    {
      name: "cond-counts-with-hasPrefix",
      path: "(adapter.countByConditions 4条件 + not(hasPrefix))",
      run: async () => (
        await adapter.countByConditions(
          [
            ...countConditions,
            {
              type: "and",
              children: [{ type: "not", child: { type: "hasPrefix", prefix: "cv" } }],
            },
          ],
          ctx,
        ),
        done()
      ),
    },
  ];

  const db = openDb({
    kind: "files",
    catalogPath: manifest.catalogDb,
    userPath: manifest.userDb,
  });
  const query = new WorkQueryRepository(db);
  const listSummariesCase = {
    name: "list-summaries-all",
    path: "(WorkQueryRepository.listSummaries)",
    run: async () => {
      query.listSummaries();
      return new Response(null, { status: 200 });
    },
  };

  const results: BenchCaseResult[] = [];
  for (const benchCase of [...cases, ...conditionCases, listSummariesCase]) {
    process.stdout.write(`Benchmarking ${benchCase.name}...`);
    results.push(
      await measureCase(benchCase.name, benchCase.path, benchCase.run, warmup, iterations),
    );
    process.stdout.write(" done\n");
  }

  const report: BenchReport = {
    generatedAt: new Date().toISOString(),
    manifest,
    warmup,
    iterations,
    cases: results,
  };

  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "bench-results.json");
  const mdPath = join(outDir, "bench-baseline.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, formatMarkdown(report));

  adapter.close();
  db.close();
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
