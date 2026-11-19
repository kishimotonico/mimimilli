// fetchDlsiteProduct（取得ジョブが1コードずつ呼ぶ取得の本体）の契約を real / fixture 両方に流す。
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import {
  FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE,
  FIXTURE_DLSITE_NOT_FOUND_RJ_CODE,
} from "../src/adapters/fixture/dlsiteMethods.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { htmlResponse, mockDlsiteTransport, sampleWorkHtml } from "./helpers/dlsiteTransport.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";

const OK_CODE = "RJ000001";

interface Subject {
  name: string;
  create(): DataAdapter;
  notFoundCode: string;
  errorCode: string;
}

const subjects: Subject[] = [
  {
    name: "fixture",
    create: () => createFixtureAdapter(),
    notFoundCode: FIXTURE_DLSITE_NOT_FOUND_RJ_CODE,
    errorCode: FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE,
  },
  {
    name: "real",
    create: () =>
      createTestRealAdapter({
        database: { kind: "memory" },
        dlsiteRequestConfig: {
          ...DEFAULT_DLSITE_REQUEST_CONFIG,
          requestIntervalMs: 0,
          retryCount: 0,
          maxBackoffMs: 0,
          timeoutMs: 1_000,
        },
        dlsiteSchedulerDependencies: mockDlsiteTransport({
          html: (code) => {
            if (code === "RJ000403") return htmlResponse("gone", 404);
            if (code === "RJ000404") return htmlResponse("error", 500);
            return htmlResponse(sampleWorkHtml(code, { cover: false }));
          },
        }),
      }),
    notFoundCode: "RJ000403",
    errorCode: "RJ000404",
  },
];

for (const subject of subjects) {
  test(`fetchDlsiteProduct（${subject.name}）: 取得できたコードはfetched、繰り返してもfetched`, async (t) => {
    const adapter = subject.create();
    t.after(() => adapter.close?.());
    assert.equal(await adapter.fetchDlsiteProduct(OK_CODE, { force: false }), "fetched");
    assert.equal(await adapter.fetchDlsiteProduct(OK_CODE, { force: false }), "fetched");
    assert.equal(await adapter.fetchDlsiteProduct(OK_CODE, { force: true }), "fetched");
  });

  test(`fetchDlsiteProduct（${subject.name}）: 該当なしはnot_found、通信エラーはfailed`, async (t) => {
    const adapter = subject.create();
    t.after(() => adapter.close?.());
    assert.equal(
      await adapter.fetchDlsiteProduct(subject.notFoundCode, { force: false }),
      "not_found",
    );
    assert.equal(await adapter.fetchDlsiteProduct(subject.errorCode, { force: false }), "failed");
  });

  test(`fetchDlsiteProduct（${subject.name}）: 失敗の記録は再取得でも保たれ、forceでも同じ結果を取り直す`, async (t) => {
    const adapter = subject.create();
    t.after(() => adapter.close?.());
    await adapter.fetchDlsiteProduct(subject.notFoundCode, { force: false });
    assert.equal(
      await adapter.fetchDlsiteProduct(subject.notFoundCode, { force: false }),
      "not_found",
    );
    assert.equal(
      await adapter.fetchDlsiteProduct(subject.notFoundCode, { force: true }),
      "not_found",
    );
  });

  test(`fetchDlsiteProduct（${subject.name}）: abort済みのsignalは例外で打ち切る`, async (t) => {
    const adapter = subject.create();
    t.after(() => adapter.close?.());
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      adapter.fetchDlsiteProduct(OK_CODE, { force: false, signal: controller.signal }),
    );
  });

  test(`isDlsiteOffline（${subject.name}）: 既定ではオンライン`, (t) => {
    const adapter = subject.create();
    t.after(() => adapter.close?.());
    assert.equal(adapter.isDlsiteOffline(), false);
  });
}
