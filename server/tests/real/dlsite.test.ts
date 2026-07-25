// DLsite スクレイパーのテスト。ネットワークアクセスはしない:
// パースは合成 HTML、apply はモック info（coverUrl: null でカバー DL をスキップ）。
import assert from "node:assert/strict";
import { chmodSync, cpSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { dlsiteStatePatchSchema, type DlsiteWorkInfo } from "@mimimilli/shared";
import {
  detectRjCode,
  fetchDlsiteCover,
  fetchDlsiteHtml,
  dlsiteWorkUrl,
  fetchDlsiteInfo,
  mergeDlsiteTags,
  normalizeDlsiteCoverUrl,
  parseDlsiteHtml,
} from "../../src/adapters/real/dlsite.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { createApp } from "../../src/app.ts";
import { makeSampleLibrary, makeTestDirectory } from "../helpers/sampleLibrary.ts";

const SAMPLE_HTML = `
<html><body>
  <h1 id="work_name">  耳元ささやきの夜  </h1>
  <span class="maker_name"><a href="#">夜想曲</a></span>
  <table>
    <tr><th>販売日</th><td>2026年01月01日</td></tr>
    <tr><th>声優</th><td><a href="#">水瀬なずな</a> / <a href="#">早乙女しおん</a></td></tr>
  </table>
  <div class="main_genre">
    <a href="https://www.dlsite.com/maniax/fs/=/genre/123/from/work.genre">耳かき</a>
    <a href="/maniax/fsr/=/genre/456/from/work.genre">バイノーラル</a>
    <a href="/maniax/campaign/award">DLsiteアワード！！注目マンガ・CG作品の特集です！</a>
    <a href="/maniax/fs/=/genre/999/from/work.genre"> </a>
  </div>
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

test("detectRjCode: VJコードのフォルダー名は自動検出しない（フォルダー名検出はRJのみ）", () => {
  assert.equal(detectRjCode(["VJ014780_商業作品"]), null);
});

test("dlsiteWorkUrl: RJコードはmaniax、VJコードはproのURLを組み立てる", () => {
  assert.equal(
    dlsiteWorkUrl("RJ123456"),
    "https://www.dlsite.com/maniax/work/=/product_id/RJ123456.html",
  );
  assert.equal(
    dlsiteWorkUrl("VJ014780"),
    "https://www.dlsite.com/pro/work/=/product_id/VJ014780.html",
  );
  assert.equal(
    dlsiteWorkUrl("vj014780"),
    "https://www.dlsite.com/pro/work/=/product_id/vj014780.html",
  );
});

test("dlsiteStatePatchSchema: RJ/VJコードの手動入力を受け付け、それ以外は拒否する", () => {
  const rj = dlsiteStatePatchSchema.safeParse({ rjCode: "rj1234567" });
  assert.equal(rj.success, true);
  if (rj.success) assert.equal(rj.data.rjCode, "RJ1234567");

  const vj = dlsiteStatePatchSchema.safeParse({ rjCode: "vj014780" });
  assert.equal(vj.success, true);
  if (vj.success) assert.equal(vj.data.rjCode, "VJ014780");

  const tooShort = dlsiteStatePatchSchema.safeParse({ rjCode: "VJ123" });
  assert.equal(tooShort.success, false);

  const unknownPrefix = dlsiteStatePatchSchema.safeParse({ rjCode: "BJ123456" });
  assert.equal(unknownPrefix.success, false);
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

test("dlsiteApply: タグマージとメタ書き戻し（カバー DL なし）", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createRealAdapter({ database: { kind: "memory" } });
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

test("updateDlsiteState: RJコード修正とskipped切替をメタへ保存する", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createRealAdapter({ database: { kind: "memory" } });
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

test("dlsiteFetch: 存在しない作品はnot_found", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  // 既存メタ作品はフォルダー名 RJ900002… なので、タイトル・パスとも RJ なしに変更してから検証
  await adapter.patchWork(lib.existingWorkId, { title: "コードなし作品" });
  const generatedFree = await adapter.dlsiteFetch("no-such-work");
  assert.equal(generatedFree.ok, false);
  if (!generatedFree.ok) assert.equal(generatedFree.kind, "not_found");
});

test("一括取得: 編集済みタイトルは保持しフォルダー名のままのタイトルはDLsite情報で更新する。appliedTagsは差分だけ追加し1秒相当の間隔を空ける", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const calls: number[] = [];
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestIntervalMs: 40,
    dlsiteFetcher: async (rjCode) => {
      calls.push(Date.now());
      return {
        ok: true,
        info: {
          rjCode,
          title: `DLsite取得タイトル ${rjCode}`,
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

  // 既存メタのタイトル「既存メタの作品」はフォルダー名ともRJコードとも一致しない
  // ＝ユーザー編集済みとみなし、タグの差分だけ追加してタイトルは保持する
  const existing = await adapter.getWork(lib.existingWorkId);
  assert.equal(existing?.title, beforeExisting?.title);
  assert.ok(!existing?.tags.includes("genre/削除済み"));
  assert.ok(existing?.tags.includes("genre/新着"));
  assert.deepEqual(existing?.dlsite.appliedTags, ["genre/削除済み", "genre/新着"]);

  // スキャナー自動生成のタイトル（フォルダー名そのまま）は初期値のままとみなし、DLsite情報で更新する
  const generated = await adapter.getWork(scan.newWorkIds[0]!);
  assert.equal(generated?.title, `DLsite取得タイトル ${generated?.dlsite.rjCode}`);
});

test("一括取得: skippedとappliedを対象外にし、not_foundはキャッシュTTLで再取得可否を決める", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-target-ttl");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let calls = 0;
  let now = 1_000;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestIntervalMs: 0,
    dlsiteCache: {
      path: join(dir.path, "cache.sqlite"),
      ttlsMs: { not_found: 30 },
      clock: () => now,
    },
    dlsiteHtmlFetcher: async () => {
      calls += 1;
      return { status: 404, contentType: "text/html", body: "<html>404</html>" };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  await adapter.updateDlsiteState(scan.newWorkIds[0]!, { skipped: true });
  const first = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(first.failed, 1);
  assert.equal(first.skipped, 1);
  assert.equal(calls, 1);

  // TTL内の2回目はキャッシュされたnot_foundを返し、HTTPは発生しない。
  const second = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(second.fetched, 0);
  assert.equal(second.failed, 1);
  assert.equal(calls, 1);

  // TTL境界を超えたら再取得する。
  now += 31;
  const third = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(third.failed, 1);
  assert.equal(calls, 2);

  // appliedは通常bulkの対象外（skippedとは別枠でresult.skippedに数える）。
  const applied = await adapter.updateDlsiteState(lib.existingWorkId, { rjCode: "RJ900099" });
  await adapter.dlsiteApply(applied!.id, {
    info: {
      rjCode: "RJ900099",
      title: "x",
      circle: null,
      cvs: [],
      genreTags: [],
      coverUrl: null,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900099.html",
    },
    applyTitle: false,
    applyTags: [],
    applyCover: false,
  });
  const fourth = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(fourth.failed, 0);
  assert.equal(fourth.fetched, 0);
  assert.equal(fourth.skipped, 2);
  assert.equal(calls, 2);
  adapter.close();
});

test("DLsite HTMLキャッシュ: 手動fetchはhitでHTTPせず、single-flightとforce refreshを扱う", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-cache-integration");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let calls = 0;
  let resolveFetch!: () => void;
  const pending = new Promise<void>((resolve) => (resolveFetch = resolve));
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "dlsite-cache.sqlite") },
    dlsiteHtmlFetcher: async () => {
      calls += 1;
      if (calls === 1) await pending;
      return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const first = adapter.dlsiteFetch(lib.existingWorkId);
  const second = adapter.dlsiteFetch(lib.existingWorkId);
  resolveFetch();
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
  assert.equal(calls, 1);
  assert.equal((await adapter.dlsiteFetch(lib.existingWorkId)).ok, true);
  assert.equal(calls, 1);
  assert.equal((await adapter.dlsiteFetch(lib.existingWorkId, true)).ok, true);
  assert.equal(calls, 2);
  adapter.close();
});

test("DLsite offline: miss/forceはHTTPもcache書き込みもせず、bulk statusをerrorにしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-offline");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const cache = { path: join(dir.path, "cache.sqlite") };
  let calls = 0;
  const offline = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: cache,
    dlsiteRequestConfig: {
      offline: true,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteHtmlFetcher: async () => {
      calls += 1;
      return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
    },
  });
  await offline.updateSettings({ rootFolder: lib.root });
  await offline.scan();
  const miss = await offline.dlsiteFetch(lib.existingWorkId);
  assert.deepEqual(miss.ok, false);
  if (!miss.ok) assert.equal(miss.kind, "offline");
  const forced = await offline.dlsiteFetch(lib.existingWorkId, true);
  assert.deepEqual(forced.ok, false);
  if (!forced.ok) assert.equal(forced.kind, "offline");
  assert.equal(calls, 0);
  assert.deepEqual(await offline.runDlsiteBulk("existing", [lib.existingWorkId]), {
    fetched: 0,
    failed: 1,
    skipped: 0,
  });
  assert.equal((await offline.getWork(lib.existingWorkId))?.dlsite.status, "none");
  const applyResponse = await createApp(offline).request(
    `/api/dlsite/${lib.existingWorkId}/apply`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        info: {
          rjCode: "RJ900002",
          title: "x",
          circle: null,
          cvs: [],
          genreTags: [],
          coverUrl: "https://img.dlsite.jp/modpub/images2/work/a.jpg",
          url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
        },
        applyTitle: false,
        applyTags: [],
        applyCover: true,
      }),
    },
  );
  assert.equal(applyResponse.status, 503);
  assert.equal(calls, 0);
  assert.equal((await offline.getWork(lib.existingWorkId))?.dlsite.status, "none");
  offline.close();

  const online = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: cache,
    dlsiteRequestConfig: {
      offline: false,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteHtmlFetcher: async () => {
      calls += 1;
      return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
    },
  });
  await online.updateSettings({ rootFolder: lib.root });
  await online.scan();
  assert.equal((await online.dlsiteFetch(lib.existingWorkId)).ok, true);
  assert.equal(calls, 1);
  online.close();

  const cachedOffline = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: cache,
    dlsiteRequestConfig: {
      offline: true,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteHtmlFetcher: async () => {
      calls += 1;
      return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
    },
  });
  await cachedOffline.updateSettings({ rootFolder: lib.root });
  await cachedOffline.scan();
  assert.equal((await cachedOffline.dlsiteFetch(lib.existingWorkId)).ok, true);
  assert.equal(calls, 1);
  cachedOffline.close();
});

test("DLsite HTMLキャッシュ: hitでも注入parserを毎回呼ぶ", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-parser-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let httpCalls = 0;
  let parserCalls = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteHtmlFetcher: async () => {
      httpCalls += 1;
      return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
    },
    dlsiteParser: (html, code) => {
      parserCalls += 1;
      const parsed = parseDlsiteHtml(html, code);
      if (!parsed.ok) return parsed;
      return { ok: true, info: { ...parsed.info, title: `parser-${parserCalls}` } };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const first = await adapter.dlsiteFetch(lib.existingWorkId);
  const second = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(httpCalls, 1);
  assert.equal(parserCalls, 2);
  assert.equal(first.ok && first.info.title, "parser-1");
  assert.equal(second.ok && second.info.title, "parser-2");
  adapter.close();
});

test("DLsite HTMLキャッシュ: parse_errorは同じHTTPをretryしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-parse-no-retry");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let calls = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: {
      offline: false,
      requestIntervalMs: 0,
      retryCount: 3,
      maxBackoffMs: 1,
      timeoutMs: 1_000,
    },
    dlsiteHtmlFetcher: async () => {
      calls += 1;
      return { status: 200, contentType: "text/html", body: "<html></html>" };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const result = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.kind, "parse_error");
  assert.equal(calls, 1);
  adapter.close();
});

test("DLsite HTMLキャッシュ: cache missのforceとnormalは同じHTTPへ合流する", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-force-flight");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteHtmlFetcher: async () => {
      calls += 1;
      await pending;
      return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const force = adapter.dlsiteFetch(lib.existingWorkId, true);
  const normal = adapter.dlsiteFetch(lib.existingWorkId);
  release();
  assert.equal((await force).ok, true);
  assert.equal((await normal).ok, true);
  assert.equal(calls, 1);
  adapter.close();
});

test("DLsite bulk: 2回目はHTML cache hitでHTTPしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-html-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let httpCalls = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestIntervalMs: 0,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteHtmlFetcher: async () => {
      httpCalls += 1;
      return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
    },
    dlsiteCoverFetcher: async (url) => ({
      contentType: "image/jpeg",
      body: new Uint8Array(
        readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
      ),
      finalUrl: url,
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  assert.equal(httpCalls, 1);
  adapter.close();
});

test("DLsite bulk: 同一RJコードは同じ実行・別実行・adapter再オープン後もHTTPを1回に集約する", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-rj-dedup");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const database = {
    kind: "files" as const,
    catalogPath: join(dir.path, "db", "catalog.sqlite"),
    userPath: join(dir.path, "db", "user.sqlite"),
  };
  const cachePath = join(dir.path, "db", "dlsite-cache.sqlite");
  const duplicateDir = join(lib.root, "dlsite", "RJ900002_複製");
  cpSync(join(lib.root, "dlsite", "RJ900002_既存メタ"), duplicateDir, { recursive: true });
  const duplicateMetaPath = join(duplicateDir, ".meta.json");
  const duplicateMeta = JSON.parse(readFileSync(duplicateMetaPath, "utf-8")) as { id: string };
  duplicateMeta.id = "22222222-2222-4222-8222-222222222222";
  writeFileSync(duplicateMetaPath, JSON.stringify(duplicateMeta, null, 2));

  let httpCalls = 0;
  const makeAdapter = () =>
    createRealAdapter({
      database,
      dlsiteRequestIntervalMs: 0,
      dlsiteCache: { path: cachePath },
      dlsiteHtmlFetcher: async () => {
        httpCalls += 1;
        return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
      },
      dlsiteParser: (html, code) => {
        const parsed = parseDlsiteHtml(html, code);
        if (!parsed.ok) return parsed;
        return { ok: true, info: { ...parsed.info, coverUrl: null } };
      },
    });

  const first = makeAdapter();
  await first.updateSettings({ rootFolder: lib.root });
  await first.scan();
  const duplicateId = "22222222-2222-4222-8222-222222222222";
  const ids = [lib.existingWorkId, duplicateId];
  assert.deepEqual(await first.runDlsiteBulk("existing", ids), {
    fetched: 2,
    failed: 0,
    skipped: 0,
  });
  assert.equal(httpCalls, 1);
  await first.runDlsiteBulk("existing", ids);
  assert.equal(httpCalls, 1);
  first.close();

  const reopened = makeAdapter();
  await reopened.runDlsiteBulk("existing", ids);
  assert.equal(httpCalls, 1);
  reopened.close();
});

test("DLsiteカバー: キャッシュから各作品フォルダーへコピーし、catalog再登録後もHTTPしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-cover-reregister");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const database = {
    kind: "files" as const,
    catalogPath: join(dir.path, "db", "catalog.sqlite"),
    userPath: join(dir.path, "db", "user.sqlite"),
  };
  const cachePath = join(dir.path, "db", "dlsite-cache.sqlite");
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  let coverHttpCalls = 0;
  const makeAdapter = () =>
    createRealAdapter({
      database,
      dlsiteCache: { path: cachePath },
      dlsiteCoverFetcher: async (url) => {
        coverHttpCalls += 1;
        return { contentType: "image/jpeg", body: coverBody, finalUrl: url };
      },
    });
  const info: DlsiteWorkInfo = {
    rjCode: "RJ900002",
    title: "x",
    circle: null,
    cvs: [],
    genreTags: [],
    coverUrl: "https://img.dlsite.jp/modpub/images2/work/RJ900002_cover.jpg",
    url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
  };

  const first = makeAdapter();
  await first.updateSettings({ rootFolder: lib.root });
  await first.scan();
  assert.equal(
    await first.dlsiteApply(lib.existingWorkId, {
      info,
      applyTitle: false,
      applyTags: [],
      applyCover: true,
    }),
    true,
  );
  const applied = await first.getWork(lib.existingWorkId);
  assert.ok(applied?.cover);
  assert.deepEqual(
    readFileSync(join(applied!.physicalPath, applied!.cover!.image)),
    Buffer.from(coverBody),
  );
  assert.equal(coverHttpCalls, 1);
  first.close();

  rmSync(database.catalogPath);
  const reregistered = makeAdapter();
  await reregistered.scan();
  assert.equal(
    await reregistered.dlsiteApply(lib.existingWorkId, {
      info,
      applyTitle: false,
      applyTags: [],
      applyCover: true,
    }),
    true,
  );
  assert.equal(coverHttpCalls, 1);
  reregistered.close();
});

test("DLsite HTMLキャッシュ: fresh DBで.meta.jsonを削除して同じ作品を再登録してもHTTPしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-html-reregister");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const cachePath = join(dir.path, "dlsite-cache.sqlite");
  let htmlHttpCalls = 0;
  const makeAdapter = (database: { kind: "files"; catalogPath: string; userPath: string }) =>
    createRealAdapter({
      database,
      dlsiteRequestIntervalMs: 0,
      dlsiteCache: { path: cachePath },
      dlsiteHtmlFetcher: async () => {
        htmlHttpCalls += 1;
        return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
      },
      dlsiteParser: (html, code) => {
        const parsed = parseDlsiteHtml(html, code);
        if (!parsed.ok) return parsed;
        return { ok: true, info: { ...parsed.info, coverUrl: null } };
      },
    });
  const firstDb = {
    kind: "files" as const,
    catalogPath: join(dir.path, "first", "catalog.sqlite"),
    userPath: join(dir.path, "first", "user.sqlite"),
  };
  const first = makeAdapter(firstDb);
  await first.updateSettings({ rootFolder: lib.root });
  await first.scan();
  await first.runDlsiteBulk("existing", [lib.existingWorkId]);
  assert.equal(htmlHttpCalls, 1);
  first.close();

  rmSync(join(lib.root, "dlsite", "RJ900002_既存メタ", ".meta.json"));
  const secondDb = {
    kind: "files" as const,
    catalogPath: join(dir.path, "second", "catalog.sqlite"),
    userPath: join(dir.path, "second", "user.sqlite"),
  };
  const second = makeAdapter(secondDb);
  await second.updateSettings({ rootFolder: lib.root });
  const scan = await second.scan();
  assert.equal(scan.newWorkIds.length, 1);
  const works = await Promise.all(scan.newWorkIds.map((id) => second.getWork(id)));
  const reregistered = works.find((work) => work?.physicalPath.endsWith("RJ900002_既存メタ"));
  assert.ok(reregistered);
  assert.deepEqual(await second.runDlsiteBulk("existing", [reregistered!.id]), {
    fetched: 1,
    failed: 0,
    skipped: 0,
  });
  assert.equal(htmlHttpCalls, 1);
  second.close();
});

test("DLsite HTMLキャッシュ: 期限切れの再取得失敗はstaleへ戻さず、force失敗はokを保持する", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-cache-expired");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let now = 1_000;
  let fail = false;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite"), ttlsMs: { ok: 1 }, clock: () => now },
    dlsiteHtmlFetcher: async () => {
      if (fail) throw new Error("transport failed");
      return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  assert.equal((await adapter.dlsiteFetch(lib.existingWorkId)).ok, true);
  now += 2;
  fail = true;
  const expired = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.deepEqual(expired.ok, false);
  if (!expired.ok) assert.equal(expired.kind, "error");

  // error TTL中は古いHTMLが通常取得には使われないが、DBからは消えていない。
  const sqlite = new Database(join(dir.path, "cache.sqlite"), { readonly: true });
  const row = sqlite
    .query("SELECT outcome, html_gzip FROM dlsite_html_snapshots WHERE product_code = ?")
    .get("RJ900002") as { outcome: string; html_gzip: Uint8Array } | null;
  sqlite.close();
  assert.equal(row?.outcome, "ok");
  assert.ok(gunzipSync(row!.html_gzip).toString("utf8").includes("耳元ささやきの夜"));

  // force失敗後は本文を保持するが通常取得もstaleを使わず再取得する。
  now = 1_000;
  assert.equal((await adapter.dlsiteFetch(lib.existingWorkId, true)).ok, false);
  assert.equal((await adapter.dlsiteFetch(lib.existingWorkId)).ok, false);
  adapter.close();
});

test("DLsite HTMLキャッシュ: forceが失敗しても次回の通常取得は抑制される", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-force-failure-suppress");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let calls = 0;
  let succeed = true;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteHtmlFetcher: async () => {
      calls += 1;
      if (succeed) return { status: 200, contentType: "text/html", body: SAMPLE_HTML };
      return { status: 500, contentType: "text/html", body: "<html>error</html>" };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  assert.equal((await adapter.dlsiteFetch(lib.existingWorkId)).ok, true);
  assert.equal(calls, 1);

  succeed = false;
  const forced = await adapter.dlsiteFetch(lib.existingWorkId, true);
  assert.equal(forced.ok, false);
  assert.equal(calls, 2);

  // 以前はforce失敗時にok snapshotをexpireするだけで失敗記録を残さず、
  // 次の通常取得が即座に再度HTTPしてしまっていた。
  const normal = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(normal.ok, false);
  if (!normal.ok) assert.equal(normal.kind, "error");
  assert.equal(calls, 2);
  adapter.close();
});

test("DLsite bulk: 2回目はcache hitでmeta.jsonとlastAttemptAtを書き換えない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-no-op-write");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestIntervalMs: 0,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteHtmlFetcher: async () => ({ status: 200, contentType: "text/html", body: SAMPLE_HTML }),
    // coverUrlをnullにしてカバーDLを避け、HTML cache no-op判定だけを検証する。
    dlsiteParser: (html, code) => {
      const parsed = parseDlsiteHtml(html, code);
      if (!parsed.ok) return parsed;
      return { ok: true, info: { ...parsed.info, coverUrl: null } };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  const before = await adapter.getWork(lib.existingWorkId);
  const metaPath = join(before!.physicalPath, ".meta.json");
  const mtimeBefore = statSync(metaPath).mtimeMs;
  const lastAttemptBefore = before!.dlsite.lastAttemptAt;
  assert.ok(lastAttemptBefore);

  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  const after = await adapter.getWork(lib.existingWorkId);
  assert.equal(statSync(metaPath).mtimeMs, mtimeBefore);
  assert.equal(after!.dlsite.lastAttemptAt, lastAttemptBefore);
  adapter.close();
});

test("DLsiteカバー: 同じURLを2作品へ同時適用してもHTTPは1回で両方にファイルができる", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-cover-concurrent-two-works");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverCalls = 0;
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteCoverFetcher: async (url) => {
      coverCalls += 1;
      return { contentType: "image/jpeg", body: coverBody, finalUrl: url };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  const workAId = lib.existingWorkId;
  const workBId = scan.newWorkIds[0]!;
  const coverUrl = "https://img.dlsite.jp/modpub/images2/work/shared_cover.jpg";
  const infoFor = (rjCode: string): DlsiteWorkInfo => ({
    rjCode,
    title: "x",
    circle: null,
    cvs: [],
    genreTags: [],
    coverUrl,
    url: `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`,
  });
  const [okA, okB] = await Promise.all([
    adapter.dlsiteApply(workAId, {
      info: infoFor("RJ900002"),
      applyTitle: false,
      applyTags: [],
      applyCover: true,
    }),
    adapter.dlsiteApply(workBId, {
      info: infoFor("RJ900001"),
      applyTitle: false,
      applyTags: [],
      applyCover: true,
    }),
  ]);
  assert.equal(okA, true);
  assert.equal(okB, true);
  assert.equal(coverCalls, 1);
  const workA = await adapter.getWork(workAId);
  const workB = await adapter.getWork(workBId);
  assert.ok(workA?.cover);
  assert.ok(workB?.cover);
  assert.deepEqual(
    readFileSync(join(workA!.physicalPath, workA!.cover!.image)),
    Buffer.from(coverBody),
  );
  assert.deepEqual(
    readFileSync(join(workB!.physicalPath, workB!.cover!.image)),
    Buffer.from(coverBody),
  );
  adapter.close();
});

test("DLsiteカバーURL: HTTPSの許可画像ホスト以外を拒否する", () => {
  assert.equal(
    normalizeDlsiteCoverUrl("https://img.dlsite.jp/modpub/images2/work/a.jpg"),
    "https://img.dlsite.jp/modpub/images2/work/a.jpg",
  );
  assert.throws(() => normalizeDlsiteCoverUrl("http://img.dlsite.jp/a.jpg"));
  assert.throws(() => normalizeDlsiteCoverUrl("https://example.test/a.jpg"));
  assert.throws(() => normalizeDlsiteCoverUrl("https://img.dlsite.jp:444/a.jpg"));
});

test("DLsiteカバー: 許可外Locationへはリダイレクト先をfetchしない", async () => {
  let calls = 0;
  await assert.rejects(
    fetchDlsiteCover("https://img.dlsite.jp/a.jpg", async () => {
      calls += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://example.test/x.jpg" },
      });
    }),
  );
  assert.equal(calls, 1);
});

test("DLsite HTTP body: Content-Lengthなしのchunked HTMLとcoverは上限超過時にcancelする", async () => {
  for (const target of ["html", "cover"] as const) {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32));
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    if (target === "html") {
      await assert.rejects(() => fetchDlsiteHtml("RJ900002", async () => response, 64, 8));
    } else {
      await assert.rejects(() =>
        fetchDlsiteCover("https://img.dlsite.jp/a.jpg", async () => response, 8),
      );
    }
    assert.equal(cancelled, true);
  }
});

test("DLsite HTML: Content-Lengthがtransfer上限を超える場合は本文読込前にcancelする", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const response = new Response(body, {
    status: 200,
    headers: { "content-type": "text/html", "content-length": "32" },
  });
  await assert.rejects(() => fetchDlsiteHtml("RJ900002", async () => response, 8, 64));
  assert.equal(cancelled, true);
});

test("DLsite apply: カバーはcache transportを通り、注入downloaderを迂回しない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-apply-cover-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverCalls = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteCoverDownloader: async () => {
      throw new Error("legacy downloader must not be called");
    },
    dlsiteCoverFetcher: async (url) => {
      coverCalls += 1;
      return {
        contentType: "image/jpeg",
        body: new Uint8Array(
          readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
        ),
        finalUrl: url,
      };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const ok = await adapter.dlsiteApply(lib.existingWorkId, {
    info: {
      rjCode: "RJ900002",
      title: "x",
      circle: null,
      cvs: [],
      genreTags: [],
      coverUrl: "https://img.dlsite.jp/modpub/images2/work/a.jpg",
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
    },
    applyTitle: false,
    applyTags: [],
    applyCover: true,
  });
  assert.equal(ok, true);
  assert.equal(coverCalls, 1);
  adapter.close();
});

test("DLsite bulk: カバー取得もcache transportを通る", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-cover-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverCalls = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestIntervalMs: 0,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteHtmlFetcher: async () => ({ status: 200, contentType: "text/html", body: SAMPLE_HTML }),
    dlsiteCoverDownloader: async () => {
      throw new Error("legacy downloader must not be called");
    },
    dlsiteCoverFetcher: async (url) => {
      coverCalls += 1;
      return {
        contentType: "image/jpeg",
        body: new Uint8Array(
          readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
        ),
        finalUrl: url,
      };
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const result = await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  assert.deepEqual(result, { fetched: 1, failed: 0, skipped: 0 });
  assert.equal(coverCalls, 1);
  adapter.close();
});

test("一括取得: カバー取得失敗を作品のerrorへ記録し、後続作品を処理する", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  let downloads = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestIntervalMs: 0,
    dlsiteFetcher: async (rjCode) => ({
      ok: true,
      info: {
        rjCode,
        title: `取得済み ${rjCode}`,
        circle: null,
        cvs: [],
        genreTags: ["テスト"],
        coverUrl: "https://example.test/cover.jpg",
        url: `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`,
      },
    }),
    dlsiteCoverDownloader: async () => {
      downloads += 1;
      throw new Error("カバー取得失敗");
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();

  const result = await adapter.runDlsiteBulk("existing", undefined);

  assert.deepEqual(result, { fetched: 1, failed: 1, skipped: 0 });
  assert.equal(downloads, 1);
  const failed = await adapter.getWork(lib.existingWorkId);
  assert.equal(failed?.dlsite.status, "error");
  assert.equal(failed?.dlsite.error, "カバー取得失敗");
  assert.ok(failed?.dlsite.lastAttemptAt);
  const succeeded = await adapter.getWork(scan.newWorkIds[0]!);
  assert.equal(succeeded?.dlsite.status, "applied");
});

test("一括取得: 失敗状態のメタ書き戻しが例外を投げても後続作品を処理する", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestIntervalMs: 0,
    dlsiteFetcher: async (rjCode) => ({
      ok: true,
      info: {
        rjCode,
        title: `取得済み ${rjCode}`,
        circle: null,
        cvs: [],
        genreTags: ["テスト"],
        coverUrl: "https://example.test/cover.jpg",
        url: `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`,
      },
    }),
    // 1作品目: カバーDL失敗で catch へ → メタが読み取り専用のため失敗状態の保存も失敗する
    dlsiteCoverDownloader: async (_url, workDir) => {
      if (workDir.includes("RJ900002")) throw new Error("カバー取得失敗");
      return "dlsite_cover.jpg";
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();

  const failedMetaPath = join(lib.root, "dlsite", "RJ900002_既存メタ", ".meta.json");
  chmodSync(failedMetaPath, 0o444);

  const result = await adapter.runDlsiteBulk("existing", undefined);

  // 保存に失敗した作品も failed に数え、後続作品は処理される（ジョブは中断しない）
  assert.deepEqual(result, { fetched: 1, failed: 1, skipped: 0 });
  const succeeded = await adapter.getWork(scan.newWorkIds[0]!);
  assert.equal(succeeded?.dlsite.status, "applied");
});
