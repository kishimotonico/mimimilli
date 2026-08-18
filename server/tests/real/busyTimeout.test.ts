import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import type { Work } from "@mimimilli/shared";
import { openDb } from "../../src/adapters/real/db.ts";
import { SQLITE_BUSY_TIMEOUT_MS } from "../../src/adapters/real/sqliteConnection.ts";
import { createWorkRepos, upsertTestWork, resolvedDuration } from "../helpers/workTestUtils.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";
import type { BusyTimeoutWriteInput } from "./busyTimeoutWriteWorker.ts";

const WORK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOCK_HOLD_MS = 150;

function workerFailureError(phase: string, event: Event): Error {
  const { message, filename, lineno, colno, error } = event as ErrorEvent;
  const detail = error ?? new Error(message);
  const location = filename ? ` (${filename}:${lineno}:${colno})` : "";
  const stack = detail.stack ?? (message !== detail.message ? message : undefined);
  const body = stack ? `${detail.message}\n${stack}` : detail.message;
  return new Error(`Worker failed to ${phase}${location}: ${body}`);
}

function sampleWork(): Work {
  const playlistId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  return {
    id: WORK_ID,
    title: "busy_timeout検証",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/library/busy-timeout",
    totalDurationSec: 10,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            title: "track",
            file: "track.wav",
            ...resolvedDuration(60),
          },
        ],
      },
    ],
    bookmarked: false,
    lastPlayedAt: null,
    resume: null,
    dlsite: {
      rjCode: null,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    },
  };
}

function waitForWorkerMessage(
  worker: Worker,
  types: string[],
  phase: string,
): Promise<{ type: string; ok?: boolean; elapsedMs?: number; message?: string }> {
  const expected = new Set(types);
  return new Promise((resolve, reject) => {
    const onMessage = (
      event: MessageEvent<{ type: string; ok?: boolean; elapsedMs?: number; message?: string }>,
    ) => {
      if (!expected.has(event.data.type)) return;
      worker.removeEventListener("message", onMessage);
      resolve(event.data);
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", (event) => reject(workerFailureError(phase, event)));
  });
}

async function runContendedWrite(input: BusyTimeoutWriteInput): Promise<{
  ok: boolean;
  elapsedMs: number;
  message?: string;
}> {
  const worker = new Worker(new URL("./busyTimeoutWriteWorker.ts", import.meta.url), {
    type: "module",
  });
  try {
    await waitForWorkerMessage(worker, ["ready"], "start");

    const locker = new Database(input.userPath);
    locker.exec("BEGIN IMMEDIATE");
    locker.run("UPDATE work_states SET bookmarked = 0 WHERE work_id = ?", [input.workId]);

    const resultPromise = waitForWorkerMessage(worker, ["result"], "write").then((event) => ({
      ok: event.ok === true,
      elapsedMs: event.elapsedMs ?? 0,
      message: event.message,
    }));

    worker.postMessage({ type: "write", input });
    await new Promise((resolve) => setTimeout(resolve, LOCK_HOLD_MS));
    locker.exec("COMMIT");
    locker.close();

    return await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("contended write timed out")),
          SQLITE_BUSY_TIMEOUT_MS + 1_000,
        ),
      ),
    ]);
  } finally {
    worker.terminate();
  }
}

test("openDb接続にbusy_timeoutが設定される", (t) => {
  const directory = makeTestDirectory("busy-timeout-pragma");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.sqlite");
  const userPath = join(directory.path, "user.sqlite");
  const db = directory.own(openDb({ kind: "files", catalogPath, userPath }));
  const catalog = db.sqlite.query("PRAGMA busy_timeout").get() as { timeout: number };
  assert.equal(catalog.timeout, SQLITE_BUSY_TIMEOUT_MS);
});

test("別接続が書き込みロックを保持中でもbusy_timeoutにより書き込みが待機して成功する", async (t) => {
  const directory = makeTestDirectory("busy-timeout-write");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.sqlite");
  const userPath = join(directory.path, "user.sqlite");
  const input = { catalogPath, userPath, workId: WORK_ID };

  const seed = openDb({ kind: "files", catalogPath, userPath });
  const { catalog, user } = createWorkRepos(seed);
  upsertTestWork(catalog, user, sampleWork());
  seed.close();

  const result = await runContendedWrite(input);

  assert.equal(result.ok, true, result.message);
  assert.ok(
    result.elapsedMs >= LOCK_HOLD_MS - 30,
    `expected to wait for lock release, elapsed=${result.elapsedMs}ms`,
  );
});
