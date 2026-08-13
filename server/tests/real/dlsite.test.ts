// DLsite スクレイパーのテスト。ネットワークアクセスはしない:
// パースは合成 HTML、apply はモック info（coverUrl: null でカバー DL をスキップ）。
import assert from "node:assert/strict";
import { chmodSync, cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { dlsiteStatePatchSchema, type DlsiteWorkInfo } from "@mimimilli/shared";
import {
  detectRjCode,
  fetchDlsiteCover,
  fetchDlsiteHtml,
  dlsiteWorkUrl,
  listDlsiteMissingFields,
  mergeDlsiteTags,
  normalizeDlsiteCoverUrl,
  parseDlsiteHtml,
} from "../../src/adapters/real/dlsite.ts";
import {
  DEFAULT_DLSITE_REQUEST_CONFIG,
  DEFAULT_DLSITE_USER_AGENT,
} from "../../src/adapters/real/dlsiteConfig.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import {
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "../helpers/dlsiteTransport.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { nts } from "../helpers/tag.ts";
import { makeSampleLibrary, makeTestDirectory } from "../helpers/sampleLibrary.ts";

const FAST_DLSITE_REQUEST_CONFIG = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 1_000,
};

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

test("listDlsiteMissingFields: 任意フィールドの欠落を検出する", () => {
  assert.deepEqual(
    listDlsiteMissingFields({
      rjCode: "RJ900001",
      title: "タイトル",
      circle: null,
      cvs: [],
      genreTags: [],
      coverUrl: null,
      url: "",
    }),
    ["circle", "cvs", "genreTags", "coverUrl"],
  );
  assert.deepEqual(
    listDlsiteMissingFields({
      rjCode: "RJ900001",
      title: "タイトル",
      circle: "夜想曲",
      cvs: ["cv"],
      genreTags: ["genre"],
      coverUrl: "https://img.dlsite.jp/a.jpg",
      url: "",
    }),
    [],
  );
});

test("DLsite: パース成功時の欠落フィールドをwarnイベントとして記録する", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-parse-missing-fields");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const logs: Array<Record<string, unknown>> = [];
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: {
      logger: (event) => logs.push(event),
      ...mockDlsiteTransport({
        html: () => htmlResponse('<html><body><h1 id="work_name">タイトルのみ</h1></body></html>'),
      }),
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const result = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(result.ok, true);
  const missing = logs.filter((event) => event.event === "dlsite_parse_fields_missing");
  assert.equal(missing.length, 1);
  assert.deepEqual(missing[0]?.missingFields, ["circle", "cvs", "genreTags", "coverUrl"]);
  assert.equal(missing[0]?.productCode, "RJ900002");
  adapter.close();
});

test("DLsite: キャッシュ判定ログに理由を含める", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-cache-reason-log");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let now = 1_000;
  const logs: Array<Record<string, unknown>> = [];
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite"), ttlsMs: { ok: 10 }, clock: () => now },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: {
      logger: (event) => logs.push(event),
      ...mockDlsiteTransport({ html: () => htmlResponse(SAMPLE_HTML) }),
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  await adapter.dlsiteFetch(lib.existingWorkId);
  const firstMiss = logs.find((event) => event.event === "dlsite_cache_miss");
  assert.equal(firstMiss?.reason, "not_cached");

  logs.length = 0;
  await adapter.dlsiteFetch(lib.existingWorkId);
  const cacheHit = logs.find((event) => event.event === "dlsite_cache_hit");
  assert.equal(cacheHit?.reason, "ttl_valid");

  now += 11;
  logs.length = 0;
  await adapter.dlsiteFetch(lib.existingWorkId);
  const expiredMiss = logs.find((event) => event.event === "dlsite_cache_miss");
  assert.equal(expiredMiss?.reason, "ttl_expired");

  logs.length = 0;
  await adapter.dlsiteFetch(lib.existingWorkId, true);
  const forceMiss = logs.find((event) => event.event === "dlsite_cache_miss");
  assert.equal(forceMiss?.reason, "force_refresh");
  adapter.close();
});

test("fetchDlsiteHtml: HTTP 404 / 通信エラーを分類する", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const dir = makeTestDirectory("dlsite-html-classify");
  t.after(dir.cleanup);

  const notFoundAdapter = createTestRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "not-found.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => htmlResponse("<html></html>", 404),
    }),
  });
  await notFoundAdapter.updateSettings({ rootFolder: lib.root });
  await notFoundAdapter.scan();
  const notFound = await notFoundAdapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(notFound.ok, false);
  if (!notFound.ok) assert.equal(notFound.kind, "not_found");
  notFoundAdapter.close();

  const networkAdapter = createTestRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "network.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        throw new TypeError("connection reset");
      },
    }),
  });
  await networkAdapter.updateSettings({ rootFolder: lib.root });
  await networkAdapter.scan();
  const networkError = await networkAdapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(networkError.ok, false);
  if (!networkError.ok) assert.equal(networkError.kind, "error");
  networkAdapter.close();
});

test("fetchDlsiteHtml / fetchDlsiteCover: User-Agentを指定・既定値で切り替える", async () => {
  const customUa = "custom-test-agent/1.0";
  const jpegBody = () =>
    new Response(new Uint8Array([0xff, 0xd8]), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });

  await fetchDlsiteHtml(
    "RJ000001",
    async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("User-Agent"), customUa);
      return new Response("<html></html>", { status: 200 });
    },
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    customUa,
  );
  await fetchDlsiteCover(
    "https://img.dlsite.jp/a.jpg",
    async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("User-Agent"), customUa);
      return jpegBody();
    },
    Number.MAX_SAFE_INTEGER,
    customUa,
  );

  await fetchDlsiteHtml("RJ000001", async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("User-Agent"), DEFAULT_DLSITE_USER_AGENT);
    return new Response("<html></html>", { status: 200 });
  });
  await fetchDlsiteCover("https://img.dlsite.jp/a.jpg", async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("User-Agent"), DEFAULT_DLSITE_USER_AGENT);
    return jpegBody();
  });
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
  const merged = mergeDlsiteTags(nts(["サークル/夜想曲", "cv/水瀬なずな", "バイノーラル"]), info);
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
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
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
    applyTags: nts(["サークル/夜想曲", "cv/水瀬なずな", "genre/耳かき", "genre/睡眠"]),
    applyCover: false,
    applyUrl: true,
    sourceRevision: (await adapter.getWork(lib.existingWorkId))!.sourceRevision!,
  });
  assert.equal(ok, true);

  const work = await adapter.getWork(lib.existingWorkId);
  assert.equal(work?.title, "DLsite から取得したタイトル");
  assert.ok(work?.tags.some((t) => t === "genre/耳かき"));
  assert.ok(work?.tags.some((t) => t === "genre/睡眠"));
  // 既存タグの重複なし
  assert.equal(work?.tags.filter((t) => t === "cv/水瀬なずな").length, 1);

  const meta = JSON.parse(readFileSync(join(work!.physicalPath, "mimimilli.json"), "utf-8")) as {
    title: string;
    tags: string[];
    urls: { label: string; url: string }[];
  };
  assert.equal(meta.title, "DLsite から取得したタイトル");
  assert.deepEqual(meta.tags, work!.tags);
  assert.deepEqual(work?.urls, [{ label: "DLsite", url: info.url }]);
  assert.deepEqual(meta.urls, work?.urls);
  assert.equal(work?.dlsite.status, "applied");
  assert.ok(work?.dlsite.appliedTags.length > 0);
  const metaDlsite = JSON.parse(readFileSync(join(work!.physicalPath, "mimimilli.json"), "utf-8"))
    .dlsite as { status: string; lastAttemptAt: string | null; error: string | null };
  assert.equal(metaDlsite.status, "applied");
  assert.equal(metaDlsite.lastAttemptAt, null);
  assert.equal(metaDlsite.error, null);
});

test("updateDlsiteState: RJコード修正とskipped切替をメタへ保存する", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  const skipped = await adapter.updateDlsiteState(lib.existingWorkId, {
    rjCode: "RJ1234567",
    skipped: true,
  });
  assert.equal(skipped?.dlsite.rjCode, "RJ1234567");
  assert.equal(skipped?.dlsite.status, "skipped");
  const meta = JSON.parse(readFileSync(join(skipped!.physicalPath, "mimimilli.json"), "utf-8"));
  assert.deepEqual(meta.dlsite, skipped?.dlsite);

  const enabled = await adapter.updateDlsiteState(lib.existingWorkId, { skipped: false });
  assert.equal(enabled?.dlsite.status, "none");
});

test("updateDlsiteState: RJコード変更で旧状態をリセットし一括取得対象に戻す", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createTestRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) => htmlResponse(sampleWorkHtml(code, { title: `取得 ${code}`, cover: false })),
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  const before = await adapter.getWork(lib.existingWorkId);
  const metaPath = join(before!.physicalPath, "mimimilli.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  meta.dlsite = {
    rjCode: "RJ900002",
    status: "applied",
    lastAttemptAt: "2026-06-10T12:00:00.000Z",
    error: null,
    errorKind: null,
    appliedTags: ["genre/旧タグ"],
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  await adapter.scan();

  const unchanged = await adapter.updateDlsiteState(lib.existingWorkId, { rjCode: "RJ900002" });
  assert.equal(unchanged?.dlsite.status, "applied");
  assert.deepEqual(unchanged?.dlsite.appliedTags, ["genre/旧タグ"]);

  const updated = await adapter.updateDlsiteState(lib.existingWorkId, { rjCode: "RJ888888" });
  assert.equal(updated?.dlsite.rjCode, "RJ888888");
  assert.equal(updated?.dlsite.status, "none");
  assert.equal(updated?.dlsite.error, null);
  assert.equal(updated?.dlsite.errorKind, null);
  assert.deepEqual(updated?.dlsite.appliedTags, []);

  const bulk = await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  assert.equal(bulk.fetched, 1);
  assert.equal(bulk.skipped, 0);
  adapter.close();
});

test("dlsiteFetch: 存在しない作品はnot_found", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  // 既存メタ作品はフォルダー名 RJ900002… なので、タイトル・パスとも RJ なしに変更してから検証
  await adapter.patchWork(lib.existingWorkId, { title: "コードなし作品" });
  const generatedFree = await adapter.dlsiteFetch("no-such-work");
  assert.equal(generatedFree.ok, false);
  if (!generatedFree.ok) assert.equal(generatedFree.kind, "not_found");
});

test("bulk取得はタイトル・タグを自動適用せず、mimimilli.jsonのexact bytesとcatalogを維持する", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const calls: number[] = [];
  const adapter = createTestRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: { ...FAST_DLSITE_REQUEST_CONFIG, requestIntervalMs: 40 },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) => {
        calls.push(Date.now());
        return htmlResponse(
          sampleWorkHtml(code, {
            title: `DLsite取得タイトル ${code}`,
            genres: ["削除済み", "新着"],
            circle: null,
            cvs: false,
            cover: false,
          }),
        );
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  const registered = await adapter.registerScanCandidates(
    scan.candidates.map((candidate) => ({ path: candidate.path })),
  );
  const candidateId = registered.registered[0]!.workId;
  const beforeExisting = await adapter.getWork(lib.existingWorkId);
  const beforeCandidate = await adapter.getWork(candidateId!);
  const metaPath = join(beforeExisting!.physicalPath, "mimimilli.json");
  const beforeBytes = readFileSync(metaPath);

  const result = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(result.fetched, 2);
  assert.ok(calls[1]! - calls[0]! >= 35, `request interval: ${calls[1]! - calls[0]!}ms`);

  const existing = await adapter.getWork(lib.existingWorkId);
  assert.equal(existing?.title, beforeExisting?.title);
  assert.deepEqual(existing?.tags, beforeExisting?.tags);
  assert.deepEqual(readFileSync(metaPath), beforeBytes);
  const generated = await adapter.getWork(candidateId!);
  assert.equal(generated?.title, beforeCandidate?.title);
  assert.deepEqual(generated?.tags, beforeCandidate?.tags);
});

test("bulk取得はcache TTLとskipped状態を利用し、mimimilli.jsonを変更しない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-target-ttl");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let calls = 0;
  let now = 1_000;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: {
      path: join(dir.path, "cache.sqlite"),
      ttlsMs: { not_found: 30 },
      clock: () => now,
    },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        calls += 1;
        return htmlResponse("<html>404</html>", 404);
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  const registered = await adapter.registerScanCandidates(
    scan.candidates.map((candidate) => ({ path: candidate.path })),
  );
  const candidateId = registered.registered[0]!.workId;
  await adapter.updateDlsiteState(candidateId!, { skipped: true });
  const first = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(first.failed, 1);
  assert.equal(first.skipped, 1);
  assert.equal(calls, 1);
  const failedWork = await adapter.getWork(lib.existingWorkId);
  assert.equal(failedWork?.dlsite.status, "not_found");

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

  const metaPath = join(
    (await adapter.getWork(lib.existingWorkId))!.physicalPath,
    "mimimilli.json",
  );
  const bytesBefore = readFileSync(metaPath);
  const fourth = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(fourth.failed, 1);
  assert.equal(fourth.skipped, 1);
  assert.equal(calls, 2);
  assert.deepEqual(readFileSync(metaPath), bytesBefore);
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
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: async () => {
        calls += 1;
        if (calls === 1) await pending;
        return htmlResponse(SAMPLE_HTML);
      },
    }),
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

test("offline結果はcache-onlyで、mimimilli.jsonのexact bytesを変更しない", async (t) => {
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
      ...DEFAULT_DLSITE_REQUEST_CONFIG,
      offline: true,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        calls += 1;
        return htmlResponse(SAMPLE_HTML);
      },
    }),
  });
  await offline.updateSettings({ rootFolder: lib.root });
  await offline.scan();
  const offlineMetaPath = join(
    (await offline.getWork(lib.existingWorkId))!.physicalPath,
    "mimimilli.json",
  );
  const offlineBytes = readFileSync(offlineMetaPath);
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
    parseErrors: 0,
  });
  assert.equal((await offline.getWork(lib.existingWorkId))?.dlsite.status, "none");
  assert.deepEqual(readFileSync(offlineMetaPath), offlineBytes);
  offline.close();

  const online = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: cache,
    dlsiteRequestConfig: {
      ...DEFAULT_DLSITE_REQUEST_CONFIG,
      offline: false,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        calls += 1;
        return htmlResponse(SAMPLE_HTML);
      },
    }),
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
      ...DEFAULT_DLSITE_REQUEST_CONFIG,
      offline: true,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        calls += 1;
        return htmlResponse(SAMPLE_HTML);
      },
    }),
  });
  await cachedOffline.updateSettings({ rootFolder: lib.root });
  await cachedOffline.scan();
  assert.equal((await cachedOffline.dlsiteFetch(lib.existingWorkId)).ok, true);
  assert.equal(calls, 1);
  cachedOffline.close();
});

test("DLsite HTMLキャッシュ: hitでも保存HTMLを毎回パースする", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-parser-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let httpCalls = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        httpCalls += 1;
        return htmlResponse(SAMPLE_HTML);
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const first = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(httpCalls, 1);
  assert.equal(first.ok && first.info.title, "耳元ささやきの夜");

  const sqlite = new Database(join(dir.path, "cache.sqlite"));
  const row = sqlite
    .query("SELECT html_gzip FROM dlsite_html_snapshots WHERE product_code = ?")
    .get("RJ900002") as { html_gzip: Uint8Array } | null;
  assert.ok(row);
  const updatedHtml = SAMPLE_HTML.replace("耳元ささやきの夜", "キャッシュ差し替えタイトル");
  const updatedBytes = Buffer.from(updatedHtml);
  const updatedGzip = gzipSync(updatedBytes);
  sqlite.run(
    "UPDATE dlsite_html_snapshots SET html_gzip = ?, html_size = ? WHERE product_code = ?",
    [updatedGzip, updatedBytes.byteLength, "RJ900002"],
  );
  sqlite.close();

  const second = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(httpCalls, 1);
  assert.equal(second.ok && second.info.title, "キャッシュ差し替えタイトル");
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
      ...DEFAULT_DLSITE_REQUEST_CONFIG,
      offline: false,
      requestIntervalMs: 0,
      retryCount: 3,
      maxBackoffMs: 1,
      timeoutMs: 1_000,
    },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        calls += 1;
        return htmlResponse("<html></html>");
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const result = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.kind, "parse_error");
  assert.equal(calls, 1);
  adapter.close();
});

test("DLsite: parse_errorは実HTTP時だけdlsite_parse_errorをログする", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-parse-error-log");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const logs: Array<Record<string, unknown>> = [];
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: {
      ...DEFAULT_DLSITE_REQUEST_CONFIG,
      offline: false,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteSchedulerDependencies: {
      logger: (event) => logs.push(event),
      ...mockDlsiteTransport({
        html: () => htmlResponse("<html></html>"),
      }),
    },
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const first = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(first.ok, false);
  assert.equal(logs.filter((event) => event.event === "dlsite_parse_error").length, 1);
  logs.length = 0;
  const second = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(second.ok, false);
  assert.equal(logs.filter((event) => event.event === "dlsite_parse_error").length, 0);
  adapter.close();
});

test("parse_errorはcacheに保存し、mimimilli.jsonへ状態を書かない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-parse-error");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: {
      ...DEFAULT_DLSITE_REQUEST_CONFIG,
      offline: false,
      requestIntervalMs: 0,
      retryCount: 0,
      maxBackoffMs: 0,
      timeoutMs: 1_000,
    },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => htmlResponse("<html></html>"),
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const metaPath = join(
    (await adapter.getWork(lib.existingWorkId))!.physicalPath,
    "mimimilli.json",
  );
  const bytesBefore = readFileSync(metaPath);
  const result = await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  assert.deepEqual(result, { fetched: 0, failed: 1, parseErrors: 1, skipped: 0 });
  const work = await adapter.getWork(lib.existingWorkId);
  assert.equal(work?.dlsite.status, "error");
  assert.equal(work?.dlsite.errorKind, "parse_error");
  assert.deepEqual(readFileSync(metaPath), bytesBefore);
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
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: async () => {
        calls += 1;
        await pending;
        return htmlResponse(SAMPLE_HTML);
      },
    }),
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

test("DLsite HTMLキャッシュ: 相乗り中の先着abortはその呼び出し元だけ失敗し他方は完了できる", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-flight-abort-first");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  let started!: () => void;
  const gate = new Promise<void>((resolve) => (started = resolve));
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: async () => {
        started();
        await pending;
        return htmlResponse(SAMPLE_HTML);
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const controllerA = new AbortController();
  const promiseA = adapter.dlsiteFetch(lib.existingWorkId, true, { signal: controllerA.signal });
  const promiseB = adapter.dlsiteFetch(lib.existingWorkId);
  await gate;
  controllerA.abort();
  await assert.rejects(
    promiseA,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  release();
  assert.equal((await promiseB).ok, true);
  adapter.close();
});

test("DLsite HTMLキャッシュ: 相乗り中の後着abortはその呼び出し元だけ失敗し先着は完了できる", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-flight-abort-second");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  let started!: () => void;
  const gate = new Promise<void>((resolve) => (started = resolve));
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: async () => {
        started();
        await pending;
        return htmlResponse(SAMPLE_HTML);
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const controllerB = new AbortController();
  const promiseA = adapter.dlsiteFetch(lib.existingWorkId, true);
  const promiseB = adapter.dlsiteFetch(lib.existingWorkId, false, { signal: controllerB.signal });
  await gate;
  controllerB.abort();
  await assert.rejects(
    promiseB,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  release();
  assert.equal((await promiseA).ok, true);
  adapter.close();
});

test("dlsiteApply: abort済みsignalではDB・メタを更新しない", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const before = await adapter.getWork(lib.existingWorkId);
  const metaPath = join(before!.physicalPath, "mimimilli.json");
  const controller = new AbortController();
  controller.abort();
  const info: DlsiteWorkInfo = {
    rjCode: "RJ900002",
    title: "abort後に適用されないタイトル",
    circle: null,
    cvs: [],
    genreTags: [],
    coverUrl: null,
    url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
  };
  await assert.rejects(
    adapter.dlsiteApply(
      lib.existingWorkId,
      {
        info,
        applyTitle: true,
        applyTags: [],
        applyCover: false,
        applyUrl: true,
        sourceRevision: before!.sourceRevision!,
      },
      { signal: controller.signal },
    ),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  const after = await adapter.getWork(lib.existingWorkId);
  assert.equal(after?.title, before?.title);
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { title: string };
  assert.equal(meta.title, before?.title);
  adapter.close();
});

test("DLsite bulk: 2回目はHTML cache hitでHTTPしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-html-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let httpCalls = 0;
  let coverCalls = 0;
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        httpCalls += 1;
        return htmlResponse(SAMPLE_HTML);
      },
      cover: () => {
        coverCalls += 1;
        return jpegResponse(coverBody);
      },
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
  const duplicateMetaPath = join(duplicateDir, "mimimilli.json");
  const duplicateMeta = JSON.parse(readFileSync(duplicateMetaPath, "utf-8")) as { id: string };
  duplicateMeta.id = "22222222-2222-4222-8222-222222222222";
  writeFileSync(duplicateMetaPath, JSON.stringify(duplicateMeta, null, 2));

  let httpCalls = 0;
  const makeAdapter = () =>
    createRealAdapter({
      database,
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteCache: { path: cachePath },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: () => {
          httpCalls += 1;
          return htmlResponse(sampleWorkHtml("RJ900002", { cover: false }));
        },
      }),
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
    parseErrors: 0,
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
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        cover: () => {
          coverHttpCalls += 1;
          return jpegResponse(coverBody);
        },
      }),
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
      applyUrl: true,
      sourceRevision: (await first.getWork(lib.existingWorkId))!.sourceRevision!,
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
      applyUrl: true,
      sourceRevision: (await reregistered.getWork(lib.existingWorkId))!.sourceRevision!,
    }),
    true,
  );
  assert.equal(coverHttpCalls, 1);
  reregistered.close();
});

test("DLsite HTMLキャッシュ: fresh DBでmimimilli.jsonを削除して同じ作品を再登録してもHTTPしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-html-reregister");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const cachePath = join(dir.path, "dlsite-cache.sqlite");
  let htmlHttpCalls = 0;
  const makeAdapter = (database: { kind: "files"; catalogPath: string; userPath: string }) =>
    createRealAdapter({
      database,
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteCache: { path: cachePath },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: () => {
          htmlHttpCalls += 1;
          return htmlResponse(sampleWorkHtml("RJ900002", { cover: false }));
        },
      }),
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

  rmSync(join(lib.root, "dlsite", "RJ900002_既存メタ", "mimimilli.json"));
  const secondDb = {
    kind: "files" as const,
    catalogPath: join(dir.path, "second", "catalog.sqlite"),
    userPath: join(dir.path, "second", "user.sqlite"),
  };
  const second = makeAdapter(secondDb);
  await second.updateSettings({ rootFolder: lib.root });
  const scan = await second.scan();
  const registration = await second.registerScanCandidates(
    scan.candidates
      .filter((candidate) => candidate.path.endsWith("RJ900002_既存メタ"))
      .map((candidate) => ({ path: candidate.path })),
  );
  const workIds = registration.registered.map((entry) => entry.workId);
  assert.equal(workIds.length, 1);
  const works = await Promise.all(workIds.map((id) => second.getWork(id)));
  const reregistered = works.find((work) => work?.physicalPath.endsWith("RJ900002_既存メタ"));
  assert.ok(reregistered);
  assert.deepEqual(await second.runDlsiteBulk("existing", [reregistered!.id]), {
    fetched: 1,
    failed: 0,
    skipped: 0,
    parseErrors: 0,
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
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite"), ttlsMs: { ok: 1 }, clock: () => now },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        if (fail) throw new Error("transport failed");
        return htmlResponse(SAMPLE_HTML);
      },
    }),
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
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        calls += 1;
        if (succeed) return htmlResponse(SAMPLE_HTML);
        return htmlResponse("<html>error</html>", 500);
      },
    }),
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

test("bulk取得のlastAttemptAtはmimimilli.jsonへ保存しない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-no-op-write");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => htmlResponse(sampleWorkHtml("RJ900002", { cover: false })),
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  const before = await adapter.getWork(lib.existingWorkId);
  const metaPath = join(before!.physicalPath, "mimimilli.json");
  const bytesBefore = readFileSync(metaPath);

  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  const after = await adapter.getWork(lib.existingWorkId);
  assert.deepEqual(readFileSync(metaPath), bytesBefore);
  assert.equal(after!.dlsite.lastAttemptAt, before!.dlsite.lastAttemptAt);
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
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      cover: () => {
        coverCalls += 1;
        return jpegResponse(coverBody);
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  const workAId = lib.existingWorkId;
  const registration = await adapter.registerScanCandidates(
    scan.candidates.map((candidate) => ({ path: candidate.path })),
  );
  const registeredWorkBId = registration.registered[0]?.workId;
  assert.ok(registeredWorkBId);
  const workBId = registeredWorkBId;
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
      applyUrl: true,
      sourceRevision: (await adapter.getWork(workAId))!.sourceRevision!,
    }),
    adapter.dlsiteApply(workBId, {
      info: infoFor("RJ900001"),
      applyTitle: false,
      applyTags: [],
      applyCover: true,
      applyUrl: true,
      sourceRevision: (await adapter.getWork(workBId))!.sourceRevision!,
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

test("DLsite apply: カバーはcache transportを通る", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-apply-cover-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverCalls = 0;
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      cover: () => {
        coverCalls += 1;
        return jpegResponse(coverBody);
      },
    }),
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
    applyUrl: true,
    sourceRevision: (await adapter.getWork(lib.existingWorkId))!.sourceRevision!,
  });
  assert.equal(ok, true);
  assert.equal(coverCalls, 1);
  adapter.close();
});

test("bulk取得はカバーをダウンロードも適用もしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-cover-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverCalls = 0;
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => htmlResponse(SAMPLE_HTML),
      cover: () => {
        coverCalls += 1;
        return jpegResponse(coverBody);
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const result = await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  assert.deepEqual(result, { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 });
  assert.equal(coverCalls, 0);
  adapter.close();
});

test("bulk取得はカバー失敗に依存せず、mimimilli.jsonを変更しない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-cover-failure");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverCalls = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) =>
        htmlResponse(sampleWorkHtml(code, { title: `取得済み ${code}`, genres: ["テスト"] })),
      cover: () => {
        coverCalls += 1;
        return Promise.reject(new Error("カバー取得失敗"));
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  await adapter.registerScanCandidates(
    scan.candidates.map((candidate) => ({ path: candidate.path })),
  );
  const metaPath = join(
    (await adapter.getWork(lib.existingWorkId))!.physicalPath,
    "mimimilli.json",
  );
  const bytesBefore = readFileSync(metaPath);

  const result = await adapter.runDlsiteBulk("existing", undefined);

  assert.deepEqual(result, { fetched: 2, failed: 0, parseErrors: 0, skipped: 0 });
  assert.equal(coverCalls, 0);
  assert.deepEqual(readFileSync(metaPath), bytesBefore);
  adapter.close();
});

test("bulk取得はmimimilli.json書込み権限に依存しない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-meta-write-failure");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) =>
        htmlResponse(sampleWorkHtml(code, { title: `取得済み ${code}`, genres: ["テスト"] })),
      cover: (url) => {
        if (url.includes("RJ900002")) return Promise.reject(new Error("カバー取得失敗"));
        return jpegResponse(coverBody);
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();
  await adapter.registerScanCandidates(
    scan.candidates.map((candidate) => ({ path: candidate.path })),
  );

  const failedMetaPath = join(lib.root, "dlsite", "RJ900002_既存メタ", "mimimilli.json");
  chmodSync(failedMetaPath, 0o444);

  const result = await adapter.runDlsiteBulk("existing", undefined);

  assert.deepEqual(result, { fetched: 2, failed: 0, parseErrors: 0, skipped: 0 });
  adapter.close();
});

test("bulkキャンセル後の再開はcache結果を使い、mimimilli.jsonを変更しない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-bulk-cancel-resume");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const duplicateDir = join(lib.root, "dlsite", "RJ900002_複製");
  cpSync(join(lib.root, "dlsite", "RJ900002_既存メタ"), duplicateDir, { recursive: true });
  const duplicateMetaPath = join(duplicateDir, "mimimilli.json");
  const duplicateMeta = JSON.parse(readFileSync(duplicateMetaPath, "utf-8")) as { id: string };
  duplicateMeta.id = "22222222-2222-4222-8222-222222222222";
  writeFileSync(duplicateMetaPath, JSON.stringify(duplicateMeta, null, 2));

  let httpCalls = 0;
  const controller = new AbortController();
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteCache: { path: join(dir.path, "dlsite-cache.sqlite") },
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => {
        httpCalls += 1;
        return htmlResponse(sampleWorkHtml("RJ900002", { cover: false }));
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const duplicateId = "22222222-2222-4222-8222-222222222222";
  const ids = [lib.existingWorkId, duplicateId];

  const partial = await adapter.runDlsiteBulk("existing", ids, {
    signal: controller.signal,
    onProgress: (event) => {
      if (event.processed === 1) controller.abort();
    },
  });
  assert.deepEqual(partial, { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 });
  assert.equal(httpCalls, 1);
  const interrupted = await Promise.all(ids.map((id) => adapter.getWork(id)));
  assert.ok(interrupted.every((work) => work?.dlsite.status === "none"));

  const resumed = await adapter.runDlsiteBulk("existing", ids);
  assert.deepEqual(resumed, { fetched: 2, failed: 0, parseErrors: 0, skipped: 0 });
  assert.equal(httpCalls, 1);
  const completed = await Promise.all(ids.map((id) => adapter.getWork(id)));
  assert.ok(completed.every((work) => work?.dlsite.status === "none"));
  adapter.close();
});

test("dlsiteFetch: request signalがscheduler.fetchまで伝播する", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-signal-propagation");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let receivedSignal: AbortSignal | null | undefined;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code, _url, init) => {
        receivedSignal = init?.signal;
        return htmlResponse(sampleWorkHtml(code));
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const controller = new AbortController();
  const result = await adapter.dlsiteFetch(lib.existingWorkId, false, {
    signal: controller.signal,
  });
  assert.equal(result.ok, true);
  assert.ok(receivedSignal);
  assert.equal(receivedSignal.aborted, false);
  controller.abort();
  assert.equal(receivedSignal.aborted, true);
  adapter.close();
});

test("dlsiteFetch: abortでDLsite HTTP取得が中断される", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-signal-abort");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let transportCalls = 0;
  let transportReady!: () => void;
  const started = new Promise<void>((resolve) => (transportReady = resolve));
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: async (_code, _url, init) => {
        transportCalls += 1;
        transportReady();
        await new Promise<void>((resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(new DOMException("DLsiteリクエストはキャンセルされました", "AbortError"));
            return;
          }
          const onAbort = () =>
            reject(new DOMException("DLsiteリクエストはキャンセルされました", "AbortError"));
          if (signal) signal.addEventListener("abort", onAbort, { once: true });
          gate.then(() => {
            if (signal) signal.removeEventListener("abort", onAbort);
            resolve();
          });
        });
        return htmlResponse(SAMPLE_HTML);
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const controller = new AbortController();
  const pending = adapter.dlsiteFetch(lib.existingWorkId, false, { signal: controller.signal });
  await started;
  assert.equal(transportCalls, 1);
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  release();
  adapter.close();
});

test("DLsite通知: 適用後は未連携件数から外れる", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const before = await adapter.getDlsiteNotificationSummary();
  const work = await adapter.getWork(lib.existingWorkId);
  const ok = await adapter.dlsiteApply(lib.existingWorkId, {
    info: {
      rjCode: "RJ900002",
      title: "適用タイトル",
      circle: "夜想曲",
      cvs: ["水瀬なずな"],
      genreTags: ["耳かき"],
      coverUrl: null,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
    },
    applyTitle: true,
    applyTags: nts(["genre/耳かき"]),
    applyCover: false,
    applyUrl: true,
    sourceRevision: work!.sourceRevision!,
  });
  assert.equal(ok, true);
  const after = await adapter.getDlsiteNotificationSummary();
  assert.equal(after.unlinkedCount, before.unlinkedCount - 1);
  adapter.close();
});

test("DLsite通知: bulk失敗が取得失敗件数へ反映される", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-notification-fetch-failed");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => htmlResponse("<html>404</html>", 404),
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const before = await adapter.getDlsiteNotificationSummary();
  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  const after = await adapter.getDlsiteNotificationSummary();
  assert.equal(after.fetchFailedCount, before.fetchFailedCount + 1);
  adapter.close();
});

test("DLsite通知: parse_error 警報が実データの流れで発火する", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-notification-parse-alert");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const duplicateIds = [
    "44444444-4444-4444-8444-444444444441",
    "44444444-4444-4444-8444-444444444442",
    "44444444-4444-4444-8444-444444444443",
  ];
  for (const [index, workId] of duplicateIds.entries()) {
    const duplicateDir = join(lib.root, "dlsite", `RJ900002_複製${index + 1}`);
    cpSync(join(lib.root, "dlsite", "RJ900002_既存メタ"), duplicateDir, { recursive: true });
    const metaPath = join(duplicateDir, "mimimilli.json");
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { id: string };
    meta.id = workId;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => htmlResponse("<html></html>"),
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  await adapter.runDlsiteBulk("existing", undefined);
  const summary = await adapter.getDlsiteNotificationSummary();
  assert.ok(summary.parseErrorCount >= 3);
  assert.equal(summary.parseErrorAlert, true);
  adapter.close();
});
