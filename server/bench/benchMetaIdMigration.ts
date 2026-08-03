import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { emptyDlsiteState, META_FILE_NAME } from "@mimimilli/shared";
import { migrateMetaIds } from "../src/adapters/real/metaIdMigration.ts";
import { optionalArg, optionalIntArg, parseArgs } from "./cli.ts";
import { createRng } from "./rng.ts";
import { summarizeLatencies } from "./stats.ts";

const WARMUP = 1;
const TRIALS = 7;
const DEFAULT_COUNTS = [5000, 30000] as const;

type Variant = "cold" | "warm";

interface BenchRow {
  count: number;
  variant: Variant;
  median: number;
  min: number;
  max: number;
}

interface BenchContext {
  libraryRoot: string;
  dataRoot: string;
  metaPaths: string[];
  manifestPath: string;
}

interface MigrationManifestSnapshot {
  raw: string;
  libraryCompleted: boolean;
}

function workUuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function childUuid(parentIndex: number, childIndex: number): string {
  const hex = ((parentIndex & 0xffff) << 16) | (childIndex & 0xffff);
  return `10000000-0000-4000-8000-${hex.toString(16).padStart(12, "0")}`;
}

function manifestPathFor(libraryRoot: string, dataRoot: string): string {
  const rootKey = createHash("sha256").update(libraryRoot).digest("hex").slice(0, 16);
  return join(dataRoot, "migrations", "playlist-track-ids", rootKey, "manifest.json");
}

function buildCompleteMeta(workIndex: number, title: string): Record<string, unknown> {
  const playlistAId = childUuid(workIndex, 1);
  const playlistBId = childUuid(workIndex, 2);
  const trackIds = Array.from({ length: 8 }, (_, trackIndex) =>
    childUuid(workIndex, 10 + trackIndex),
  );
  return {
    id: workUuid(workIndex),
    title,
    urls: [],
    tags: [`bench/work-${workIndex}`],
    coverImage: null,
    defaultPlaylistId: playlistAId,
    playlists: [
      {
        id: playlistAId,
        name: "main",
        tracks: trackIds.slice(0, 4).map((id, trackIndex) => ({
          id,
          title: `track-${trackIndex + 1}`,
          file: `audio/${trackIndex + 1}.wav`,
        })),
      },
      {
        id: playlistBId,
        name: "bonus",
        tracks: trackIds.slice(4).map((id, trackIndex) => ({
          id,
          title: `bonus-${trackIndex + 1}`,
          file: `audio/bonus-${trackIndex + 1}.wav`,
        })),
      },
    ],
    dlsite: emptyDlsiteState(),
  };
}

function seedLibrary(libraryRoot: string, count: number, seed: number): string[] {
  const rng = createRng(seed);
  const metaPaths: string[] = [];
  for (let index = 1; index <= count; index++) {
    const workDir = join(libraryRoot, `work-${index.toString().padStart(6, "0")}`);
    mkdirSync(workDir, { recursive: true });
    const metaPath = join(workDir, META_FILE_NAME);
    const meta = buildCompleteMeta(index, `Bench Work ${index} (${rng().toFixed(6)})`);
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf-8");
    metaPaths.push(metaPath);
  }
  return metaPaths;
}

function clearManifest(ctx: BenchContext): void {
  rmSync(dirname(ctx.manifestPath), { recursive: true, force: true });
}

function readManifestSnapshot(ctx: BenchContext): MigrationManifestSnapshot {
  const raw = readFileSync(ctx.manifestPath, "utf-8");
  const parsed = JSON.parse(raw) as { libraryCompleted?: boolean };
  return {
    raw,
    libraryCompleted: parsed.libraryCompleted === true,
  };
}

function restoreManifestToPath(
  manifestFilePath: string,
  snapshot: MigrationManifestSnapshot,
): void {
  mkdirSync(dirname(manifestFilePath), { recursive: true });
  writeFileSync(manifestFilePath, snapshot.raw, "utf-8");
}

function runMigration(ctx: BenchContext): void {
  migrateMetaIds({
    root: ctx.libraryRoot,
    metaPaths: ctx.metaPaths,
    dataRoot: ctx.dataRoot,
  });
}

function measureVariant(
  ctx: BenchContext,
  variant: Variant,
  warmSnapshot: MigrationManifestSnapshot | null,
): { median: number; min: number; max: number } {
  const prepare = (): void => {
    if (variant === "cold") {
      clearManifest(ctx);
      return;
    }
    if (!warmSnapshot) {
      throw new Error(`${variant}: warm manifest snapshot is missing`);
    }
    restoreManifestToPath(ctx.manifestPath, warmSnapshot);
  };

  prepare();
  runMigration(ctx);

  const samples: number[] = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    prepare();
    const start = performance.now();
    runMigration(ctx);
    samples.push(performance.now() - start);
  }

  const stats = summarizeLatencies(samples);
  return { median: stats.p50, min: stats.min, max: stats.max };
}

function establishWarmSnapshot(ctx: BenchContext): MigrationManifestSnapshot {
  clearManifest(ctx);
  runMigration(ctx);
  const second = migrateMetaIds({
    root: ctx.libraryRoot,
    metaPaths: ctx.metaPaths,
    dataRoot: ctx.dataRoot,
  });
  if (second.migrated !== 0 || second.externallyModified.length > 0) {
    throw new Error("warm baseline migration failed");
  }
  const snapshot = readManifestSnapshot(ctx);
  if (!snapshot.libraryCompleted) {
    throw new Error("warm baseline manifest is not libraryCompleted");
  }
  return snapshot;
}

function parseCounts(args: Map<string, string | true>): number[] {
  const raw = optionalArg(args, "count");
  if (raw === undefined) return [...DEFAULT_COUNTS];
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("--count には正の整数を指定してください");
  }
  return [parsed];
}

function formatMarkdownTable(rows: BenchRow[]): string {
  const lines = [
    "| count | variant | median (ms) | min (ms) | max (ms) |",
    "| ---: | --- | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.count} | ${row.variant} | ${row.median.toFixed(2)} | ${row.min.toFixed(2)} | ${row.max.toFixed(2)} |`,
    );
  }
  return lines.join("\n");
}

function benchCount(count: number, seed: number, outDir: string): BenchRow[] {
  const baseDir = mkdtempSync(join(tmpdir(), `mimimilli-bench-migrate-${count}-`));
  const libraryRoot = join(baseDir, "library");
  const dataRoot = join(baseDir, "data");
  mkdirSync(libraryRoot, { recursive: true });
  mkdirSync(dataRoot, { recursive: true });

  const metaPaths = seedLibrary(libraryRoot, count, seed);
  const ctx: BenchContext = {
    libraryRoot,
    dataRoot,
    metaPaths,
    manifestPath: manifestPathFor(libraryRoot, dataRoot),
  };

  const rows: BenchRow[] = [];
  const cold = measureVariant(ctx, "cold", null);
  rows.push({ count, variant: "cold", ...cold });

  const warmSnapshot = establishWarmSnapshot(ctx);
  const warm = measureVariant(ctx, "warm", warmSnapshot);
  rows.push({ count, variant: "warm", ...warm });

  const payload = {
    generatedAt: new Date().toISOString(),
    count,
    seed,
    warmup: WARMUP,
    trials: TRIALS,
    libraryRoot,
    dataRoot,
    rows,
  };
  writeFileSync(
    join(outDir, `bench-migrate-${count}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
  );

  return rows;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const seed = optionalIntArg(args, "seed", 42);
  const counts = parseCounts(args);
  const outDir = mkdtempSync(join(tmpdir(), "mimimilli-bench-migrate-results-"));

  const allRows: BenchRow[] = [];
  for (const count of counts) {
    allRows.push(...benchCount(count, seed, outDir));
  }

  const combined = {
    generatedAt: new Date().toISOString(),
    seed,
    warmup: WARMUP,
    trials: TRIALS,
    counts,
    outDir,
    rows: allRows,
  };
  writeFileSync(
    join(outDir, "bench-migrate-results.json"),
    `${JSON.stringify(combined, null, 2)}\n`,
  );

  console.log("# metaIdMigration benchmark\n");
  console.log(`Generated: ${combined.generatedAt}`);
  console.log(`Seed: ${seed}, warmup: ${WARMUP}, trials: ${TRIALS}`);
  console.log(`JSON: ${outDir}\n`);
  console.log(formatMarkdownTable(allRows));
  console.log("\n注: warm は libraryCompleted=true の再実行。cold との差分は参考値。");
}

main();
