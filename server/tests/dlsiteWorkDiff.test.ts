// 作品詳細のDLsite差分計算と適用計画（shared）。クライアントの確認ダイアログとサーバーの適用が同じ関数を使う。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeDlsiteWorkDiff,
  defaultDlsiteApplySelection,
  dlsiteApplySelectionSchema,
  emptyMetaDlsiteState,
  planDlsiteApply,
  planDlsiteRegistration,
  type DlsiteApplySelectionInput,
  type DlsiteWorkCurrent,
  type DlsiteWorkInfo,
} from "@mimimilli/shared";
import { nts } from "./helpers/tag.ts";

const URL_NEW = "https://www.dlsite.com/maniax/work/=/product_id/RJ900001.html";

function info(overrides: Partial<DlsiteWorkInfo> = {}): DlsiteWorkInfo {
  return {
    rjCode: "RJ900001",
    title: "DLsiteタイトル",
    circle: "新サークル",
    cvs: ["新CV"],
    genreTags: ["耳かき"],
    ageRating: null,
    coverUrl: "https://img.dlsite.jp/a.jpg",
    url: URL_NEW,
    ...overrides,
  };
}

function current(overrides: Partial<DlsiteWorkCurrent> = {}): DlsiteWorkCurrent {
  return { title: "現在", tags: [], urls: [], hasCover: false, ...overrides };
}

const CACHED = { coverCached: true };
const select = (overrides: Partial<DlsiteApplySelectionInput> = {}) =>
  dlsiteApplySelectionSchema.parse({
    title: false,
    cover: false,
    url: false,
    tags: [],
    ...overrides,
  });

test("computeDlsiteWorkDiff: タイトルは同一・置き換え・DLsite側が空で対象外", () => {
  assert.deepEqual(
    computeDlsiteWorkDiff(current({ title: "DLsiteタイトル" }), info(), CACHED).title,
    { kind: "unchanged", current: "DLsiteタイトル" },
  );
  assert.deepEqual(computeDlsiteWorkDiff(current(), info(), CACHED).title, {
    kind: "replace",
    current: "現在",
    next: "DLsiteタイトル",
  });
  assert.deepEqual(computeDlsiteWorkDiff(current(), info({ title: "" }), CACHED).title, {
    kind: "unavailable",
    current: "現在",
    reason: "no_title",
  });
});

test("computeDlsiteWorkDiff: URLは未設定でfill、同一でunchanged、別URLでreplace、空で対象外。別ホストは現在値にしない", () => {
  const other = { label: "他", url: "https://notdlsite.com/work/1" };
  assert.deepEqual(computeDlsiteWorkDiff(current({ urls: [other] }), info(), CACHED).url, {
    kind: "fill",
    next: URL_NEW,
  });
  const same = { label: "DLsite", url: URL_NEW };
  assert.deepEqual(computeDlsiteWorkDiff(current({ urls: [same] }), info(), CACHED).url, {
    kind: "unchanged",
    current: URL_NEW,
  });
  const old = { label: "DLsite", url: "https://www.dlsite.com/old" };
  assert.deepEqual(computeDlsiteWorkDiff(current({ urls: [old] }), info(), CACHED).url, {
    kind: "replace",
    current: old.url,
    next: URL_NEW,
  });
  assert.deepEqual(computeDlsiteWorkDiff(current({ urls: [old] }), info({ url: "" }), CACHED).url, {
    kind: "unavailable",
    current: old.url,
    reason: "no_url",
  });
});

test("computeDlsiteWorkDiff: カバーはfill・replace・coverUrlなし・キャッシュなし", () => {
  assert.deepEqual(computeDlsiteWorkDiff(current(), info(), CACHED).cover, { kind: "fill" });
  assert.deepEqual(computeDlsiteWorkDiff(current({ hasCover: true }), info(), CACHED).cover, {
    kind: "replace",
  });
  assert.deepEqual(computeDlsiteWorkDiff(current(), info({ coverUrl: null }), CACHED).cover, {
    kind: "unavailable",
    reason: "no_cover",
  });
  assert.deepEqual(computeDlsiteWorkDiff(current(), info(), { coverCached: false }).cover, {
    kind: "unavailable",
    reason: "cover_not_cached",
  });
});

test("computeDlsiteWorkDiff: タグは作品にあるものをpresentTagsへ分け、単一値prefixはreplacesを持つ", () => {
  const diff = computeDlsiteWorkDiff(
    current({ tags: nts(["サークル/旧サークル", "cv/新CV", "ASMR"]) }),
    info(),
    CACHED,
  );
  assert.deepEqual(diff.presentTags, nts(["cv/新CV"]));
  assert.deepEqual(diff.tags, [
    { tag: "サークル/新サークル", replaces: nts(["サークル/旧サークル"]) },
    { tag: "genre/耳かき", replaces: [] },
  ]);
});

test("computeDlsiteWorkDiff: 差分が無ければhasChangesがfalse", () => {
  const diff = computeDlsiteWorkDiff(
    current({
      title: "DLsiteタイトル",
      urls: [{ label: "DLsite", url: URL_NEW }],
      tags: nts(["サークル/新サークル", "cv/新CV", "genre/耳かき"]),
    }),
    info({ coverUrl: null }),
    CACHED,
  );
  assert.equal(diff.hasChanges, false);
});

test("defaultDlsiteApplySelection: 未設定の項目だけを選び、置き換えになるタグは外す", () => {
  const diff = computeDlsiteWorkDiff(
    current({ tags: nts(["サークル/旧サークル"]), hasCover: true }),
    info(),
    CACHED,
  );
  assert.deepEqual(defaultDlsiteApplySelection(diff), {
    title: false,
    cover: false,
    url: true,
    tags: nts(["cv/新CV", "genre/耳かき"]),
  });
});

test("planDlsiteApply: 選ばれたfill/replaceの項目だけを書き、何も選ばなくてもappliedにする", () => {
  const base = { ...current({ tags: nts(["ASMR"]) }), dlsite: emptyMetaDlsiteState() };
  const none = planDlsiteApply(base, info(), select(), CACHED);
  assert.equal(none.title, undefined);
  assert.equal(none.tags, undefined);
  assert.equal(none.urls, undefined);
  assert.equal(none.applyCover, false);
  assert.deepEqual(none.dlsite, { rjCode: "RJ900001", status: "applied", appliedTags: [] });

  const all = planDlsiteApply(
    base,
    info(),
    select({ title: true, cover: true, url: true, tags: ["cv/新CV"] }),
    CACHED,
  );
  assert.equal(all.title, "DLsiteタイトル");
  assert.deepEqual(all.tags, nts(["ASMR", "cv/新CV"]));
  assert.deepEqual(all.urls, [{ label: "DLsite", url: URL_NEW }]);
  assert.equal(all.applyCover, true);
  assert.deepEqual(all.dlsite.appliedTags, nts(["cv/新CV"]));
});

test("planDlsiteApply: unchanged・unavailableの項目は選ばれても書かず、DLsiteのタグでない値は無視する", () => {
  const base = {
    ...current({ title: "DLsiteタイトル", urls: [{ label: "DLsite", url: URL_NEW }] }),
    dlsite: emptyMetaDlsiteState(),
  };
  const plan = planDlsiteApply(
    base,
    info({ coverUrl: null }),
    select({ title: true, cover: true, url: true, tags: ["任意のタグ"] }),
    CACHED,
  );
  assert.equal(plan.title, undefined);
  assert.equal(plan.urls, undefined);
  assert.equal(plan.applyCover, false);
  assert.equal(plan.tags, undefined);
});

test("planDlsiteApply: カバーがキャッシュに無ければapplyCoverだけfalseで、ほかは書く", () => {
  const plan = planDlsiteApply(
    { ...current(), dlsite: emptyMetaDlsiteState() },
    info(),
    select({ title: true, cover: true, url: true }),
    { coverCached: false },
  );
  assert.equal(plan.applyCover, false);
  assert.equal(plan.title, "DLsiteタイトル");
  assert.deepEqual(plan.urls, [{ label: "DLsite", url: URL_NEW }]);
});

test("タイトルの扱いは候補の追加と作品詳細の適用で同じ（DLsite側が空なら変えない）", () => {
  for (const title of ["DLsiteタイトル", ""]) {
    const registration = planDlsiteRegistration({
      rjCode: "RJ900001",
      info: info({ title }),
      title: "現在",
      tags: [],
      apply: { title: true, cover: false, tags: false, url: false },
    });
    const applied = planDlsiteApply(
      { ...current(), dlsite: emptyMetaDlsiteState() },
      info({ title }),
      select({ title: true }),
      CACHED,
    );
    assert.equal(applied.title ?? "現在", registration.title);
  }
});
