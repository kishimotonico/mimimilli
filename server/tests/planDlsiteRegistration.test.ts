import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dlsiteInfoTags,
  planDlsiteRegistration,
  type DlsiteRegistrationApply,
  type DlsiteWorkInfo,
} from "@mimimilli/shared";
import { nts } from "./helpers/tag.ts";

const INFO: DlsiteWorkInfo = {
  rjCode: "RJ123456",
  title: "DLsiteのタイトル",
  circle: "サークル名",
  cvs: ["声優A"],
  genreTags: ["耳かき"],
  ageRating: "全年齢",
  coverUrl: "https://img.dlsite.jp/modpub/images2/work/a.jpg",
  url: "https://www.dlsite.com/maniax/work/=/product_id/RJ123456.html",
};
const ALL: DlsiteRegistrationApply = { title: true, cover: true, tags: true, url: true };
const NONE: DlsiteRegistrationApply = { title: false, cover: false, tags: false, url: false };

const plan = (
  overrides: Partial<Parameters<typeof planDlsiteRegistration>[0]> & {
    apply?: DlsiteRegistrationApply;
  } = {},
) =>
  planDlsiteRegistration({
    rjCode: "RJ123456",
    info: INFO,
    title: "フォルダー名",
    tags: [],
    apply: ALL,
    ...overrides,
  });

test("DLsite情報が無いときは入力のまま、連携なし", () => {
  const result = plan({ info: null, tags: nts(["手入力"]) });
  assert.equal(result.title, "フォルダー名");
  assert.deepEqual(result.tags, ["手入力"]);
  assert.equal(result.dlsiteUrl, null);
  assert.equal(result.coverUrl, null);
  assert.deepEqual(result.dlsite, { rjCode: "RJ123456", status: "none", appliedTags: [] });
});

test("全項目を反映すると、タイトル・タグ・URL・カバーがDLsite由来になる", () => {
  const result = plan();
  assert.equal(result.title, INFO.title);
  assert.deepEqual(result.tags, dlsiteInfoTags(INFO));
  assert.deepEqual(result.dlsiteUrl, { label: "DLsite", url: INFO.url });
  assert.equal(result.coverUrl, INFO.coverUrl);
  assert.deepEqual(result.dlsite, {
    rjCode: "RJ123456",
    status: "applied",
    appliedTags: dlsiteInfoTags(INFO),
  });
});

test("項目ごとのフラグがfalseなら、その項目だけ反映しない", () => {
  assert.equal(plan({ apply: { ...ALL, title: false } }).title, "フォルダー名");
  assert.equal(plan({ apply: { ...ALL, cover: false } }).coverUrl, null);
  assert.equal(plan({ apply: { ...ALL, url: false } }).dlsiteUrl, null);
  const noTags = plan({ apply: { ...ALL, tags: false } });
  assert.deepEqual(noTags.tags, []);
  assert.deepEqual(noTags.dlsite.appliedTags, []);
});

test("DLsiteのタイトルが空ならタイトルは入力のまま、URLが空ならURLなし", () => {
  const result = plan({ info: { ...INFO, title: "", url: "" } });
  assert.equal(result.title, "フォルダー名");
  assert.equal(result.dlsiteUrl, null);
});

test("appliedTagsはDLsiteのタグと入力タグの共通部分になる", () => {
  const dlsiteTags = dlsiteInfoTags(INFO);
  const picked = dlsiteTags.slice(0, 2);
  const result = plan({
    tags: nts([...picked, "手入力"]),
    apply: { ...NONE, url: true },
  });
  assert.deepEqual(result.tags, [...picked, "手入力"]);
  assert.deepEqual(result.dlsite.appliedTags, picked);
});

test("反映項目がすべてfalseでも、DLsite情報が使えれば連携状態はapplied", () => {
  const result = plan({ apply: NONE });
  assert.equal(result.dlsite.status, "applied");
  assert.equal(result.title, "フォルダー名");
  assert.equal(result.coverUrl, null);
});
