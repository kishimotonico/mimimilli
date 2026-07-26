import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveDlsiteRequestConfig,
  DEFAULT_DLSITE_USER_AGENT,
} from "../../src/adapters/real/dlsiteConfig.ts";
import { DlsiteOfflineError, DlsiteScheduler } from "../../src/adapters/real/dlsiteScheduler.ts";

function fakeTime(initial = 0) {
  let current = initial;
  const sleeps: number[] = [];
  return {
    now: () => current,
    sleeps,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      current += ms;
    },
  };
}

const config = {
  offline: false,
  requestIntervalMs: 100,
  retryCount: 2,
  maxBackoffMs: 1_000,
  timeoutMs: 10_000,
  userAgent: DEFAULT_DLSITE_USER_AGENT,
};

test("DLsite scheduler: 実HTTP開始時刻の間隔、retry、request counterを一元化する", async () => {
  const time = fakeTime();
  const starts: number[] = [];
  let calls = 0;
  const events: Record<string, unknown>[] = [];
  const scheduler = new DlsiteScheduler(config, {
    now: time.now,
    sleep: time.sleep,
    random: () => 0.5,
    logger: (event) => events.push(event),
    transport: async () => {
      starts.push(time.now());
      calls += 1;
      return new Response(null, { status: calls === 1 ? 500 : 200 });
    },
  });

  assert.equal((await scheduler.fetch("https://www.dlsite.com/a")).status, 200);
  assert.equal((await scheduler.fetch("https://img.dlsite.jp/b")).status, 200);
  assert.deepEqual(starts, [0, 1_000, 1_100]);
  assert.equal(events.filter((event) => event.event === "dlsite_http_request").length, 3);
  assert.deepEqual(time.sleeps, [1_000, 100]);
});

test("DLsite scheduler: Retry-After cooldownは後続リクエストにも適用する", async () => {
  const time = fakeTime();
  const starts: number[] = [];
  let calls = 0;
  const scheduler = new DlsiteScheduler(
    { ...config, retryCount: 0 },
    {
      now: time.now,
      sleep: time.sleep,
      transport: async () => {
        starts.push(time.now());
        calls += 1;
        return new Response(null, {
          status: calls === 1 ? 429 : 200,
          headers: calls === 1 ? { "retry-after": "3" } : undefined,
        });
      },
    },
  );

  // retryなしでも429/503のcooldownは共有する。
  await scheduler.fetch("https://www.dlsite.com/a");
  await scheduler.fetch("https://img.dlsite.jp/b");
  assert.deepEqual(starts, [0, 3_000]);
});

test("DLsite scheduler: 先行がqueue解放前にcooldownを更新するため、待機中の後続にも即座に反映する", async () => {
  const time = fakeTime();
  const starts: number[] = [];
  let calls = 0;
  let releaseFirst!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => (releaseFirst = resolve));
  const scheduler = new DlsiteScheduler(
    { ...config, requestIntervalMs: 0, retryCount: 0 },
    {
      now: time.now,
      sleep: time.sleep,
      transport: async () => {
        calls += 1;
        starts.push(time.now());
        if (calls === 1) return pending;
        return new Response(null, { status: 200 });
      },
    },
  );

  const first = scheduler.fetch("https://www.dlsite.com/a");
  // 先行が429を返す前に後続をqueueへ積んでおく。
  const second = scheduler.fetch("https://www.dlsite.com/b");
  releaseFirst(new Response(null, { status: 429, headers: { "retry-after": "3" } }));

  await first;
  await second;
  assert.deepEqual(starts, [0, 3_000]);
});

test("DLsite scheduler: jitter後もmaxBackoffを超えず、retry responseのbodyをcancelする", async () => {
  const time = fakeTime();
  let cancelled = false;
  let calls = 0;
  const scheduler = new DlsiteScheduler(
    { ...config, requestIntervalMs: 0, maxBackoffMs: 100, retryCount: 1 },
    {
      now: time.now,
      sleep: time.sleep,
      random: () => 1,
      transport: async () => {
        calls += 1;
        if (calls === 1) {
          const body = new ReadableStream({ cancel: () => void (cancelled = true) });
          return new Response(body, { status: 500 });
        }
        return new Response("ok");
      },
    },
  );
  await scheduler.fetch("https://www.dlsite.com/a");
  assert.deepEqual(time.sleeps, [100]);
  assert.equal(cancelled, true);
});

test("DLsite scheduler: Retry-Afterのdelta/dateが総期限を超える場合は待機しない", async () => {
  for (const retryAfter of ["2", new Date(2_000).toUTCString()]) {
    const time = fakeTime();
    const scheduler = new DlsiteScheduler(
      { ...config, retryCount: 0, timeoutMs: 1_000 },
      {
        now: time.now,
        sleep: time.sleep,
        transport: async () =>
          new Response(null, { status: 429, headers: { "retry-after": retryAfter } }),
      },
    );
    await scheduler.fetch("https://www.dlsite.com/a");
    await assert.rejects(() => scheduler.fetch("https://www.dlsite.com/b"), /総期限/);
    assert.deepEqual(time.sleeps, []);
  }
});

test("DLsite scheduler: offlineとAbortを明示的に伝播する", async () => {
  const offline = new DlsiteScheduler({ ...config, offline: true });
  await assert.rejects(() => offline.fetch("https://www.dlsite.com/a"), DlsiteOfflineError);

  const controller = new AbortController();
  controller.abort();
  const scheduler = new DlsiteScheduler(config, { transport: async () => new Response("ok") });
  await assert.rejects(
    () => scheduler.fetch("https://www.dlsite.com/a", { signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("DLsite scheduler: queue待機とcooldown待機のAbortはtransportを増やさず即時に返す", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  let calls = 0;
  const scheduler = new DlsiteScheduler(
    { ...config, requestIntervalMs: 0 },
    {
      transport: async () => {
        calls += 1;
        if (calls === 1) await pending;
        return new Response(null, { status: 200 });
      },
    },
  );
  const first = scheduler.fetch("https://www.dlsite.com/a");
  const queued = new AbortController();
  const second = scheduler.fetch("https://www.dlsite.com/b", { signal: queued.signal });
  queued.abort();
  await assert.rejects(
    second,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(calls, 1);
  release();
  await first;
  await scheduler.fetch("https://www.dlsite.com/after-abort");
  assert.equal(calls, 2);

  const cooldown = new DlsiteScheduler(
    { ...config, retryCount: 0 },
    {
      transport: async () => new Response(null, { status: 429, headers: { "retry-after": "10" } }),
    },
  );
  await cooldown.fetch("https://www.dlsite.com/c");
  const controller = new AbortController();
  const sleeping = cooldown.fetch("https://www.dlsite.com/d", { signal: controller.signal });
  controller.abort();
  await assert.rejects(
    sleeping,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("DLsite scheduler: scheduleの間隔待機中もAbortで即時に返す", async () => {
  const time = fakeTime();
  let operations = 0;
  const scheduler = new DlsiteScheduler(
    { ...config, requestIntervalMs: 5_000 },
    {
      now: time.now,
      sleep: time.sleep,
      transport: async () => new Response(null, { status: 200 }),
    },
  );
  await scheduler.schedule(async () => {
    operations += 1;
    return "first";
  });
  const controller = new AbortController();
  const pending = scheduler.schedule(async () => {
    operations += 1;
    return "second";
  }, controller.signal);
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(operations, 1);
});

test("DLsite scheduler: HTTP待機中のAbortはtimeoutSignal経由で打ち切る", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let transportReady!: () => void;
  const started = new Promise<void>((resolve) => (transportReady = resolve));
  const controller = new AbortController();
  let transportCalls = 0;
  const scheduler = new DlsiteScheduler(
    { ...config, requestIntervalMs: 0, timeoutMs: 60_000 },
    {
      transport: async (_input, init) => {
        transportCalls += 1;
        transportReady();
        const aborted = new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("DLsiteリクエストはキャンセルされました", "AbortError")),
            { once: true },
          );
        });
        await Promise.race([gate, aborted]);
        return new Response(null, { status: 200 });
      },
    },
  );
  const pending = scheduler.fetch("https://www.dlsite.com/a", { signal: controller.signal });
  await started;
  assert.equal(transportCalls, 1);
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  release();
});

test("DLsite scheduler: リトライのバックオフ待機中もAbortで即時に返す", async () => {
  let releaseSleep!: () => void;
  const sleepGate = new Promise<void>((resolve) => (releaseSleep = resolve));
  let backoffEntered!: () => void;
  const backoffStarted = new Promise<void>((resolve) => (backoffEntered = resolve));
  let transportCalls = 0;
  const controller = new AbortController();
  const scheduler = new DlsiteScheduler(
    { ...config, requestIntervalMs: 0, retryCount: 2 },
    {
      random: () => 0.5,
      sleep: async (_ms, signal) => {
        backoffEntered();
        const aborted = new Promise<never>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("DLsiteリクエストはキャンセルされました", "AbortError")),
            { once: true },
          );
        });
        await Promise.race([sleepGate, aborted]);
      },
      transport: async () => {
        transportCalls += 1;
        return new Response(null, { status: 500 });
      },
    },
  );
  const pending = scheduler.fetch("https://www.dlsite.com/a", { signal: controller.signal });
  await backoffStarted;
  assert.equal(transportCalls, 1);
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  releaseSleep();
});

test("DLsite scheduler: 404はretryしない", async () => {
  let calls = 0;
  const scheduler = new DlsiteScheduler(config, {
    transport: async () => {
      calls += 1;
      return new Response(null, { status: 404 });
    },
  });
  assert.equal((await scheduler.fetch("https://www.dlsite.com/a")).status, 404);
  assert.equal(calls, 1);
});

test("DLsite request設定: booleanと数値環境変数を厳格に読む", () => {
  assert.deepEqual(resolveDlsiteRequestConfig({}), {
    offline: false,
    requestIntervalMs: 1_000,
    retryCount: 3,
    maxBackoffMs: 30_000,
    timeoutMs: 60_000,
    userAgent: DEFAULT_DLSITE_USER_AGENT,
  });
  assert.equal(resolveDlsiteRequestConfig({ MIMIMILLI_DLSITE_OFFLINE: "true" }).offline, true);
  assert.throws(() => resolveDlsiteRequestConfig({ MIMIMILLI_DLSITE_OFFLINE: "1" }));
  assert.throws(() => resolveDlsiteRequestConfig({ MIMIMILLI_DLSITE_RETRY_COUNT: "-1" }));
  assert.throws(() => resolveDlsiteRequestConfig({ MIMIMILLI_DLSITE_TIMEOUT_MS: "2147483648" }));
});

test("DLsite request設定: MIMIMILLI_DLSITE_USER_AGENTでUser-Agentを上書きする", () => {
  const custom = "custom-agent/2.0 (+mailto:me@example.com)";
  assert.equal(
    resolveDlsiteRequestConfig({ MIMIMILLI_DLSITE_USER_AGENT: custom }).userAgent,
    custom,
  );
  assert.throws(() => resolveDlsiteRequestConfig({ MIMIMILLI_DLSITE_USER_AGENT: "" }));
});
