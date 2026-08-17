import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createUnhandledRejectionReporter,
  registerProcessErrorHandlers,
} from "../src/lib/processErrorHandlers.ts";

const MAX_REJECTION_SIGNATURE_COUNT = 256;

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

function createFsReason(message: string, code = "ENOENT") {
  return Object.assign(new Error(message), { code });
}

test("createUnhandledRejectionReporter はシグネチャ保持数の上限を超えない", () => {
  const recorder = createLogRecorder();
  const report = createUnhandledRejectionReporter(recorder.log);

  for (let i = 0; i < 300; i++) {
    report(createFsReason(`/path/file-${i}`));
  }

  assert.ok(
    recorder.calls.some((call) => call.properties.aggregated === true),
    "上限超過後の新規シグネチャがオーバーフローバケットへ集約されること",
  );
});

test("createUnhandledRejectionReporter は上限到達後の新規シグネチャでもログする", () => {
  const recorder = createLogRecorder();
  const report = createUnhandledRejectionReporter(recorder.log);

  for (let i = 0; i < MAX_REJECTION_SIGNATURE_COUNT; i++) {
    report(createFsReason(`seed-${i}`));
  }

  report(createFsReason("overflow-after-limit"));

  assert.ok(
    recorder.calls.some(
      (call) =>
        call.properties.aggregated === true && call.properties.message === "overflow-after-limit",
    ),
    "上限到達後の新規シグネチャが黙って捨てられていないこと",
  );
});

test("createUnhandledRejectionReporter は上限到達前のシグネチャを引き続き個別集計する", () => {
  const recorder = createLogRecorder();
  const report = createUnhandledRejectionReporter(recorder.log);
  const firstReason = createFsReason("tracked-before-limit");

  report(firstReason);
  for (let i = 0; i < MAX_REJECTION_SIGNATURE_COUNT - 1; i++) {
    report(createFsReason(`other-${i}`));
  }

  for (let i = 0; i < 9; i++) {
    report(firstReason);
  }

  assert.ok(
    recorder.calls.some(
      (call) =>
        call.properties.message === "tracked-before-limit" &&
        call.properties.occurrences === 10 &&
        call.properties.aggregated !== true,
    ),
    "上限到達前に登録済みのシグネチャが自分自身のカウンタで数え続けられること",
  );
});
