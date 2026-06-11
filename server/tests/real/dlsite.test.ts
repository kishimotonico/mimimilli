// DLsite スクレイパーのテスト。ネットワークアクセスはしない:
// パースは合成 HTML、apply はモック info（coverUrl: null でカバー DL をスキップ）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { DlsiteWorkInfo } from "@mimikago/shared";
import { detectRjCode, mergeDlsiteTags, parseDlsiteHtml } from "../../src/adapters/real/dlsite.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";

const SAMPLE_HTML = `
<html><body>
  <h1 id="work_name">  耳元ささやきの夜  </h1>
  <span class="maker_name"><a href="#">夜想曲</a></span>
  <table>
    <tr><th>販売日</th><td>2026年01月01日</td></tr>
    <tr><th>声優</th><td><a href="#">水瀬なずな</a> / <a href="#">早乙女しおん</a></td></tr>
  </table>
  <div class="main_genre"><a href="#">耳かき</a><a href="#">バイノーラル</a><a href="#"> </a></div>
  <div class="product-slider-data">
    <div data-src="//img.dlsite.jp/modpub/images2/work/doujin/RJ900000/RJ899999_img_main.jpg"></div>
  </div>
</body></html>`;

test("parseDlsiteHtml: HANDOFF.md のセレクタで各情報を抽出する", () => {
  const info = parseDlsiteHtml(SAMPLE_HTML, "RJ899999");
  assert.equal(info.title, "耳元ささやきの夜");
  assert.equal(info.circle, "夜想曲");
  assert.deepEqual(info.cvs, ["水瀬なずな", "早乙女しおん"]);
  assert.deepEqual(info.genreTags, ["耳かき", "バイノーラル"]);
  assert.equal(info.coverUrl, "https://img.dlsite.jp/modpub/images2/work/doujin/RJ900000/RJ899999_img_main.jpg");
  assert.equal(info.url, "https://www.dlsite.com/maniax/work/=/product_id/RJ899999.html");
});

test("parseDlsiteHtml: 要素が無い場合は null / 空配列", () => {
  const info = parseDlsiteHtml("<html><body></body></html>", "RJ000001");
  assert.equal(info.title, "");
  assert.equal(info.circle, null);
  assert.deepEqual(info.cvs, []);
  assert.deepEqual(info.genreTags, []);
  assert.equal(info.coverUrl, null);
});

test("detectRjCode: フォルダー名優先・大文字化・桁数", () => {
  assert.equal(detectRjCode(["RJ900001_テスト作品", "別タイトル RJ123456"]), "RJ900001");
  assert.equal(detectRjCode(["タイトルのみ", "[rj01234567] 作品"]), "RJ01234567");
  assert.equal(detectRjCode(["RJ123 桁不足", "なし"]), null);
});

test("mergeDlsiteTags: prefix 変換と重複排除", () => {
  const info: DlsiteWorkInfo = {
    rjCode: "RJ900002",
    title: "x",
    circle: "夜想曲",
    cvs: ["水瀬なずな", "新CV"],
    genreTags: ["耳かき"],
    coverUrl: null,
    url: "",
  };
  const merged = mergeDlsiteTags(["サークル/夜想曲", "cv/水瀬なずな", "バイノーラル"], info);
  assert.deepEqual(merged, ["サークル/夜想曲", "cv/水瀬なずな", "バイノーラル", "cv/新CV", "genre/耳かき"]);
});

test("dlsiteApply: タグマージとメタ書き戻し（カバー DL なし）", async () => {
  const lib = makeSampleLibrary("data/test-dlsite");
  const adapter = createRealAdapter({ dbPath: ":memory:" });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  const info: DlsiteWorkInfo = {
    rjCode: "RJ900002",
    title: "DLsite から取得したタイトル",
    circle: "夜想曲",
    cvs: ["水瀬なずな"],
    genreTags: ["耳かき", "睡眠"],
    coverUrl: null,
    url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
  };
  const ok = await adapter.dlsiteApply(lib.existingWorkId, {
    info,
    applyTitle: true,
    applyTags: true,
    applyCover: false,
  });
  assert.equal(ok, true);

  const work = await adapter.getWork(lib.existingWorkId);
  assert.equal(work?.title, "DLsite から取得したタイトル");
  assert.ok(work?.tags.includes("genre/耳かき"));
  assert.ok(work?.tags.includes("genre/睡眠"));
  // 既存タグの重複なし
  assert.equal(work?.tags.filter((t) => t === "cv/水瀬なずな").length, 1);

  const meta = JSON.parse(
    readFileSync(join(work!.physicalPath, ".meta.json"), "utf-8")
  ) as { title: string; tags: string[]; urls: { label: string; url: string }[] };
  assert.equal(meta.title, "DLsite から取得したタイトル");
  assert.deepEqual(meta.tags, work!.tags);
  assert.deepEqual(work?.urls, [{ label: "DLsite", url: info.url }]);
  assert.deepEqual(meta.urls, work?.urls);
});

test("dlsiteFetch: RJ コードが検出できない作品は null", async () => {
  const lib = makeSampleLibrary("data/test-dlsite-norj");
  const adapter = createRealAdapter({ dbPath: ":memory:" });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  // 既存メタ作品はフォルダー名 RJ900002… なので、タイトル・パスとも RJ なしに変更してから検証
  await adapter.patchWork(lib.existingWorkId, { title: "コードなし作品" });
  const generatedFree = await adapter.dlsiteFetch("no-such-work");
  assert.equal(generatedFree, null);
});
