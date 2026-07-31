import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { WORKS_DEFAULT_PAGE_SIZE } from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { createRealAdapter } from "../src/adapters/real/index.ts";
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
    if (res.status >= 500) {
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

  const cases: Array<{ name: string; path: string; run: () => Promise<Response> }> = [
    {
      name: "works-page-1",
      path: "/api/works",
      run: async () => app.request("/api/works"),
    },
    {
      name: "works-deep-page",
      path: `/api/works?page=${manifest.deepPage}`,
      run: async () => app.request(`/api/works?page=${manifest.deepPage}`),
    },
    {
      name: "works-search-q",
      path: `/api/works?q=${encodeURIComponent(manifest.sampleSearchQ)}`,
      run: async () => app.request(`/api/works?q=${encodeURIComponent(manifest.sampleSearchQ)}`),
    },
    {
      name: "works-search-tag",
      path: `/api/works?tags=${encodeURIComponent(manifest.sampleTag)}`,
      run: async () => app.request(`/api/works?tags=${encodeURIComponent(manifest.sampleTag)}`),
    },
    ...manifest.sorts.map((sort) => {
      const query =
        sort === "random" ? `sort=random&seed=42&limit=${WORKS_DEFAULT_PAGE_SIZE}` : `sort=${sort}`;
      const path = `/api/works?${query}`;
      return {
        name: `works-sort-${sort}`,
        path,
        run: async () => app.request(path),
      };
    }),
    {
      name: "smart-folder-no-rules",
      path: `/api/smart-folders/${manifest.smartFolderNoRulesId}/works`,
      run: async () => app.request(`/api/smart-folders/${manifest.smartFolderNoRulesId}/works`),
    },
    {
      name: "smart-folder-with-rules",
      path: `/api/smart-folders/${manifest.smartFolderWithRulesId}/works`,
      run: async () => app.request(`/api/smart-folders/${manifest.smartFolderWithRulesId}/works`),
    },
    {
      name: "fs-root",
      path: "/api/fs",
      run: async () => app.request("/api/fs"),
    },
    {
      name: "media-audio-resolve",
      path: `/api/media/audio/${manifest.sampleWorkId}/${manifest.sampleAudioRelPath}`,
      run: async () =>
        app.request(`/api/media/audio/${manifest.sampleWorkId}/${manifest.sampleAudioRelPath}`),
    },
  ];

  const results: BenchCaseResult[] = [];
  for (const benchCase of cases) {
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
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
