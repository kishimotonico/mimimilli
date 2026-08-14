import type { ScanCandidate, ScanResult } from "@mimimilli/shared";
import type { ScanOptions } from "../../adapter/index.ts";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import type { DbLocation } from "./db.ts";
import type { ScanWorkerOutboundMessage } from "./scanWorkerMessages.ts";

const scanLogger = getCategoryLogger("scan");

/** worker 完了時に親プロセスへ渡す内部結果。HTTP/SSE 契約の ScanResult とは分離する。 */
export type FileScanWorkerResult = {
  result: ScanResult;
  candidatePool: ScanCandidate[];
};

function reconstructWorkerError(
  message: Extract<ScanWorkerOutboundMessage, { type: "error" }>,
): Error {
  const error = new Error(message.message);
  if (message.errorKind) error.name = message.errorKind;
  if (message.stack) error.stack = message.stack;
  return error;
}

export type FileScanRunner = (
  database: Extract<DbLocation, { kind: "files" }>,
  root: string,
  dataRoot: string,
  thumbnailCacheDir: string,
  options: ScanOptions,
) => Promise<FileScanWorkerResult>;

export async function runFileScanInWorker(
  database: Extract<DbLocation, { kind: "files" }>,
  root: string,
  dataRoot: string,
  thumbnailCacheDir: string,
  options: ScanOptions,
  testGate?: SharedArrayBuffer,
  testGateStage: "before-scan" | "before-finalize" = "before-scan",
  onTestGateReady?: () => void,
): Promise<FileScanWorkerResult> {
  const abortBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const token = new Int32Array(abortBuffer);
  const worker = new Worker(new URL("./scanWorker.ts", import.meta.url), { type: "module" });
  return new Promise<FileScanWorkerResult>((resolveResult, rejectResult) => {
    let settled = false;
    let terminalReceived = false;
    const abort = () => {
      Atomics.store(token, 0, 1);
      if (testGate) {
        const gate = new Int32Array(testGate);
        Atomics.store(gate, 0, 2);
        Atomics.notify(gate, 0);
      }
    };
    const onMessage = (event: MessageEvent<ScanWorkerOutboundMessage>) => {
      const message = event.data;
      if (message.type === "test-gate-ready") {
        onTestGateReady?.();
        return;
      }
      if (message.type === "progress") {
        options.onProgress?.(message.progress);
        return;
      }
      terminalReceived = true;
      switch (message.type) {
        case "completed":
          settle(() =>
            resolveResult({
              result: message.result,
              candidatePool: message.candidatePool,
            }),
          );
          break;
        case "cancelled":
          settle(() =>
            rejectResult(new DOMException("スキャンはキャンセルされました", "AbortError")),
          );
          break;
        case "error":
          settle(() => rejectResult(reconstructWorkerError(message)));
          break;
      }
    };
    const onError = (event: ErrorEvent) => {
      scanLogger.error("スキャンワーカーでエラーが発生しました", {
        source: "worker-error",
        ...formatError(event.error ?? new Error(event.message)),
      });
      settle(() => rejectResult(event.error ?? new Error(event.message)));
    };
    const onMessageError = () => {
      scanLogger.error("スキャンワーカーでエラーが発生しました", {
        source: "worker-messageerror",
      });
      settle(() => rejectResult(new Error("スキャンワーカーのメッセージを復元できません")));
    };
    const onClose = () => {
      if (!terminalReceived) {
        scanLogger.error("スキャンワーカーでエラーが発生しました", {
          source: "worker-close",
        });
        settle(() => rejectResult(new Error("スキャンワーカーが結果を返さず終了しました")));
      }
    };
    const cleanup = () => {
      options.signal?.removeEventListener("abort", abort);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onMessageError);
      worker.removeEventListener("close", onClose);
      worker.terminate();
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.addEventListener("messageerror", onMessageError);
    worker.addEventListener("close", onClose);
    worker.postMessage({
      type: "start",
      input: {
        database,
        root,
        dataRoot,
        thumbnailCacheDir,
        abortBuffer,
        full: options.full ?? false,
        testGate,
        testGateStage,
      },
    });
  });
}
