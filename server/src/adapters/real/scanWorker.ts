import type { ScanProgressEvent, ScanResult } from "@mimimilli/shared";
import { openDb, type Db, type DbLocation } from "./db.ts";
import { Scanner } from "./scanner.ts";
import { finalizeScan } from "./scanFinalize.ts";
import { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import { WorkQueryRepository } from "./workQueryRepository.ts";

interface WorkerInput {
  database: Extract<DbLocation, { kind: "files" }>;
  root: string;
  dataRoot: string;
  thumbnailCacheDir: string;
  abortBuffer: SharedArrayBuffer;
  full?: boolean;
  testGate?: SharedArrayBuffer;
  testGateStage: "before-scan" | "before-finalize";
}

type WorkerMessage = { type: "start"; input: WorkerInput };
type TerminalMessage =
  | { type: "completed"; result: ScanResult }
  | { type: "cancelled" }
  | { type: "error"; message: string; errorKind?: string; stack?: string };

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
    const query = new WorkQueryRepository(db);
    const catalog = new CatalogWorkRepository(db);
    const user = new UserWorkStateRepository(db);
    const scanner = new Scanner(db, { query, catalog, user });
    const result = await scanner.scan(
      input.root,
      {
        full: input.full ?? false,
        onProgress: (progress: ScanProgressEvent) => post({ type: "progress", progress }),
      },
      {
        abortToken: token,
        beforeFinalize: input.testGateStage === "before-finalize" ? waitAtTestGate : undefined,
      },
    );
    if (cancelled(token)) {
      terminal = { type: "cancelled" };
    } else {
      await finalizeScan({
        query,
        catalog,
        thumbnailCacheDir: input.thumbnailCacheDir,
        throwIfCancelled: () => {
          if (cancelled(token)) throw new Error("スキャンはキャンセルされました");
        },
        integrityLogContext: "scan-worker-thumbnail-gc",
      });
      if (cancelled(token)) {
        terminal = { type: "cancelled" };
      } else {
        terminal = { type: "completed", result };
      }
    }
  } catch (error) {
    terminal = cancelled(token)
      ? { type: "cancelled" }
      : {
          type: "error",
          message: error instanceof Error ? error.message : "スキャンに失敗しました",
          errorKind: error instanceof Error ? error.name : undefined,
          stack: error instanceof Error ? error.stack : undefined,
        };
  } finally {
    db?.close();
  }

  post(terminal);
  globalThis.close();
}
