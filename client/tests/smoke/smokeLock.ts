// smoke を実行する全 worktree・全セッションで 1 本ずつに直列化するロック。
// 同時に走らせると CPU が飽和して待ちが超過し、互いに落とし合う（TASK-520）。
// ロックは固定ポートの bind。bind できたプロセスが所有者で、死ねば OS が解放するので
// 異常終了しても取り残されず、PID の判定も一時ファイルも要らない。bind だけで接続はしない（ADR-0020）。
import { createServer, type Server } from "node:net";
import { sleep } from "./processSupport.ts";

// OS の一時ポート範囲（Linux 32768〜、Windows 49152〜）の外で、portless（1355）・backlog（6420）と被らない値
export const SMOKE_LOCK_PORT = 23417;

const POLL_INTERVAL_MS = 2_000;

export interface SmokeLockOptions {
  port?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
  log?: (message: string) => void;
}

/** 取得できれば保持中の server、使用中なら null。それ以外のエラーは投げる。 */
function tryListen(port: number): Promise<Server | null> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") resolvePromise(null);
      else reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.unref();
      resolvePromise(server);
    });
  });
}

/** ロックを取得し、解放関数を返す。他の smoke が走っている間は待つ。signal で待機を中断できる。 */
export async function acquireSmokeLock(
  options: SmokeLockOptions = {},
): Promise<() => Promise<void>> {
  const port = options.port ?? SMOKE_LOCK_PORT;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const log = options.log ?? ((message) => console.log(message));

  let announced = false;
  for (;;) {
    options.signal?.throwIfAborted();
    const server = await tryListen(port);
    if (server) {
      return () =>
        new Promise<void>((resolvePromise) => {
          server.close(() => resolvePromise());
        });
    }
    if (!announced) {
      announced = true;
      log(`別の smoke が実行中です（ポート ${port}）。終了を待っています`);
    }
    await sleep(pollIntervalMs);
  }
}
