import { join } from "node:path";
import type { ScanProgressEvent, ScanResult } from "@mimimilli/shared";
import { migrateResumeV1, openDb, type Db, type DbLocation } from "./db.ts";
import { resolveWithin } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import { gcThumbnailCache, type WorkCoverEntry } from "./thumbnailCache.ts";
import { WorkRepo } from "./workRepo.ts";

interface WorkerInput {
  database: Extract<DbLocation, { kind: "files" }>;
  root: string;
  dataRoot: string;
  thumbnailCacheDir: string;
  abortBuffer: SharedArrayBuffer;
  testGate?: SharedArrayBuffer;
  testGateStage: "before-scan" | "before-finalize";
}

type WorkerMessage = { type: "start"; input: WorkerInput };
type TerminalMessage =
  | { type: "completed"; result: ScanResult }
  | { type: "cancelled" }
  | { type: "error"; message: string };

function post(message: unknown): void {
  globalThis.postMessage(message);
}

function cancelled(token: Int32Array): boolean {
  return Atomics.load(token, 0) !== 0;
}

globalThis.onmessage = (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type !== "start") return;
  void run(event.data.input);
};

async function run(input: WorkerInput): Promise<void> {
  const token = new Int32Array(input.abortBuffer);
  let terminal: TerminalMessage;
  let db: Db | null = null;
  try {
    db = openDb(input.database);
    const waitAtTestGate = (): void => {
      if (!input.testGate) return;
      const gate = new Int32Array(input.testGate);
      post({ type: "test-gate-ready" });
      while (!cancelled(token) && Atomics.load(gate, 0) === 0) {
        Atomics.wait(gate, 0, 0, 100);
      }
    };
    if (input.testGateStage === "before-scan") waitAtTestGate();
    if (cancelled(token)) throw new Error("スキャンはキャンセルされました");
    const repo = new WorkRepo(db);
    const scanner = new Scanner(db, repo, input.dataRoot);
    const result = await scanner.scan(input.root, {
      abortToken: token,
      onProgress: (progress: ScanProgressEvent) => post({ type: "progress", progress }),
      beforeFinalize: input.testGateStage === "before-finalize" ? waitAtTestGate : undefined,
    });
    if (cancelled(token)) {
      terminal = { type: "cancelled" };
    } else {
      // resume移行開始前に必ずcancel tokenを確認する。
      migrateResumeV1(db.sqlite, () => {
        if (cancelled(token)) throw new Error("スキャンはキャンセルされました");
      });
      if (cancelled(token)) {
        terminal = { type: "cancelled" };
      } else {
        const covers: WorkCoverEntry[] = [];
        for (const work of repo.listSummaries()) {
          if (cancelled(token)) break;
          if (!work.cover) continue;
          const absolutePath = resolveWithin(
            work.physicalPath,
            join(work.physicalPath, work.cover.image),
          );
          if (absolutePath) {
            covers.push({ workId: work.id, coverAbsolutePath: absolutePath });
          }
        }
        if (cancelled(token)) {
          terminal = { type: "cancelled" };
        } else {
          await gcThumbnailCache(input.thumbnailCacheDir, covers, {
            throwIfCancelled: () => {
              if (cancelled(token)) throw new Error("スキャンはキャンセルされました");
            },
          });
          if (cancelled(token)) {
            terminal = { type: "cancelled" };
          } else {
            repo.setScanState("last_scan_time", new Date().toISOString());
            terminal = { type: "completed", result };
          }
        }
      }
    }
  } catch (error) {
    terminal = cancelled(token)
      ? { type: "cancelled" }
      : {
          type: "error",
          message: error instanceof Error ? error.message : "スキャンに失敗しました",
        };
  } finally {
    db?.close();
  }

  // 親はterminal受信か、terminal前のerror/messageerror/closeのいずれかで必ずsettleする。
  post(terminal);
  globalThis.close();
}
