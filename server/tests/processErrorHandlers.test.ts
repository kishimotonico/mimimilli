import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createUnhandledRejectionReporter,
  registerProcessErrorHandlers,
} from "../src/lib/processErrorHandlers.ts";

type LogCall = { message: string; properties: Record<string, unknown> };

function createLogRecorder() {
  const calls: LogCall[] = [];
  const log = (message: string, properties: Record<string, unknown>) => {
    calls.push({ message, properties });
  };
  return { calls, log };
}

test("createUnhandledRejectionReporter は10のべき乗回目だけログする", () => {
  const recorder = createLogRecorder();
  const report = createUnhandledRejectionReporter(recorder.log);
  const reason = Object.assign(new Error("ENOENT"), { code: "ENOENT" });

  for (let i = 0; i < 100; i++) report(reason);

  assert.equal(recorder.calls.length, 3);
  assert.equal(recorder.calls[0]?.properties.occurrences, 1);
  assert.equal(recorder.calls[1]?.properties.occurrences, 10);
  assert.equal(recorder.calls[2]?.properties.occurrences, 100);
  assert.equal(
    recorder.calls[0]?.message,
    "未処理のPromise拒否を検出しました（プロセスは継続します）",
  );
});

test("createUnhandledRejectionReporter は異なるシグネチャを別々に集計する", () => {
  const recorder = createLogRecorder();
  const report = createUnhandledRejectionReporter(recorder.log);

  report(Object.assign(new Error("fs failure"), { code: "ENOENT" }));
  report(Object.assign(new Error("fs failure"), { code: "EACCES" }));
  report(Object.assign(new Error("fs failure"), { code: "ENOENT" }));

  assert.equal(recorder.calls.length, 2);
  assert.equal(recorder.calls[0]?.properties.code, "ENOENT");
  assert.equal(recorder.calls[0]?.properties.occurrences, 1);
  assert.equal(recorder.calls[1]?.properties.code, "EACCES");
  assert.equal(recorder.calls[1]?.properties.occurrences, 1);
});

test("registerProcessErrorHandlers は unhandledRejection で onUnhandledRejection のみ呼ぶ", () => {
  const listeners = new Map<string, (arg?: unknown) => void>();
  const target = {
    on(event: string, listener: (arg?: unknown) => void) {
      listeners.set(event, listener);
    },
  };

  let unhandledRejectionCalled = false;
  let uncaughtExceptionCalled = false;
  let signalCalled = false;

  registerProcessErrorHandlers({
    target,
    onUnhandledRejection: () => {
      unhandledRejectionCalled = true;
    },
    onUncaughtException: () => {
      uncaughtExceptionCalled = true;
    },
    onSignal: () => {
      signalCalled = true;
    },
  });

  listeners.get("unhandledRejection")?.("rejected");
  assert.equal(unhandledRejectionCalled, true);
  assert.equal(uncaughtExceptionCalled, false);
  assert.equal(signalCalled, false);
});

test("registerProcessErrorHandlers は uncaughtException で onUncaughtException を呼ぶ", () => {
  const listeners = new Map<string, (arg?: unknown) => void>();
  const target = {
    on(event: string, listener: (arg?: unknown) => void) {
      listeners.set(event, listener);
    },
  };

  let uncaughtExceptionCalled = false;

  registerProcessErrorHandlers({
    target,
    onUnhandledRejection: () => {},
    onUncaughtException: () => {
      uncaughtExceptionCalled = true;
    },
    onSignal: () => {},
  });

  listeners.get("uncaughtException")?.(new Error("boom"));
  assert.equal(uncaughtExceptionCalled, true);
});
