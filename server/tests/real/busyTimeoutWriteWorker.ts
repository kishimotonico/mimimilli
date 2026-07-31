import { eq } from "drizzle-orm";
import { openDb } from "../../src/adapters/real/db.ts";
import { workStates } from "../../src/adapters/real/userSchema.ts";

export interface BusyTimeoutWriteInput {
  catalogPath: string;
  userPath: string;
  workId: string;
}

type WorkerMessage =
  | { type: "ready" }
  | { type: "write"; input: BusyTimeoutWriteInput }
  | { type: "result"; ok: true; elapsedMs: number }
  | { type: "result"; ok: false; elapsedMs: number; message: string };

function post(message: WorkerMessage): void {
  globalThis.postMessage(message);
}

post({ type: "ready" });

globalThis.onmessage = (event: MessageEvent<Extract<WorkerMessage, { type: "write" }>>) => {
  if (event.data.type !== "write") return;
  const { catalogPath, userPath, workId } = event.data.input;
  const started = performance.now();
  const db = openDb({ kind: "files", catalogPath, userPath });
  try {
    db.user.update(workStates).set({ bookmarked: true }).where(eq(workStates.workId, workId)).run();
    post({ type: "result", ok: true, elapsedMs: performance.now() - started });
  } catch (error) {
    post({
      type: "result",
      ok: false,
      elapsedMs: performance.now() - started,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    db.close();
  }
};
