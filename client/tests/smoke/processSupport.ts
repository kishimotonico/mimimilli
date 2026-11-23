// smoke の起動・停止まわりの補助。Playwright に依存しないので単体テストできる。
import { type ChildProcess, spawnSync } from "node:child_process";

const IS_WINDOWS = process.platform === "win32";
const POLL_INTERVAL_MS = 50;
// SIGKILL 後にグループが消えるのを待つ上限
const FORCE_KILL_WAIT_MS = 2_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/** run が ms 以内に終わらなければ label 付きで reject する。run 自体は打ち切れない。 */
export async function withDeadline<T>(
  run: () => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} が ${ms}ms の期限内に終わりませんでした`)),
      ms,
    );
  });
  try {
    return await Promise.race([run(), expired]);
  } finally {
    clearTimeout(timer);
  }
}

// spawnしたコマンド（pnpm exec cross-env ... vite ... 等）はラッパー越しの子プロセスを持つため、
// ラッパーのPIDだけをkillしても実体（vite・bun本体）が残り、次回起動時のポート衝突を招く。
// POSIX では detached: true でspawnし、プロセスグループごと（-pid）シグナルを送って確実に止める。
// グループはプロセスグループ先頭（監督プロセス）が先に終了しても、残りのメンバーが居る間は残る。
function signalGroup(proc: ChildProcess, signal: NodeJS.Signals): void {
  if (proc.pid === undefined) return;
  try {
    process.kill(-proc.pid, signal);
  } catch {
    // グループが既に消えている場合は何もしない
  }
}

export function isGroupAlive(proc: ChildProcess): boolean {
  if (proc.pid === undefined) return false;
  try {
    process.kill(-proc.pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// プロセスグループは POSIX だけなので、Windows では taskkill /T でプロセスツリーごと止める。
async function shutdownWindows(proc: ChildProcess): Promise<void> {
  if (proc.pid === undefined || proc.exitCode !== null || proc.signalCode !== null) return;
  spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
}

/** 監督プロセスが先に終了していても、残っているグループへ停止通知し、
 *  timeoutMs 待っても残れば SIGKILL する。グループが消えるか上限に達したら戻る。 */
export async function shutdown(proc: ChildProcess, timeoutMs: number): Promise<void> {
  if (IS_WINDOWS) return shutdownWindows(proc);
  signalGroup(proc, "SIGTERM");
  const startedAt = Date.now();
  let forced = false;
  while (isGroupAlive(proc)) {
    const elapsed = Date.now() - startedAt;
    if (!forced && elapsed >= timeoutMs) {
      signalGroup(proc, "SIGKILL");
      forced = true;
    }
    if (forced && elapsed >= timeoutMs + FORCE_KILL_WAIT_MS) return;
    await sleep(POLL_INTERVAL_MS);
  }
}
