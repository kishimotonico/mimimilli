// タグ正規化・prefix 定義（ADR-0005）のテスト。
// 純粋関数（normalizeTag / buildAxisFacets / buildTagPrefixCandidates）と
// fixture アダプタの保存処理と HTTP CRUD を確認する。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TAG_PREFIXES,
  emptyDlsiteState,
  normalizeTag,
  normalizeTags,
  tagEquals,
  tagPrefixCreateSchema,
  tagPrefixNameSchema,
} from "@mimimilli/shared";
import type { WorkSummary } from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { buildAxisFacets } from "../src/core/axisFacets.ts";
import { buildTagPrefixCandidates } from "../src/core/tagPrefixCandidates.ts";

function buildApp() {
  return createApp(createFixtureAdapter());
}

function summaryWith(
  id: string,
  tags: string[],
  addedAt = "2026-01-01T00:00:00.000Z",
): WorkSummary {
  return {
    id,
    title: id,
    cover: null,
    status: "ok",
    physicalPath: `/lib/${id}`,
    totalDurationSec: 0,
    addedAt,
    errorMessage: null,
    urls: [],
    tags,
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
  };
}

// ── 正規化（ADR-0005 決定5）──────────────────────────────────

test("normalizeTag: prefix を小文字化し、prefix と値を trim する", () => {
  assert.equal(normalizeTag("CV/ 水瀬なずな "), "cv/水瀬なずな");
  assert.equal(normalizeTag(" Genre /耳かき"), "genre/耳かき");
  assert.equal(normalizeTag("  ASMR  "), "ASMR");
});

test("normalizeTag: 値の大文字小文字は保持する", () => {
  assert.equal(normalizeTag("cv/Alice"), "cv/Alice");
});

test("normalizeTag: 値にスラッシュを含む場合は最初のスラッシュでのみ分割する", () => {
  assert.equal(normalizeTag("シリーズ/A/B"), "シリーズ/A/B");
});

test("normalizeTags: 正規化後の重複と空タグを除き、順序を保つ", () => {
  assert.deepEqual(normalizeTags(["CV/x", "cv/x", "  ", "ASMR", "ASMR"]), ["cv/x", "ASMR"]);
});

test("normalizeTags: prefix または値が空の Annotated タグを除く", () => {
  assert.deepEqual(normalizeTags(["cv/", "cv/   ", "  /x", "/x"]), ["/x"]);
});

test("tagEquals: prefix の大文字小文字を無視し、値は区別する", () => {
  assert.ok(tagEquals("CV/x", "cv/x"));
  assert.ok(!tagEquals("cv/X", "cv/x"));
});

// ── prefix 名スキーマ ─────────────────────────────────────────

test("tagPrefixNameSchema: 予約軸ID・スラッシュ・smart- を拒否する", () => {
  assert.ok(!tagPrefixNameSchema.safeParse("tag").success);
  assert.ok(!tagPrefixNameSchema.safeParse("YEAR").success); // 小文字化後に予約IDと衝突
  assert.ok(!tagPrefixNameSchema.safeParse("a/b").success);
  assert.ok(!tagPrefixNameSchema.safeParse("smart-x").success);
  assert.equal(tagPrefixNameSchema.parse(" 気分 "), "気分");
});

test("tagPrefixCreateSchema: color は semantic key のみ受け付け、旧 CSS 変数文字列は拒否する", () => {
  assert.ok(
    tagPrefixCreateSchema.safeParse({ prefix: "気分", label: "気分", color: "cv" }).success,
  );
  assert.ok(
    tagPrefixCreateSchema.safeParse({ prefix: "気分", label: "気分", color: null }).success,
  );
  assert.ok(
    !tagPrefixCreateSchema.safeParse({
      prefix: "気分",
      label: "気分",
      color: "var(--cv-color)",
    }).success,
  );
});

test("DEFAULT_TAG_PREFIXES: color は CSS 変数文字列ではなく semantic key", () => {
  for (const def of DEFAULT_TAG_PREFIXES) {
    assert.ok(def.color === null || !def.color.startsWith("var("), def.prefix);
  }
});

// ── ファセット集計（動的 prefix 軸）──────────────────────────

test("buildAxisFacets: 任意の prefix 軸を集計できる（prefix の大小は無視）", () => {
  const works = [
    summaryWith("W1", ["気分/睡眠用", "ASMR"]),
    summaryWith("W2", ["気分/睡眠用", "気分/作業用"]),
    summaryWith("W3", ["Kibun/x", "気分/作業用"]),
  ];
  const items = buildAxisFacets("気分", works);
  assert.deepEqual(items, [
    { value: "作業用", count: 2, durationSec: 0, covers: [] },
    { value: "睡眠用", count: 2, durationSec: 0, covers: [] },
  ]);
});

test("buildAxisFacets: tag 軸は flat・annotated 双方を集計し、year 軸は addedAt 由来", () => {
  const works = [
    summaryWith("W1", ["cv/x", "ASMR"], "2025-06-01T00:00:00.000Z"),
    summaryWith("W2", ["ASMR"], "2026-01-01T00:00:00.000Z"),
  ];
  assert.deepEqual(buildAxisFacets("tag", works), [
    { value: "ASMR", count: 2, durationSec: 0, covers: [] },
    { value: "cv/x", count: 1, durationSec: 0, covers: [] },
  ]);
  assert.deepEqual(
    buildAxisFacets("year", works)
      .map((i) => i.value)
      .sort(),
    ["2025", "2026"],
  );
});

test("buildAxisFacets: durationSecは同じ値に属する作品の合計、durationSec未知(null)は合算から除く", () => {
  const works = [
    { ...summaryWith("W1", ["気分/睡眠用"]), totalDurationSec: 600 },
    { ...summaryWith("W2", ["気分/睡眠用"]), totalDurationSec: 1200 },
    { ...summaryWith("W3", ["気分/睡眠用"]), totalDurationSec: null },
  ];
  assert.deepEqual(
    buildAxisFacets("気分", works).map(({ value, durationSec }) => ({ value, durationSec })),
    [{ value: "睡眠用", durationSec: 1800 }],
  );
});

test("buildAxisFacets: coversは追加日時の新しい順で最大4件、cover未設定の作品は含まない", () => {
  const cover = (n: number) => ({ image: `cover-${n}.jpg`, dimensions: { width: n, height: n } });
  const works = [
    { ...summaryWith("W1", ["気分/睡眠用"], "2026-01-01T00:00:00.000Z"), cover: cover(1) },
    { ...summaryWith("W2", ["気分/睡眠用"], "2026-01-03T00:00:00.000Z"), cover: cover(2) },
    { ...summaryWith("W3", ["気分/睡眠用"], "2026-01-02T00:00:00.000Z"), cover: null },
    { ...summaryWith("W4", ["気分/睡眠用"], "2026-01-05T00:00:00.000Z"), cover: cover(4) },
    { ...summaryWith("W5", ["気分/睡眠用"], "2026-01-04T00:00:00.000Z"), cover: cover(5) },
    { ...summaryWith("W6", ["気分/睡眠用"], "2026-01-06T00:00:00.000Z"), cover: cover(6) },
  ];
  const [item] = buildAxisFacets("気分", works);
  assert.deepEqual(
    item?.covers.map((c) => c.image),
    ["cover-6.jpg", "cover-4.jpg", "cover-5.jpg", "cover-2.jpg"],
  );
});

test("buildAxisFacets: filter を渡すと AND 条件として絞り込んだ集合から集計する（TASK-187）", () => {
  const works = [
    summaryWith("W1", ["cv/藤田茜", "ASMR"]),
    summaryWith("W2", ["cv/霧島レイ", "ASMR"]),
    summaryWith("W3", ["cv/霧島レイ", "催眠"]),
  ];
  // ASMR タグで絞り込むと霧島レイの1件（W3）は集計対象から外れる
  assert.deepEqual(buildAxisFacets("cv", works, { tags: ["ASMR"], tagOp: "AND" }), [
    { value: "藤田茜", count: 1, durationSec: 0, covers: [] },
    { value: "霧島レイ", count: 1, durationSec: 0, covers: [] },
  ]);
});

test("buildAxisFacets: filter の axis=year も追加のAND条件として適用する", () => {
  const works = [
    summaryWith("W1", ["cv/藤田茜"], "2024-06-01T00:00:00.000Z"),
    summaryWith("W2", ["cv/藤田茜"], "2025-06-01T00:00:00.000Z"),
    summaryWith("W3", ["cv/霧島レイ"], "2025-06-01T00:00:00.000Z"),
  ];
  assert.deepEqual(buildAxisFacets("cv", works, { axis: "year", axisValue: "2025" }), [
    { value: "藤田茜", count: 1, durationSec: 0, covers: [] },
    { value: "霧島レイ", count: 1, durationSec: 0, covers: [] },
  ]);
});

test("buildAxisFacets: filterで0件になった値は一覧から除外される", () => {
  const works = [summaryWith("W1", ["cv/藤田茜", "催眠"])];
  assert.deepEqual(buildAxisFacets("cv", works, { tags: ["ASMR"], tagOp: "AND" }), []);
});

test("buildAxisFacets: filterが無ければ従来どおり無絞り込みで集計する（回帰確認）", () => {
  const works = [summaryWith("W1", ["cv/藤田茜"]), summaryWith("W2", ["cv/霧島レイ"])];
  assert.deepEqual(buildAxisFacets("cv", works), buildAxisFacets("cv", works, {}));
});

// ── 候補サジェスト ────────────────────────────────────────────

test("buildTagPrefixCandidates: 未登録 prefix のみを件数降順で返す", () => {
  const works = [
    summaryWith("W1", ["cv/x", "気分/睡眠用", "ASMR"]),
    summaryWith("W2", ["気分/作業用", "原作/小説A"]),
  ];
  const candidates = buildTagPrefixCandidates(works, ["cv"]);
  assert.deepEqual(candidates, [
    { prefix: "気分", count: 2 },
    { prefix: "原作", count: 1 },
  ]);
});

test("buildTagPrefixCandidates: 登録できない予約 prefix と禁止形を候補から除く", () => {
  const works = [summaryWith("W1", ["tag/foo", "year/2025", "smart-x/value", "気分/睡眠用"])];

  assert.deepEqual(buildTagPrefixCandidates(works, []), [{ prefix: "気分", count: 1 }]);
});

// ── fixture アダプタ ─────────────────────────────────────────

test("fixture patchWork: タグを正規化して保存する", async () => {
  const adapter = createFixtureAdapter();
  const page = await adapter.queryWorks({ q: "", tags: [], tagOp: "AND", sort: "added-desc" });
  const work = page.items[0];
  assert.ok(work);

  const updated = await adapter.patchWork(work.id, { tags: ["CV/ x ", "cv/x", "  "] });

  assert.deepEqual(updated?.tags, ["cv/x"]);
  assert.deepEqual((await adapter.getWork(work.id))?.tags, ["cv/x"]);
});

// ── HTTP CRUD（fixture アダプタ）─────────────────────────────

test("GET /api/tag-prefixes は seed 済みの初期定義を返す", async () => {
  const app = buildApp();
  const res = await app.request("/api/tag-prefixes");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(
    body.map((p: { prefix: string }) => p.prefix),
    DEFAULT_TAG_PREFIXES.map((p) => p.prefix),
  );
});

test("POST /api/tag-prefixes で登録し、PATCH・DELETE できる", async () => {
  const app = buildApp();

  const created = await app.request("/api/tag-prefixes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "気分", label: "気分" }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.prefix, "気分");
  assert.equal(createdBody.showAsAxis, true);
  assert.equal(createdBody.protected, false);

  const patched = await app.request(`/api/tag-prefixes/${encodeURIComponent("気分")}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ protected: true, showAsAxis: false }),
  });
  assert.equal(patched.status, 200);
  const patchedBody = await patched.json();
  assert.equal(patchedBody.protected, true);
  assert.equal(patchedBody.showAsAxis, false);

  const deleted = await app.request(`/api/tag-prefixes/${encodeURIComponent("気分")}`, {
    method: "DELETE",
  });
  assert.equal(deleted.status, 204);

  const list = await (await app.request("/api/tag-prefixes")).json();
  assert.ok(!list.some((p: { prefix: string }) => p.prefix === "気分"));
});

test("POST /api/tag-prefixes: 重複は409、予約IDは400", async () => {
  const app = buildApp();

  const duplicate = await app.request("/api/tag-prefixes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "CV", label: "CV" }), // 正規化で cv と衝突
  });
  assert.equal(duplicate.status, 409);

  const reserved = await app.request("/api/tag-prefixes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "year", label: "年" }),
  });
  assert.equal(reserved.status, 400);
});

test("PATCH・DELETE /api/tag-prefixes/:prefix は未登録なら404", async () => {
  const app = buildApp();
  const patched = await app.request("/api/tag-prefixes/unknown", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "x" }),
  });
  assert.equal(patched.status, 404);

  const deleted = await app.request("/api/tag-prefixes/unknown", { method: "DELETE" });
  assert.equal(deleted.status, 404);
});

test("GET /api/tag-prefixes/candidates は未登録 prefix を返す", async () => {
  const app = buildApp();
  const res = await app.request("/api/tag-prefixes/candidates");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  // fixture の初期定義（genre 含む）に含まれる prefix は候補に出ない
  for (const candidate of body) {
    assert.ok(!DEFAULT_TAG_PREFIXES.some((p) => p.prefix === candidate.prefix));
  }
});

test("PATCH /api/works/:id のタグは正規形で保存される", async () => {
  const app = buildApp();
  const works = await (await app.request("/api/works")).json();
  const id = works.items[0].id;

  const res = await app.request(`/api/works/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags: ["CV/ 新人 ", "ASMR", "asmr", "ASMR"] }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.tags, ["cv/新人", "ASMR", "asmr"]);
});
