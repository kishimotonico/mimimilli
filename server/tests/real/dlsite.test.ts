// DLsite スクレイパーのテスト。ネットワークアクセスはしない:
// パースは合成 HTML、apply はモック info（coverUrl: null でカバー DL をスキップ）。
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { DlsiteWorkInfo } from "@mimimilli/shared";
import {
  detectRjCode,
  fetchDlsiteInfo,
  mergeDlsiteTags,
  parseDlsiteHtml,
} from "../../src/adapters/real/dlsite.ts";
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

test("parseDlsiteHtml: 正常HTMLフィクスチャから各情報を抽出する", () => {
  const result = parseDlsiteHtml(SAMPLE_HTML, "RJ899999");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const info = result.info;
  assert.equal(info.title, "耳元ささやきの夜");
  assert.equal(info.circle, "夜想曲");
  assert.deepEqual(info.cvs, ["水瀬なずな", "早乙女しおん"]);
  assert.deepEqual(info.genreTags, ["耳かき", "バイノーラル"]);
  assert.equal(
    info.coverUrl,
    "https://img.dlsite.jp/modpub/images2/work/doujin/RJ900000/RJ899999_img_main.jpg",
  );
  assert.equal(info.url, "https://www.dlsite.com/maniax/work/=/product_id/RJ899999.html");
});

test("parseDlsiteHtml: タイトルが空のHTMLはparse_error", () => {
  const result = parseDlsiteHtml("<html><body>not found</body></html>", "RJ000001");
  assert.deepEqual(result, {
    ok: false,
    kind: "parse_error",
    message: "DLsite作品ページのタイトルを取得できませんでした（RJ000001）",
  });
});

test("fetchDlsiteInfo: HTTP 404 / 通信エラーを分類する", async () => {
  const notFound = await fetchDlsiteInfo(
    "RJ000001",
    async () => new Response("<html>404</html>", { status: 404 }),
  );
  assert.equal(notFound.ok, false);
  if (!notFound.ok) assert.equal(notFound.kind, "not_found");

  const networkError = await fetchDlsiteInfo("RJ000001", async () => {
    throw new TypeError("connection reset");
  });
  assert.equal(networkError.ok, false);
  if (!networkError.ok) assert.equal(networkError.kind, "error");
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
  assert.deepEqual(merged, [
    "サークル/夜想曲",
    "cv/水瀬なずな",
    "バイノーラル",
    "cv/新CV",
    "genre/耳かき",
  ]);
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
    applyTags: ["サークル/夜想曲", "cv/水瀬なずな", "genre/耳かき", "genre/睡眠"],
    applyCover: false,
  });
  assert.equal(ok, true);

  const work = await adapter.getWork(lib.existingWorkId);
  assert.equal(work?.title, "DLsite から取得したタイトル");
  assert.ok(work?.tags.includes("genre/耳かき"));
  assert.ok(work?.tags.includes("genre/睡眠"));
  // 既存タグの重複なし
  assert.equal(work?.tags.filter((t) => t === "cv/水瀬なずな").length, 1);

  const meta = JSON.parse(readFileSync(join(work!.physicalPath, ".meta.json"), "utf-8")) as {
    title: string;
    tags: string[];
    urls: { label: string; url: string }[];
  };
  assert.equal(meta.title, "DLsite から取得したタイトル");
  assert.deepEqual(meta.tags, work!.tags);
  assert.deepEqual(work?.urls, [{ label: "DLsite", url: info.url }]);
  assert.deepEqual(meta.urls, work?.urls);
  assert.equal(work?.dlsite.status, "applied");
  assert.deepEqual(work?.dlsite.appliedTags, [
    "サークル/夜想曲",
    "cv/水瀬なずな",
    "genre/耳かき",
    "genre/睡眠",
  ]);
});

test("updateDlsiteState: RJコード修正とskipped切替をメタへ保存する", async () => {
  const lib = makeSampleLibrary("data/test-dlsite-state");
  const adapter = createRealAdapter({ dbPath: ":memory:" });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  const skipped = await adapter.updateDlsiteState(lib.existingWorkId, {
    rjCode: "RJ1234567",
    skipped: true,
  });
  assert.equal(skipped?.dlsite.rjCode, "RJ1234567");
  assert.equal(skipped?.dlsite.status, "skipped");
  const meta = JSON.parse(readFileSync(join(skipped!.physicalPath, ".meta.json"), "utf-8"));
  assert.deepEqual(meta.dlsite, skipped?.dlsite);

  const enabled = await adapter.updateDlsiteState(lib.existingWorkId, { skipped: false });
  assert.equal(enabled?.dlsite.status, "none");
});

test("dlsiteFetch: 存在しない作品はnot_found", async () => {
  const lib = makeSampleLibrary("data/test-dlsite-norj");
  const adapter = createRealAdapter({ dbPath: ":memory:" });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  // 既存メタ作品はフォルダー名 RJ900002… なので、タイトル・パスとも RJ なしに変更してから検証
  await adapter.patchWork(lib.existingWorkId, { title: "コードなし作品" });
  const generatedFree = await adapter.dlsiteFetch("no-such-work");
  assert.equal(generatedFree.ok, false);
  if (!generatedFree.ok) assert.equal(generatedFree.kind, "not_found");
});

test("一括取得: 既存タイトルを保持し、appliedTagsの差分だけ追加して1秒相当の間隔を空ける", async () => {
  const lib = makeSampleLibrary("data/test-dlsite-bulk");
  const calls: number[] = [];
  const adapter = createRealAdapter({
    dbPath: ":memory:",
    dlsiteRequestIntervalMs: 40,
    dlsiteFetcher: async (rjCode) => {
      calls.push(Date.now());
      return {
        ok: true,
        info: {
          rjCode,
          title: `上書き禁止 ${rjCode}`,
          circle: null,
          cvs: [],
          genreTags: ["削除済み", "新着"],
          coverUrl: null,
          url: `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`,
        },
      };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  const beforeExisting = await adapter.getWork(lib.existingWorkId);
  const metaPath = join(beforeExisting!.physicalPath, ".meta.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  meta.dlsite = {
    rjCode: "RJ900002",
    status: "error",
    lastAttemptAt: "2026-07-01T00:00:00.000Z",
    error: "前回失敗",
    appliedTags: ["genre/削除済み"],
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  await adapter.scan();

  const result = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(result.fetched, 2);
  assert.ok(calls[1]! - calls[0]! >= 35, `request interval: ${calls[1]! - calls[0]!}ms`);
  const existing = await adapter.getWork(lib.existingWorkId);
  assert.equal(existing?.title, beforeExisting?.title);
  assert.ok(!existing?.tags.includes("genre/削除済み"));
  assert.ok(existing?.tags.includes("genre/新着"));
  assert.deepEqual(existing?.dlsite.appliedTags, ["genre/削除済み", "genre/新着"]);
  const generated = await adapter.getWork(scan.newWorkIds[0]!);
  assert.ok(generated?.title !== `上書き禁止 ${generated?.dlsite.rjCode}`);
});

test("一括取得: not_found記録後とskipped作品は次回対象外", async () => {
  const lib = makeSampleLibrary("data/test-dlsite-bulk-skip");
  let calls = 0;
  const adapter = createRealAdapter({
    dbPath: ":memory:",
    dlsiteRequestIntervalMs: 0,
    dlsiteFetcher: async () => {
      calls += 1;
      return { ok: false, kind: "not_found", message: "見つかりません" };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  await adapter.updateDlsiteState(scan.newWorkIds[0]!, { skipped: true });
  const first = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(first.failed, 1);
  assert.equal(first.skipped, 1);
  const second = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(second.fetched, 0);
  assert.equal(second.failed, 0);
  assert.equal(calls, 1);
});
