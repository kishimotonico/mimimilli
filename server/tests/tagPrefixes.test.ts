// タグ正規化・prefix 定義（ADR-0005）のテスト。
// 純粋関数（normalizeTag / buildGroupFacets / buildTagPrefixCandidates）と
// fixture / real 両 adapter の HTTP CRUD を確認する。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TAG_PREFIXES,
  dedupeTags,
  emptyDlsiteState,
  normalizeTag,
  normalizeTags,
  parseStoredNormalizedTags,
  resolveTagPrefix,
  TagNormalizationError,
  tagEquals,
  tagPrefixCreateSchema,
  tagPrefixNameSchema,
} from "@mimimilli/shared";
import type { WorkSummary } from "@mimimilli/shared";
import { buildGroupFacets } from "../src/core/axisFacets.ts";
import { defineContract, type ContractHarness } from "./helpers/contractHarness.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { htmlResponse, mockDlsiteTransport, sampleWorkHtml } from "./helpers/dlsiteTransport.ts";
import { buildTagPrefixCandidates } from "../src/core/tagPrefixCandidates.ts";
import { nt, nts } from "./helpers/tag.ts";

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
    tags: nts(tags),
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

test("parseStoredNormalizedTags: 正規形配列は参照を保ったまま通す", () => {
  const tags = ["cv/藤田茜", "ASMR"];
  const parsed = parseStoredNormalizedTags(tags);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value[0], tags[0]);
    assert.equal(parsed.value[1], tags[1]);
  }
});

test("normalizeTags: 各要素を正規形へ寄せる（重複排除はしない）", () => {
  assert.deepEqual(normalizeTags(["CV/x", "ASMR"]), ["cv/x", "ASMR"]);
});

test("normalizeTags: 正規化して空になるタグは TagNormalizationError", () => {
  assert.throws(() => normalizeTags(["  "]), TagNormalizationError);
  assert.throws(() => normalizeTags(["cv/", "cv/   "]), TagNormalizationError);
});

test("dedupeTags: 正規化済み配列から重複を除き、順序を保つ", () => {
  assert.deepEqual(dedupeTags(nts(["cv/x", "cv/x", "ASMR", "ASMR"])), ["cv/x", "ASMR"]);
});

// prefix の大文字小文字を無視する処理は normalizeTag が担う（NormalizedTag はその結果）。
// tagEquals は正規化済み同士の単純な同値判定のみを行う。
test("tagEquals: 正規化済み同士の同値判定。値は大文字小文字を区別する", () => {
  assert.ok(tagEquals(nt("cv/x"), nt("cv/x")));
  assert.ok(!tagEquals(nt("cv/X"), nt("cv/x")));
});

// ── prefix 名スキーマ ─────────────────────────────────────────

test("tagPrefixNameSchema: tag・year・スラッシュを拒否する", () => {
  for (const id of ["tag", "year"]) {
    assert.ok(!tagPrefixNameSchema.safeParse(id).success, id);
  }
  assert.ok(!tagPrefixNameSchema.safeParse("YEAR").success); // 小文字化後に予約名と衝突
  assert.ok(!tagPrefixNameSchema.safeParse("a/b").success);
  assert.ok(tagPrefixNameSchema.safeParse("recent").success);
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

// ── prefix のラベル・色解決（複数画面で結果を揃える）──────

test("resolveTagPrefix: 登録済み prefix はラベル・色をそのまま返す", () => {
  assert.deepEqual(resolveTagPrefix("cv", DEFAULT_TAG_PREFIXES), { label: "CV", color: "cv" });
});

test("resolveTagPrefix: 未登録 prefix は prefix 文字列をラベルにし、色は null", () => {
  assert.deepEqual(resolveTagPrefix("気分", DEFAULT_TAG_PREFIXES), {
    label: "気分",
    color: null,
  });
});

// ── ファセット集計（動的 prefix 軸）──────────────────────────

test("buildGroupFacets: prefix のグループを集計できる（別 prefix は混入しない）", () => {
  const works = [
    summaryWith("W1", ["気分/睡眠用", "ASMR"]),
    summaryWith("W2", ["気分/睡眠用", "気分/作業用"]),
    summaryWith("W3", ["kibun/x", "気分/作業用"]),
  ];
  const items = buildGroupFacets({ kind: "prefix", prefix: "気分" }, works);
  assert.deepEqual(items, [
    { value: "作業用", count: 2, durationSec: 0, covers: [] },
    { value: "睡眠用", count: 2, durationSec: 0, covers: [] },
  ]);
});

test("buildGroupFacets: tag は flat・annotated 双方を集計し、addedYear は addedAt 由来", () => {
  const works = [
    summaryWith("W1", ["cv/x", "ASMR"], "2025-06-01T00:00:00.000Z"),
    summaryWith("W2", ["ASMR"], "2026-01-01T00:00:00.000Z"),
  ];
  assert.deepEqual(buildGroupFacets({ kind: "tag" }, works), [
    { value: "ASMR", count: 2, durationSec: 0, covers: [] },
    { value: "cv/x", count: 1, durationSec: 0, covers: [] },
  ]);
  assert.deepEqual(
    buildGroupFacets({ kind: "addedYear" }, works)
      .map((i) => i.value)
      .sort(),
    ["2025", "2026"],
  );
});

test("buildGroupFacets: durationSecは同じ値に属する作品の合計、durationSec未知(null)は合算から除く", () => {
  const works = [
    { ...summaryWith("W1", ["気分/睡眠用"]), totalDurationSec: 600 },
    { ...summaryWith("W2", ["気分/睡眠用"]), totalDurationSec: 1200 },
    { ...summaryWith("W3", ["気分/睡眠用"]), totalDurationSec: null },
  ];
  assert.deepEqual(
    buildGroupFacets({ kind: "prefix", prefix: "気分" }, works).map(({ value, durationSec }) => ({
      value,
      durationSec,
    })),
    [{ value: "睡眠用", durationSec: 1800 }],
  );
});

test("buildGroupFacets: coversは追加日時の新しい順で最大4件、cover未設定の作品は含まない", () => {
  const cover = (n: number) => ({
    image: `cover-${n}.jpg`,
    dimensions: { width: n, height: n },
    version: `cover-${n}`,
  });
  const works = [
    { ...summaryWith("W1", ["気分/睡眠用"], "2026-01-01T00:00:00.000Z"), cover: cover(1) },
    { ...summaryWith("W2", ["気分/睡眠用"], "2026-01-03T00:00:00.000Z"), cover: cover(2) },
    { ...summaryWith("W3", ["気分/睡眠用"], "2026-01-02T00:00:00.000Z"), cover: null },
    { ...summaryWith("W4", ["気分/睡眠用"], "2026-01-05T00:00:00.000Z"), cover: cover(4) },
    { ...summaryWith("W5", ["気分/睡眠用"], "2026-01-04T00:00:00.000Z"), cover: cover(5) },
    { ...summaryWith("W6", ["気分/睡眠用"], "2026-01-06T00:00:00.000Z"), cover: cover(6) },
  ];
  const [item] = buildGroupFacets({ kind: "prefix", prefix: "気分" }, works);
  assert.deepEqual(
    item?.covers.map((c) => c.image),
    ["cover-6.jpg", "cover-4.jpg", "cover-5.jpg", "cover-2.jpg"],
  );
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

test("buildTagPrefixCandidates: 登録できない予約 prefix を候補から除く", () => {
  const works = [summaryWith("W1", ["tag/foo", "year/2025", "気分/睡眠用"])];

  assert.deepEqual(buildTagPrefixCandidates(works, []), [{ prefix: "気分", count: 1 }]);
});

// ── HTTP（fixture / real の両 adapter）──────────────────────

const contract = defineContract({
  works: [
    { key: "a", tags: ["ASMR", "mood/甘め", "mood/眠い"] },
    { key: "b", tags: ["mood/甘め", "ジャンル/耳かき"] },
  ],
  real: {
    dlsiteRequestConfig: { ...DEFAULT_DLSITE_REQUEST_CONFIG, requestIntervalMs: 0, retryCount: 0 },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) => htmlResponse(sampleWorkHtml(code, { genres: ["テスト"], cover: false })),
    }),
  },
});

const applyBody = (sourceRevision: string, tags: string[], infoRevision: string) => ({
  sourceRevision,
  infoRevision,
  apply: { title: false, cover: false, url: false, tags },
});

/** 形式だけ正しい版。タグ以外が正しいリクエストはスキーマを通り、適用の照合で409になる */
const UNCHECKED_INFO_REVISION = "unchecked";

/** 対照のリクエスト（タグだけ正しい）が409になることで、本体の400がタグの検証によるものだと示す */
async function assertTagsRejected(
  harness: ContractHarness,
  validTags: string[],
  badTags: string[],
) {
  const id = harness.workId("a");
  const sourceRevision = await sourceRevisionOf(harness, id);
  const control = await harness.send(
    "POST",
    `/api/dlsite/${id}/apply`,
    applyBody(sourceRevision, validTags, UNCHECKED_INFO_REVISION),
  );
  assert.equal(control.status, 409);
  assert.equal(control.body.error.code, "dlsite_refetch_required");

  const applied = await harness.send(
    "POST",
    `/api/dlsite/${id}/apply`,
    applyBody(sourceRevision, badTags, UNCHECKED_INFO_REVISION),
  );
  assert.equal(applied.status, 400);
  assert.equal(applied.body.error.code, "invalid_request");
}

async function sourceRevisionOf(harness: ContractHarness, workId: string): Promise<string> {
  const { body } = await harness.json(`/api/works/${workId}/source`);
  return body.sourceRevision;
}

// 生の（空白混じり・大文字小文字混在の）タグ文字列の正規化は、adapter の内部ではなく
// HTTP 境界（workSourcePatchSchema + normalizeTags）で行う。実際にその境界を通す。
contract("PATCH /api/works/:id: タグを正規化して保存する", async (harness) => {
  const id = harness.workId("a");
  const patched = await harness.send("PATCH", `/api/works/${id}`, {
    sourceRevision: await sourceRevisionOf(harness, id),
    tags: ["CV/ x ", "cv/x"],
  });
  assert.equal(patched.status, 200);
  assert.deepEqual(patched.body.snapshot.tags, ["cv/x"]);
  assert.deepEqual((await harness.json(`/api/works/${id}`)).body.tags, ["cv/x"]);
});

contract(
  "PATCH /api/works/:id: 正規化後に空になるタグは400で拒否し、保存しない",
  async (harness) => {
    const id = harness.workId("a");
    const before = (await harness.json(`/api/works/${id}`)).body.tags;
    const patched = await harness.send("PATCH", `/api/works/${id}`, {
      sourceRevision: await sourceRevisionOf(harness, id),
      tags: ["cv/x", "  "],
    });
    assert.equal(patched.status, 400);
    assert.deepEqual((await harness.json(`/api/works/${id}`)).body.tags, before);
  },
);

contract(
  "PATCH /api/works/:id のタグは正規形で保存される（大文字小文字違いは別タグ）",
  async (harness) => {
    const id = harness.workId("a");
    const res = await harness.send("PATCH", `/api/works/${id}`, {
      sourceRevision: await sourceRevisionOf(harness, id),
      tags: ["CV/ 新人 ", "ASMR", "asmr", "ASMR"],
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.snapshot.tags, ["cv/新人", "ASMR", "asmr"]);
  },
);

contract("POST /api/dlsite/:id/apply: apply.tags を正規化して保存する", async (harness) => {
  const id = harness.workId("a");
  await harness.send("PATCH", `/api/dlsite/${id}`, {
    sourceRevision: await sourceRevisionOf(harness, id),
    rjCode: "RJ000001",
  });
  const fetched = await harness.send("POST", `/api/dlsite/${id}/fetch`);
  assert.equal(fetched.status, 200);
  const applied = await harness.send(
    "POST",
    `/api/dlsite/${id}/apply`,
    applyBody(
      fetched.body.sourceRevision,
      ["Genre/ テスト ", "genre/テスト"],
      fetched.body.infoRevision,
    ),
  );
  assert.equal(applied.status, 200);
  const work = await harness.json(`/api/works/${id}`);
  assert.ok(work.body.tags.includes("genre/テスト"));
});

contract("POST /api/dlsite/:id/apply: 正規化後に空になる apply.tags は400で拒否する", (harness) =>
  assertTagsRejected(harness, ["genre/耳かき"], ["genre/耳かき", "  "]),
);

contract("POST /api/dlsite/:id/apply: 予約文字 @ 始まりの apply.tags は400で拒否する", (harness) =>
  assertTagsRejected(harness, ["year/2024"], ["@year/2024"]),
);

contract("GET /api/tag-prefixes は初期定義を order 昇順で返す", async (harness) => {
  const { status, body } = await harness.json("/api/tag-prefixes");
  assert.equal(status, 200);
  assert.deepEqual(
    body.map((p: { prefix: string }) => p.prefix),
    DEFAULT_TAG_PREFIXES.map((p) => p.prefix),
  );
});

contract("POST /api/tag-prefixes で登録し、PATCH・DELETE できる", async (harness) => {
  const created = await harness.send("POST", "/api/tag-prefixes", {
    prefix: "気分",
    label: "気分",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.prefix, "気分");
  assert.equal(created.body.protected, false);

  const patched = await harness.send("PATCH", `/api/tag-prefixes/${encodeURIComponent("気分")}`, {
    protected: true,
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.protected, true);

  const deleted = await harness.request(`/api/tag-prefixes/${encodeURIComponent("気分")}`, {
    method: "DELETE",
  });
  assert.equal(deleted.status, 204);

  const list = await harness.json("/api/tag-prefixes");
  assert.ok(!list.body.some((p: { prefix: string }) => p.prefix === "気分"));
});

contract("POST /api/tag-prefixes: 重複は409、予約IDは400", async (harness) => {
  const duplicate = await harness.send("POST", "/api/tag-prefixes", {
    prefix: "CV",
    label: "CV",
  }); // 正規化で cv と衝突
  assert.equal(duplicate.status, 409);

  const reserved = await harness.send("POST", "/api/tag-prefixes", {
    prefix: "year",
    label: "年",
  });
  assert.equal(reserved.status, 400);
});

contract("PATCH・DELETE /api/tag-prefixes/:prefix は未登録なら404", async (harness) => {
  const patched = await harness.send("PATCH", "/api/tag-prefixes/unknown", {
    label: "x",
  });
  assert.equal(patched.status, 404);

  const deleted = await harness.send("DELETE", "/api/tag-prefixes/unknown");
  assert.equal(deleted.status, 404);
});

contract(
  "POST /api/tag-prefixes: 新規は末尾へ自動採番され、一覧は order 昇順で返る",
  async (harness) => {
    const created = await harness.send("POST", "/api/tag-prefixes", {
      prefix: "気分",
      label: "気分",
    });
    const maxSeedOrder = Math.max(...DEFAULT_TAG_PREFIXES.map((p) => p.order));
    assert.equal(created.body.order, maxSeedOrder + 1);

    const list = await harness.json("/api/tag-prefixes");
    const orders = list.body.map((p: { order: number }) => p.order);
    assert.deepEqual(
      orders,
      [...orders].sort((a: number, b: number) => a - b),
    );
  },
);

contract(
  "PATCH /api/tag-prefixes/:prefix: order のみを送っても無視され、実質空更新として400になる（並び替えは一括APIのみ）",
  async (harness) => {
    const before = (await harness.json("/api/tag-prefixes")).body as Array<{
      prefix: string;
    }>;
    const first = before[0]!;

    const patched = await harness.send(
      "PATCH",
      `/api/tag-prefixes/${encodeURIComponent(first.prefix)}`,
      { order: 99 },
    );
    assert.equal(patched.status, 400);

    assert.deepEqual((await harness.json("/api/tag-prefixes")).body, before);
  },
);

contract(
  "PATCH /api/tag-prefixes/:prefix: order を他フィールドと同時に送っても無視され、並び順は変わらない",
  async (harness) => {
    const before = (await harness.json("/api/tag-prefixes")).body as Array<{
      prefix: string;
      order: number;
    }>;
    const first = before[0]!;

    const patched = await harness.send(
      "PATCH",
      `/api/tag-prefixes/${encodeURIComponent(first.prefix)}`,
      { label: "更新後ラベル", order: 99 },
    );
    assert.equal(patched.status, 200);
    assert.equal(patched.body.label, "更新後ラベル");
    assert.equal(patched.body.order, first.order);
  },
);

contract(
  "PUT /api/tag-prefixes/order: 全prefixの新しい順序を一括・アトミックに適用する",
  async (harness) => {
    const before = (await harness.json("/api/tag-prefixes")).body as Array<{
      prefix: string;
    }>;
    const reversedOrder = [...before].reverse().map((p) => p.prefix);

    const res = await harness.send("PUT", "/api/tag-prefixes/order", {
      prefixes: reversedOrder,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((p: { prefix: string }) => p.prefix),
      reversedOrder,
    );

    const after = await harness.json("/api/tag-prefixes");
    assert.deepEqual(
      after.body.map((p: { prefix: string }) => p.prefix),
      reversedOrder,
    );
  },
);

contract(
  "PUT /api/tag-prefixes/order: prefix集合が一覧と一致しなければ400で、並び順は変わらない",
  async (harness) => {
    const before = (await harness.json("/api/tag-prefixes")).body;

    const res = await harness.send("PUT", "/api/tag-prefixes/order", {
      prefixes: ["cv", "存在しないprefix"],
    });
    assert.equal(res.status, 400);

    assert.deepEqual((await harness.json("/api/tag-prefixes")).body, before);
  },
);

contract(
  "GET /api/tag-prefixes/candidates は作品に現れる未登録 prefix を件数降順で返す",
  async (harness) => {
    const { status, body } = await harness.json("/api/tag-prefixes/candidates");
    assert.equal(status, 200);
    assert.deepEqual(body, [
      { prefix: "mood", count: 3 },
      { prefix: "ジャンル", count: 1 },
    ]);

    await harness.send("POST", "/api/tag-prefixes", {
      prefix: "mood",
      label: "気分",
    });
    const afterRegister = await harness.json("/api/tag-prefixes/candidates");
    assert.deepEqual(afterRegister.body, [{ prefix: "ジャンル", count: 1 }]);
  },
);
