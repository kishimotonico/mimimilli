import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDlsiteApplyPatch,
  emptyMetaDlsiteState,
  hasDlsiteUrl,
  isDlsiteUrl,
  type DlsiteApplyBody,
} from "@mimimilli/shared";

test("isDlsiteUrl: dlsite.com 本体とサブドメインだけを true にする", () => {
  assert.equal(isDlsiteUrl("https://www.dlsite.com/maniax/work/=/product_id/RJ1.html"), true);
  assert.equal(isDlsiteUrl("https://dlsite.com/maniax/"), true);
});

test("isDlsiteUrl: dlsite.com を含む別ホストと不正URLは false", () => {
  assert.equal(isDlsiteUrl("https://notdlsite.com/work/1"), false);
  assert.equal(isDlsiteUrl("https://dlsite.com.evil.example/work/1"), false);
  assert.equal(isDlsiteUrl("https://example.com/?u=www.dlsite.com"), false);
  assert.equal(isDlsiteUrl("not a url"), false);
  assert.equal(isDlsiteUrl(""), false);
});

test("hasDlsiteUrl: 別ホストだけの一覧は false", () => {
  assert.equal(hasDlsiteUrl([{ url: "https://notdlsite.com/a" }]), false);
  assert.equal(
    hasDlsiteUrl([{ url: "https://x.example/" }, { url: "https://www.dlsite.com/a" }]),
    true,
  );
});

test("buildDlsiteApplyPatch: dlsite.com を含む別ホストのURLは保持し、DLsite URLを末尾に足す", () => {
  const other = { label: "他", url: "https://notdlsite.com/work/1" };
  const oldDlsite = { label: "DLsite", url: "https://www.dlsite.com/old" };
  const info = {
    rjCode: "RJ900001",
    title: "t",
    circle: null,
    cvs: [],
    genreTags: [],
    ageRating: null,
    coverUrl: null,
    url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900001.html",
  };
  const body: DlsiteApplyBody = {
    info,
    sourceRevision: "r",
    applyTitle: false,
    applyTags: [],
    applyCover: false,
    applyUrl: true,
  };
  const patch = buildDlsiteApplyPatch(
    { title: "t", tags: [], urls: [other, oldDlsite], dlsite: emptyMetaDlsiteState() },
    body,
  );
  assert.deepEqual(patch.urls, [other, { label: "DLsite", url: info.url }]);
});
