// 実Bun.serveのgraceful shutdownシーケンスを検証する。
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { DataAdapter } from "../../src/adapter/index.ts";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";
import { getCategoryLogger, initLogger } from "../../src/lib/logger.ts";
import {
  createShutdownHandler,
  performGracefulShutdown,
  runCleanupAndExit,
} from "../../src/serverLifecycle.ts";
import { serveFixtureTransport } from "./helpers.ts";

const emptyScanResult = {
  registered: 0,
  insertedWorkIds: [] as string[],
  updatedWorkIds: [] as string[],
  errors: 0,
  missing: 0,
  rjCodeMissingCount: 0,
  skipped: 0,
  coverErrors: 0,
  identityConflicts: [],
  invalidMetaFiles: [],
  candidates: [],
};

const LOG_MARKER = "transport-shutdown-dispose-marker";

function createSlowScanFixture(): {
  adapter: DataAdapter;
  waitUntilStarted(): Promise<void>;
  wasAborted(): boolean;
} {
  let resolveStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  let abortObserved = false;
  const fixture = createFixtureAdapter();
  const adapter: DataAdapter = {
    ...fixture,
    scan: (options) =>
      new Promise((resolve) => {
        resolveStarted();
        options?.signal?.addEventListener(
          "abort",
          () => {
            abortObserved = true;
            resolve(emptyScanResult);
          },
          { once: true },
        );
      }),
  };
  return {
    adapter,
    waitUntilStarted: () => started,
    wasAborted: () => abortObserved,
  };
}

function withCloseTrack(base: DataAdapter): { adapter: DataAdapter; wasClosed: () => boolean } {
  let closed = false;
  return {
    adapter: {
      ...base,
      close() {
        closed = true;
      },
    },
    wasClosed: () => closed,
  };
}

async function readJsonlLog(logDir: string): Promise<string> {
  const names = await readdir(logDir);
  const logName = names.find((name) => name.endsWith(".jsonl"));
  assert.ok(logName, "ログファイルが作成されていること");
  return readFile(join(logDir, logName), "utf8");
}

async function withLogDir<T>(run: (logDir: string) => Promise<T>): Promise<T> {
  const logDir = await mkdtemp(join(tmpdir(), "mimimilli-transport-shutdown-"));
  try {
    return await run(logDir);
  } finally {
    await rm(logDir, { recursive: true, force: true });
  }
}

test("graceful shutdown: close付きadapterでcloseが呼ばれ、disposeでログがフラッシュされる", async () => {
  await withLogDir(async (logDir) => {
    const { logFilePath } = await initLogger({ logDir });
    assert.ok(logFilePath);

    const scan = createSlowScanFixture();
    const { adapter, wasClosed } = withCloseTrack(scan.adapter);
    const { app, server, baseUrl } = serveFixtureTransport(adapter);

    const start = await fetch(`${baseUrl}/api/scan`, { method: "POST" });
    assert.equal(start.status, 202);
    const { job } = (await start.json()) as { job: { id: string } };
    await scan.waitUntilStarted();

    getCategoryLogger("server").info(LOG_MARKER);
    await performGracefulShutdown({ server, app, adapter });

    assert.equal(scan.wasAborted(), true);
    assert.equal(wasClosed(), true);

    const status = await app.request(`/api/scan/${job.id}`);
    assert.equal(((await status.json()) as { status: string }).status, "cancelled");
    assert.match(await readJsonlLog(logDir), new RegExp(LOG_MARKER));
  });
});

test("graceful shutdown: closeを持たないfixture adapterでもdisposeまで進む", async () => {
  await withLogDir(async (logDir) => {
    const { logFilePath } = await initLogger({ logDir });
    assert.ok(logFilePath);

    const adapter = createFixtureAdapter();
    const { app, server } = serveFixtureTransport(adapter);

    getCategoryLogger("server").info(LOG_MARKER);
    await performGracefulShutdown({ server, app, adapter });

    assert.match(await readJsonlLog(logDir), new RegExp(LOG_MARKER));
  });
});

test("graceful shutdown: server.stopがthrowしてもapp.shutdownとdisposeが実行される", async (t: TestContext) => {
  await withLogDir(async (logDir) => {
    await initLogger({ logDir });

    const scan = createSlowScanFixture();
    const { adapter, wasClosed } = withCloseTrack(scan.adapter);
    const { app, server: realServer, baseUrl } = serveFixtureTransport(adapter);
    t.after(() => realServer.stop(true));
    const server = {
      stop() {
        throw new Error("stop failed");
      },
    };

    const start = await fetch(`${baseUrl}/api/scan`, { method: "POST" });
    assert.equal(start.status, 202);
    await scan.waitUntilStarted();

    getCategoryLogger("server").info(LOG_MARKER);
    await performGracefulShutdown({ server, app, adapter });

    assert.equal(scan.wasAborted(), true);
    assert.equal(wasClosed(), true);
    assert.match(await readJsonlLog(logDir), new RegExp(LOG_MARKER));
  });
});

test("graceful shutdown: app未初期化でもperformGracefulShutdownが完了する", async () => {
  await withLogDir(async (logDir) => {
    await initLogger({ logDir });

    await assert.doesNotReject(() => performGracefulShutdown({ server: { stop() {} } }));
  });
});

test("runCleanupAndExit: クリーンアップ失敗でもexitに到達する", async () => {
  let exitCode: number | undefined;
  await assert.rejects(
    () =>
      runCleanupAndExit(
        async () => {
          throw new Error("cleanup failed");
        },
        1,
        (code) => {
          exitCode = code;
          throw new Error("exit called");
        },
      ),
    /exit called/,
  );
  assert.equal(exitCode, 1);
});

test("runCleanupAndExit: 起動完了後の通常シャットダウンでexitに到達する", async () => {
  await withLogDir(async (logDir) => {
    await initLogger({ logDir });

    const adapter = createFixtureAdapter();
    const { app, server } = serveFixtureTransport(adapter);
    let exitCode: number | undefined;

    await assert.rejects(
      () =>
        runCleanupAndExit(
          () => performGracefulShutdown({ server, app, adapter }),
          0,
          (code) => {
            exitCode = code;
            throw new Error("exit called");
          },
        ),
      /exit called/,
    );
    assert.equal(exitCode, 0);
  });
});

test("graceful shutdown: app.shutdownが戻らなくても期限でワーカーをterminateしadapterをcloseして返る", async () => {
  await withLogDir(async (logDir) => {
    await initLogger({ logDir });

    const { adapter, wasClosed } = withCloseTrack(createFixtureAdapter());
    let terminated = false;
    const hangingApp = { shutdown: () => new Promise<void>(() => {}) };

    const result = await performGracefulShutdown({
      server: { stop() {} },
      app: hangingApp,
      adapter,
      terminateWorkers: () => {
        terminated = true;
      },
      timeoutMs: 20,
    });

    assert.deepEqual(result, { timedOut: true });
    assert.equal(terminated, true);
    assert.equal(wasClosed(), true);
  });
});

test("graceful shutdown: 期限内に完了すればtimedOutはfalse", async () => {
  await withLogDir(async (logDir) => {
    await initLogger({ logDir });

    const result = await performGracefulShutdown({ server: { stop() {} }, timeoutMs: 5_000 });
    assert.deepEqual(result, { timedOut: false });
  });
});

test("runCleanupAndExit: 期限超過時はexit code 1で終了する", async () => {
  let exitCode: number | undefined;
  await assert.rejects(
    () =>
      runCleanupAndExit(
        async () => ({ timedOut: true }),
        0,
        (code) => {
          exitCode = code;
          throw new Error("exit called");
        },
      ),
    /exit called/,
  );
  assert.equal(exitCode, 1);
});

test("shutdownHandler: 終了処理中の2回目の要求は待たずに即時終了コードで終了する", async () => {
  const exits: number[] = [];
  const exit = (code: number): never => {
    exits.push(code);
    throw new Error("exit called");
  };
  let cleanupCalls = 0;
  const handler = createShutdownHandler({
    cleanup: () => {
      cleanupCalls += 1;
      return new Promise<void>(() => {});
    },
    exit,
    log: () => {},
  });

  void handler({ exitCode: 0, immediateExitCode: 130, reason: "SIGINT" });
  await assert.rejects(
    () => handler({ exitCode: 0, immediateExitCode: 130, reason: "SIGINT" }),
    /exit called/,
  );

  assert.deepEqual(exits, [130]);
  assert.equal(cleanupCalls, 1);
});

const STARTUP_FAILURE_TIMEOUT_MS = 10_000;

test("index.ts: 起動途中の失敗で exit code 1 に到達する", async () => {
  const indexPath = join(import.meta.dir, "../../src/index.ts");
  const proc = Bun.spawn({
    cmd: ["bun", indexPath],
    cwd: join(import.meta.dir, ".."),
    env: {
      ...process.env,
      MIMIMILLI_ADAPTER: "invalid-adapter-for-test",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stderr] = await Promise.race([
    Promise.all([proc.exited, new Response(proc.stderr).text()]),
    new Promise<[number, string]>((_, reject) => {
      setTimeout(
        () => reject(new Error("index.ts subprocess timed out")),
        STARTUP_FAILURE_TIMEOUT_MS,
      );
    }),
  ]);

  assert.equal(exitCode, 1);
  assert.match(stderr, /不明な MIMIMILLI_ADAPTER です: invalid-adapter-for-test/);
});
