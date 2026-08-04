// TASK-187 一時ベンチスクリプト。1000値規模でのGET /axes/:axis 応答時間を実測するための
// 使い捨てスクリプト（TASK-178と同じ方式）。実測後にリポジトリから削除する。
import { emptyDlsiteState, coverFieldsFromCover, type WorkSummary } from "@mimimilli/shared";
import { WorkRepo } from "./src/adapters/real/workRepo.ts";
import { openDb } from "./src/adapters/real/db.ts";

const VALUE_COUNT = 1000;
const WORKS_PER_VALUE = 5;

function summary(index: number): WorkSummary {
  const valueIndex = Math.floor(index / WORKS_PER_VALUE);
  const id = `work-${String(index).padStart(5, "0")}`;
  const hasCover = index % 3 !== 0;
  const year = 2020 + (index % 6);
  return {
    id,
    title: `作品 ${id}`,
    cover: hasCover ? { kind: "generated", width: 300, height: 300 } : null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 600 + (index % 10) * 60,
    addedAt: `${year}-01-01T00:00:00.000Z`,
    errorMessage: null,
    urls: [],
    tags: [`cv/名前-${String(valueIndex).padStart(4, "0")}`, ...(index % 2 === 0 ? ["ASMR"] : [])],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
  };
}

function fullWork(item: WorkSummary) {
  const { trackCount: _trackCount, ...rest } = item;
  const { coverKind, coverImage } = coverFieldsFromCover(item.cover);
  return {
    ...rest,
    coverKind,
    coverImage,
    defaultPlaylistId: null,
    createdAt: item.addedAt,
    playlists: [],
  };
}

function upsert(repo: WorkRepo, item: WorkSummary): void {
  repo.upsertWork(fullWork(item) as never, { metaPath: `${item.physicalPath}/mimimilli.json` });
}

function measure(label: string, run: () => void, iterations = 10): void {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const min = samples[0]!.toFixed(2);
  const max = samples[samples.length - 1]!.toFixed(2);
  const avg = (samples.reduce((s, v) => s + v, 0) / samples.length).toFixed(2);
  console.log(`${label}: min=${min}ms avg=${avg}ms max=${max}ms (n=${iterations})`);
}

const db = openDb({ kind: "memory" });
const repo = new WorkRepo(db);
const total = VALUE_COUNT * WORKS_PER_VALUE;
console.log(`seeding ${total} works across ${VALUE_COUNT} distinct cv values...`);
for (let i = 0; i < total; i++) upsert(repo, summary(i));
console.log("seed done\n");

measure("cv facet, no filter (baseline)", () => repo.getAxisFacets("cv"));
measure("cv facet, tags AND filter (1 tag)", () =>
  repo.getAxisFacets("cv", { tags: ["ASMR"], tagOp: "AND" }),
);
measure("cv facet, axis=year filter", () =>
  repo.getAxisFacets("cv", { axis: "year", axisValue: "2022" }),
);
measure("cv facet, tags AND + axis=year combined", () =>
  repo.getAxisFacets("cv", { tags: ["ASMR"], tagOp: "AND", axis: "year", axisValue: "2022" }),
);

db.close();
