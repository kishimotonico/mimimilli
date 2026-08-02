import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  emptyDlsiteState,
  toTrackDurationFieldsFromSec,
  WORKS_DEFAULT_PAGE_SIZE,
  type DlsiteState,
  type Work,
} from "@mimimilli/shared";
import { openDb } from "../src/adapters/real/db.ts";
import { WorkRepo } from "../src/adapters/real/workRepo.ts";
import { smartFolders } from "../src/adapters/real/userSchema.ts";
import { writeWav } from "../tests/helpers/sampleLibrary.ts";
import { optionalArg, optionalIntArg, parseArgs } from "./cli.ts";
import { BENCH_SORTS, type BenchManifest } from "./manifest.ts";
import { createRng, intBetween, pick } from "./rng.ts";

const KEY_ROOT_FOLDER = "root_folder";

const CVS = ["水瀬なずな", "柚木つばめ", "秋野かえで", "陽向葵ゅか", "一之瀬りと"] as const;
const CIRCLES = ["夜想曲", "スタジオテスト", "サウンドラボ", "ミミ工房"] as const;
const SERIES = ["シリーズA", "シリーズB", "続編"] as const;
const CATEGORIES = ["バイノーラル", "囁き", "癒し"] as const;
const GENRES = ["ASMR", "環境音", "睡眠用", "ロールプレイ"] as const;

function workId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function childUuid(parentIndex: number, childIndex: number): string {
  const hex = ((parentIndex & 0xffff) << 16) | (childIndex & 0xffff);
  return `10000000-0000-4000-8000-${hex.toString(16).padStart(12, "0")}`;
}

function isoDaysAgo(rng: () => number, days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(intBetween(rng, 0, 23), intBetween(rng, 0, 59), 0, 0);
  return date.toISOString();
}

function buildTags(rng: () => number): string[] {
  const tags = new Set<string>();
  const count = intBetween(rng, 5, 10);
  while (tags.size < count) {
    const kind = intBetween(rng, 0, 4);
    switch (kind) {
      case 0:
        tags.add(`cv/${pick(rng, CVS)}`);
        break;
      case 1:
        tags.add(`サークル/${pick(rng, CIRCLES)}`);
        break;
      case 2:
        tags.add(`シリーズ/${pick(rng, SERIES)}`);
        break;
      case 3:
        tags.add(`カテゴリ/${pick(rng, CATEGORIES)}`);
        break;
      default:
        tags.add(`genre/${pick(rng, GENRES)}`);
        break;
    }
  }
  return [...tags];
}

function buildDlsite(rng: () => number, rjNum: number): DlsiteState {
  const roll = rng();
  if (roll < 0.7) return emptyDlsiteState();
  const rjCode = `RJ${String(rjNum).padStart(6, "0")}`;
  if (roll < 0.85) {
    return {
      rjCode,
      status: "applied",
      lastAttemptAt: isoDaysAgo(rng, intBetween(rng, 1, 60)),
      error: null,
      errorKind: null,
      appliedTags: ["genre/ASMR"],
    };
  }
  if (roll < 0.92) {
    return {
      rjCode,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    };
  }
  return {
    rjCode,
    status: "error",
    lastAttemptAt: isoDaysAgo(rng, intBetween(rng, 1, 30)),
    error: "fetch failed",
    errorKind: "error",
    appliedTags: [],
  };
}

function buildWork(index: number, libRoot: string, rng: () => number): Work {
  const rjNum = 100_000 + index;
  const title = `ベンチ作品 RJ${rjNum}`;
  const physicalPath = join(libRoot, "dlsite", `RJ${rjNum}_${title}`);
  const defaultPlaylistId = childUuid(index, 0);
  const bonusPlaylistId = childUuid(index, 1);
  const trackCount = intBetween(rng, 8, 12);
  const defaultTracks = Array.from({ length: trackCount }, (_, trackIndex) => {
    const durationSec = intBetween(rng, 60, 600);
    return {
      id: childUuid(index, 100 + trackIndex),
      title: `トラック${trackIndex + 1}`,
      file:
        trackIndex < 8
          ? `mp3/${String(trackIndex + 1).padStart(2, "0")}_part.wav`
          : "bonus/extra.wav",
      ...toTrackDurationFieldsFromSec(durationSec),
    };
  });
  const bookmarked = rng() < 0.15;
  const hasPlayed = rng() < 0.35;
  const addedAt = isoDaysAgo(rng, intBetween(rng, 0, 900));
  const totalDurationSec = defaultTracks.reduce((sum, track) => sum + (track.durationSec ?? 0), 0);

  return {
    id: workId(index),
    title,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: rng() < 0.02 ? "missing" : "ok",
    physicalPath,
    totalDurationSec,
    addedAt,
    createdAt: addedAt,
    errorMessage: null,
    urls:
      rng() < 0.3
        ? [
            {
              label: "DLsite",
              url: `https://www.dlsite.com/maniax/work/=/product_id/RJ${rjNum}.html`,
            },
          ]
        : [],
    tags: buildTags(rng),
    defaultPlaylistId,
    playlists: [
      { id: defaultPlaylistId, name: "default", tracks: defaultTracks },
      {
        id: bonusPlaylistId,
        name: "bonus",
        tracks: [
          {
            id: childUuid(index, 200),
            title: "おまけ",
            file: "bonus/omake.wav",
            ...toTrackDurationFieldsFromSec(120),
          },
        ],
      },
    ],
    bookmarked,
    lastPlayedAt: hasPlayed ? isoDaysAgo(rng, intBetween(rng, 0, 120)) : null,
    resume: null,
    dlsite: buildDlsite(rng, rjNum),
  };
}

function defaultOutDir(): string {
  return mkdtempSync(join(tmpdir(), "mimimilli-bench-"));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const count = optionalIntArg(args, "count", 30_000);
  const rngSeed = optionalIntArg(args, "seed", 42);
  const outDir = resolve(optionalArg(args, "out-dir") ?? defaultOutDir());
  const libRoot = join(outDir, "lib");
  const catalogDb = join(outDir, "db", "catalog.sqlite");
  const userDb = join(outDir, "db", "user.sqlite");

  mkdirSync(join(outDir, "db"), { recursive: true });
  mkdirSync(join(libRoot, "dlsite"), { recursive: true });

  const rng = createRng(rngSeed);
  const db = openDb({ kind: "files", catalogPath: catalogDb, userPath: userDb });
  const repo = new WorkRepo(db);

  const started = performance.now();
  let firstWork: Work | undefined;
  db.transaction(() => {
    for (let index = 0; index < count; index++) {
      const work = buildWork(index, libRoot, rng);
      if (index === 0) firstWork = work;
      repo.upsertWork(work, { metaPath: join(work.physicalPath, "mimimilli.json") });
      if ((index + 1) % 1000 === 0 || index + 1 === count) {
        process.stdout.write(`\r${index + 1}/${count} works`);
      }
    }
  });
  process.stdout.write("\n");

  if (!firstWork) throw new Error("作品が1件も生成されませんでした");

  repo.setUserSetting(KEY_ROOT_FOLDER, libRoot);
  const sampleAudioRelPath = firstWork.playlists[0]!.tracks[0]!.file;
  const sampleWorkDir = firstWork.physicalPath;
  mkdirSync(join(sampleWorkDir, "mp3"), { recursive: true });
  writeWav(join(sampleWorkDir, sampleAudioRelPath), 1);

  const smartFolderNoRulesId = "bench-sf-all";
  const smartFolderWithRulesId = "bench-sf-tagged";
  const createdAt = new Date().toISOString();
  db.user
    .insert(smartFolders)
    .values([
      {
        id: smartFolderNoRulesId,
        name: "全件",
        rulesJson: "[]",
        sort: "added-desc",
        createdAt,
      },
      {
        id: smartFolderWithRulesId,
        name: "CV水瀬",
        rulesJson: JSON.stringify([
          { conjunction: "WHERE", field: "タグ", operator: "∋", values: ["cv/水瀬なずな"] },
        ]),
        sort: "title-asc",
        createdAt,
      },
    ])
    .run();

  const manifest: BenchManifest = {
    version: 1,
    workCount: count,
    rngSeed,
    catalogDb,
    userDb,
    libRoot,
    sampleWorkId: firstWork.id,
    sampleAudioRelPath,
    sampleSearchQ: "ベンチ",
    sampleTag: "cv/水瀬なずな",
    smartFolderNoRulesId,
    smartFolderWithRulesId,
    deepPage: Math.max(1, Math.ceil(count / WORKS_DEFAULT_PAGE_SIZE)),
    sorts: BENCH_SORTS,
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  db.close();
  const elapsedSec = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`Seeded ${count} works in ${elapsedSec}s`);
  console.log(`Output: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
