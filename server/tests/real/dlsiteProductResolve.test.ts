// 解析結果つきの解決（取得時に保存した解析結果の再利用）と、候補のDLsite状態の導出。
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import type { DlsiteWorkInfo } from "@mimimilli/shared";
import {
  DLSITE_PARSER_VERSION,
  normalizeDlsiteCoverUrl,
  parseDlsiteHtml,
} from "../../src/adapters/real/dlsite.ts";
import { DlsiteCache } from "../../src/adapters/real/dlsiteCache.ts";
import {
  createDlsiteProductResolver,
  dlsiteFetchStateOfProductResolution,
} from "../../src/adapters/real/dlsiteProductResolve.ts";
import {
  createCandidateDlsiteSource,
  deriveCandidateDlsite,
} from "../../src/adapters/real/scanCandidateDlsite.ts";
import { sampleWorkHtml } from "../helpers/dlsiteTransport.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

const CODE = "RJ000001";
const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
const TTL = { ok: 100, parse_error: 20, not_found: 30, error: 40 } as const;

function setup(t: { after: (callback: () => void) => void }) {
  const directory = makeTestDirectory("dlsite-product-resolve");
  t.after(directory.cleanup);
  const path = join(directory.path, "cache.sqlite");
  let clock = 1_000;
  const open = () => directory.own(new DlsiteCache({ path, clock: () => clock, ttlsMs: TTL }));
  const countingParse = () => {
    const state = { calls: 0 };
    const parse: typeof parseDlsiteHtml = (html, rjCode) => {
      state.calls += 1;
      return parseDlsiteHtml(html, rjCode);
    };
    return { state, parse };
  };
  return { open, setClock: (value: number) => (clock = value), countingParse };
}

function record(
  cache: DlsiteCache,
  options: { code?: string; html?: string; withParsed?: boolean; title?: string } = {},
): DlsiteWorkInfo {
  const code = options.code ?? CODE;
  const html = options.html ?? sampleWorkHtml(code, { title: options.title });
  const parsed = parseDlsiteHtml(html, code);
  assert.ok(parsed.ok);
  cache.recordSuccess({
    productCode: code,
    outcome: "ok",
    contentType: HTML_CONTENT_TYPE,
    html,
    parsed:
      options.withParsed === false
        ? undefined
        : { parserVersion: DLSITE_PARSER_VERSION, info: parsed.info },
  });
  return parsed.info;
}

test("取得時に解析結果を保存すると、候補の導出は何度でも・再起動後でも解析しない", (t) => {
  const { open, countingParse } = setup(t);
  const first = open();
  const info = record(first);
  const { state, parse } = countingParse();

  const source = createCandidateDlsiteSource(
    first,
    createDlsiteProductResolver(first, { version: DLSITE_PARSER_VERSION, parse }),
  );
  const expected = { state: "fetched", title: info.title, cover: null };
  assert.deepEqual(deriveCandidateDlsite(source, CODE), expected);
  assert.deepEqual(deriveCandidateDlsite(source, CODE), expected);
  assert.equal(state.calls, 0);

  first.close();
  const restarted = open();
  const restartedSource = createCandidateDlsiteSource(
    restarted,
    createDlsiteProductResolver(restarted, { version: DLSITE_PARSER_VERSION, parse }),
  );
  assert.deepEqual(deriveCandidateDlsite(restartedSource, CODE), expected);
  assert.equal(state.calls, 0);
});

test("解析結果が無いsnapshotは1回だけ解析して書き戻し、以後は解析しない", (t) => {
  const { open, countingParse } = setup(t);
  const cache = open();
  const info = record(cache, { withParsed: false });
  const { state, parse } = countingParse();
  const resolve = createDlsiteProductResolver(cache, { version: DLSITE_PARSER_VERSION, parse });

  for (let i = 0; i < 3; i++) {
    const resolution = resolve(CODE);
    assert.equal(resolution.kind, "html");
    if (resolution.kind === "html") assert.deepEqual(resolution.result, { ok: true, info });
  }
  assert.equal(state.calls, 1);
});

test("パーサーの版が違う解析結果は解析し直される", (t) => {
  const { open, countingParse } = setup(t);
  const cache = open();
  const info = record(cache);
  const head = cache.resolveHead({ productCode: CODE });
  assert.equal(head.kind, "html");
  cache.writeParsed({ productCode: CODE }, head.kind === "html" ? head.fetchedAt : 0, {
    parserVersion: DLSITE_PARSER_VERSION - 1,
    info: { ...info, title: "古い解析結果" },
  });
  const { state, parse } = countingParse();
  const resolve = createDlsiteProductResolver(cache, { version: DLSITE_PARSER_VERSION, parse });

  const resolution = resolve(CODE);
  assert.equal(
    resolution.kind === "html" && resolution.result.ok && resolution.result.info.title,
    info.title,
  );
  assert.equal(state.calls, 1);
  resolve(CODE);
  assert.equal(state.calls, 1);
});

test("snapshotが取り直されると、古い解析結果は使われず新しい内容を返す", (t) => {
  const { open, setClock } = setup(t);
  const cache = open();
  const source = createCandidateDlsiteSource(cache);
  record(cache, { title: "前のタイトル" });
  assert.equal(deriveCandidateDlsite(source, CODE).state, "fetched");
  setClock(1_010);
  record(cache, { title: "取り直したタイトル" });
  assert.deepEqual(deriveCandidateDlsite(source, CODE), {
    state: "fetched",
    title: "取り直したタイトル",
    cover: null,
  });
});

test("状態の導出: ok=取得済み、parse_error=失敗、失敗の記録、TTL切れ=未取得", (t) => {
  const { open, setClock } = setup(t);
  const cache = open();
  const source = createCandidateDlsiteSource(cache);
  const stateOf = (code: string) => deriveCandidateDlsite(source, code).state;

  assert.equal(stateOf("RJ000009"), "none");
  record(cache);
  assert.equal(stateOf(CODE), "fetched");

  cache.recordSuccess({
    productCode: "RJ000002",
    outcome: "parse_error",
    contentType: HTML_CONTENT_TYPE,
    html: "<html></html>",
  });
  assert.equal(stateOf("RJ000002"), "failed");

  cache.recordFailure({ productCode: "RJ000003", outcome: "not_found" });
  cache.recordFailure({ productCode: "RJ000004", outcome: "error" });
  assert.equal(stateOf("RJ000003"), "not_found");
  assert.equal(stateOf("RJ000004"), "failed");

  // 有効な失敗の記録がsnapshotより優先され、記録が切れるとsnapshotが見える
  cache.recordFailure({ productCode: CODE, outcome: "error" });
  assert.equal(stateOf(CODE), "failed");
  setClock(1_041);
  assert.equal(stateOf(CODE), "fetched");

  setClock(1_101);
  assert.equal(stateOf(CODE), "none");
  assert.equal(stateOf("RJ000002"), "none");
});

test("outcomeがokでも解析できなくなったsnapshotは失敗になる", (t) => {
  const { open } = setup(t);
  const cache = open();
  cache.recordSuccess({
    productCode: CODE,
    outcome: "ok",
    contentType: HTML_CONTENT_TYPE,
    html: "<html><body>タイトルなし</body></html>",
  });
  const resolution = createDlsiteProductResolver(cache)(CODE);
  assert.equal(dlsiteFetchStateOfProductResolution(resolution), "failed");
  assert.equal(deriveCandidateDlsite(createCandidateDlsiteSource(cache), CODE).state, "failed");
});

test("カバーはキャッシュにあれば版つきで載り、無ければnull、後から入れれば次の導出で載る", (t) => {
  const { open, setClock } = setup(t);
  const cache = open();
  const info = record(cache);
  const coverUrl = normalizeDlsiteCoverUrl(info.coverUrl!);
  const source = createCandidateDlsiteSource(cache);

  assert.deepEqual(deriveCandidateDlsite(source, CODE), {
    state: "fetched",
    title: info.title,
    cover: null,
  });
  setClock(1_005);
  cache.putCover(coverUrl, new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg");
  assert.deepEqual(deriveCandidateDlsite(source, CODE), {
    state: "fetched",
    title: info.title,
    cover: { key: DlsiteCache.coverKey(coverUrl), version: 1_005 },
  });
});

test("RJコードが無い候補は未取得", (t) => {
  const { open } = setup(t);
  const source = createCandidateDlsiteSource(open());
  assert.deepEqual(deriveCandidateDlsite(source, null), { state: "none" });
});

test("resolveHead は resolve と同じ判断を、本文を読まずに返す", (t) => {
  const { open, setClock } = setup(t);
  const cache = open();
  const key = { productCode: CODE };
  const withoutHtml = (resolution: ReturnType<DlsiteCache["resolve"]>) => {
    if (resolution.kind !== "html") return resolution;
    const { html: _html, ...head } = resolution;
    return head;
  };
  const assertSame = () =>
    assert.deepEqual(cache.resolveHead(key), withoutHtml(cache.resolve(key)));

  assertSame();
  record(cache);
  assertSame();
  cache.recordFailure({ productCode: CODE, outcome: "not_found" });
  assertSame();
  setClock(1_031);
  assertSame();
  setClock(1_101);
  assertSame();
});

test("cleanupExpired は対応するsnapshotが無い解析結果の行も消す", (t) => {
  const { open, setClock } = setup(t);
  const cache = open();
  record(cache);
  assert.ok(cache.readParsed({ productCode: CODE }));
  setClock(1_101);
  assert.equal(cache.cleanupExpired(), 2);
  assert.equal(cache.readParsed({ productCode: CODE }), null);
});

test("parse_errorで取り直すと、前の解析結果は消える", (t) => {
  const { open, setClock } = setup(t);
  const cache = open();
  record(cache);
  setClock(1_005);
  cache.recordSuccess({
    productCode: CODE,
    outcome: "parse_error",
    contentType: HTML_CONTENT_TYPE,
    html: "<html></html>",
  });
  assert.equal(cache.readParsed({ productCode: CODE }), null);
});
