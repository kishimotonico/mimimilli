// 実Bun.serve経由のSSE受信と、AbortSignalによるサーバー側ジョブ中断を検証する。
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { DataAdapter } from "../../src/adapter/index.ts";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";
import { readResponseText, serveFixtureTransport, waitFor } from "./helpers.ts";

test("scan SSE: 実HTTPで接続時のstateと、以後のprogressとterminalイベントをid無しで受信できる", async (t: TestContext) => {
  let connected!: () => void;
  const connectedGate = new Promise<void>((resolve) => {
    connected = resolve;
  });
  const fixture = createFixtureAdapter({ scenario: "new-work" });
  const adapter: DataAdapter = {
    ...fixture,
    scan: async (options) => {
      await connectedGate;
      return fixture.scan(options);
    },
  };
  const { server, baseUrl } = serveFixtureTransport(adapter);
  t.after(() => server.stop(true));

  const start = await fetch(`${baseUrl}/api/scan`, { method: "POST" });
  assert.equal(start.status, 202);
  const { job } = (await start.json()) as { job: { id: string } };

  const events = await fetch(`${baseUrl}/api/scan/${job.id}/events`);
  assert.equal(events.status, 200);
  assert.equal(events.headers.get("content-type"), "text/event-stream");
  connected();
  const text = await readResponseText(events, (body) => /event: completed/.test(body));
  assert.match(text, /^event: state\n/);
  assert.match(text, /event: progress/);
  assert.match(text, /event: completed/);
  assert.doesNotMatch(text, /^id:/m);
});

test("DLsite取得: 実HTTPのAbortSignalで進行中の取得が中断される", async (t: TestContext) => {
  let fetchStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    fetchStarted = resolve;
  });
  let abortObserved = false;
  const fixture = createFixtureAdapter();
  const adapter = {
    ...fixture,
    dlsiteFetch(_workId: string, _force?: boolean, options?: { signal?: AbortSignal }) {
      fetchStarted();
      return new Promise<never>((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => {
            abortObserved = true;
            reject(new DOMException("The operation was aborted.", "AbortError"));
          },
          { once: true },
        );
      });
    },
  } as unknown as DataAdapter;

  const { server, baseUrl } = serveFixtureTransport(adapter);
  t.after(() => server.stop(true));

  const controller = new AbortController();
  const fetchPromise = fetch(`${baseUrl}/api/dlsite/RJ501001/fetch`, {
    method: "POST",
    signal: controller.signal,
  });
  await started;
  controller.abort();
  await assert.rejects(fetchPromise, (error: unknown) => {
    return error instanceof DOMException && error.name === "AbortError";
  });
  await waitFor(() => abortObserved);
});
