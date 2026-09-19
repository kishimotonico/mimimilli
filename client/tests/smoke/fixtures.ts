// smoke用のworker単位サーバー起動とテスト間状態リセット。
// fixtureアダプタはBunサーバー1インスタンスにつき可変状態を1つ持つため、workerごとに
// 独立したBun+Viteのペアを立て、各テスト開始前にサーバー側の状態をリセットして分離する。
import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium, test as base } from "@playwright/test";
import { derivePort } from "./derivePort.ts";

const VITE_PORT_RANGE_START = 4200;
const VITE_PORT_RANGE_SIZE = 500;
const BUN_PORT_RANGE_START = 4700;
const BUN_PORT_RANGE_SIZE = 500;

// fixture状態リセットのHTTP待ちがADR-0020のWSL blackhole（未使用ポートへの接続が
// 約2分ハングする既知障害）を踏まないよう、明示的に短いタイムアウトで打ち切る。
const RESET_FETCH_TIMEOUT_MS = 5_000;

// 直前の実行のサーバーがkillされてからOSがポートを実際に解放するまでにわずかな遅延が
// あるため、次のサーバーをspawnする前にbindを試して空きを確認する。接続（connect）は
// ADR-0020のWSL blackhole（未使用ポートへの接続が約2分ハングする既知障害）を踏むため使わず、
// bindの成否だけで判定する（bindはローカルのカーネル操作でネットワーク接続を伴わない）。
function waitForPortFree(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, reject) => {
    function attempt() {
      const probe = createServer();
      probe.once("error", (err: NodeJS.ErrnoException) => {
        probe.close();
        if (err.code !== "EADDRINUSE") {
          reject(err);
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error(`ポート${port}の解放待ちがタイムアウトしました`));
          return;
        }
        setTimeout(attempt, 100);
      });
      probe.once("listening", () => {
        probe.close(() => resolvePromise());
      });
      probe.listen(port, "127.0.0.1");
    }
    attempt();
  });
}

function waitForLog(proc: ChildProcess, pattern: RegExp, timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    let stderrOutput = "";
    const onStderr = (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    };
    proc.stderr?.on("data", onStderr);

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`起動ログ待ちがタイムアウトしました: ${pattern}\n${stderrOutput}`));
    }, timeoutMs);
    const onData = (chunk: Buffer) => {
      if (pattern.test(chunk.toString())) {
        cleanup();
        resolvePromise();
      }
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`起動ログを待つ前にプロセスが終了しました (code ${code})\n${stderrOutput}`));
    };
    function cleanup() {
      clearTimeout(timer);
      proc.stdout?.off("data", onData);
      proc.stderr?.off("data", onStderr);
      proc.off("exit", onExit);
    }
    proc.stdout?.on("data", onData);
    proc.once("exit", onExit);
  });
}

// Viteの"ready in"ログはサーバー起動時点のもので、依存の事前バンドル（optimizeDeps）は
// 実際にブラウザがモジュールグラフを辿って初回リクエストしたときに走る。workerが4並列で
// 同時にコールドスタートすると、この事前バンドルが各テストのbootTimeout（20s）を圧迫し
// 落ちうるため、worker起動時に一度だけ実ブラウザでページを開いて済ませておく。
async function warmUp(baseURL: string, timeoutMs: number): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.locator(".mle-col.is-axis").waitFor({ state: "visible", timeout: timeoutMs });
  } finally {
    await browser.close();
  }
}

// spawnしたコマンド（pnpm exec cross-env ... vite ... 等）はラッパー越しの子プロセスを持つため、
// ラッパーのPIDだけをkillしても実体（vite・bun本体）が残り、次回起動時のポート衝突を招く。
// detached: true でspawnし、プロセスグループごと（-pid）シグナルを送って確実に止める。
function killGroup(proc: ChildProcess, signal: NodeJS.Signals): void {
  if (proc.pid === undefined) return;
  try {
    process.kill(-proc.pid, signal);
  } catch {
    // グループが既に消えている場合は何もしない
  }
}

async function shutdown(proc: ChildProcess, timeoutMs: number): Promise<void> {
  if (proc.exitCode !== null) return;
  killGroup(proc, "SIGTERM");
  await new Promise<void>((resolvePromise) => {
    const onExit = () => resolvePromise();
    proc.once("exit", onExit);
    setTimeout(() => {
      killGroup(proc, "SIGKILL");
      // SIGKILLは無視されないため、そのまま "exit" イベントを待ち続ければ確実に発火する。
    }, timeoutMs);
  });
}

interface WorkerServers {
  baseURL: string;
  bunBaseURL: string;
}

export const test = base.extend<{ resetFixtureState: void }, { workerServers: WorkerServers }>({
  workerServers: [
    // Playwrightのfixture解決は第1引数のオブジェクト分割代入構文を静的解析するため、
    // 依存fixtureがなくても{}が必須。
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const cwd = process.cwd();
      const bunPort = derivePort(
        cwd,
        BUN_PORT_RANGE_START,
        BUN_PORT_RANGE_SIZE,
        workerInfo.workerIndex,
      );
      const vitePort = derivePort(
        cwd,
        VITE_PORT_RANGE_START,
        VITE_PORT_RANGE_SIZE,
        workerInfo.workerIndex,
      );

      let bunProc: ChildProcess | undefined;
      let viteProc: ChildProcess | undefined;

      try {
        await waitForPortFree(bunPort, 10_000);
        bunProc = spawn("bun", ["src/index.ts"], {
          cwd: "../server",
          env: {
            ...process.env,
            MIMIMILLI_ADAPTER: "fixture",
            MIMIMILLI_MOCK_SCENARIO: "new-work",
            PORT: String(bunPort),
          },
          stdio: ["ignore", "pipe", "pipe"],
          detached: true,
        });
        await waitForLog(bunProc, /サーバーを起動しました/, 120_000);

        await waitForPortFree(vitePort, 10_000);
        viteProc = spawn(
          "pnpm",
          [
            "exec",
            "cross-env",
            "VITE_DISABLE_QUERY_DEVTOOLS=1",
            `MIMIMILLI_BACKEND_URL=http://127.0.0.1:${bunPort}`,
            "vite",
            "--host",
            "127.0.0.1",
            "--port",
            String(vitePort),
            "--strictPort",
          ],
          { stdio: ["ignore", "pipe", "pipe"], detached: true },
        );
        await waitForLog(viteProc, /ready in/, 120_000);
        await warmUp(`http://127.0.0.1:${vitePort}`, 60_000);

        await use({
          baseURL: `http://127.0.0.1:${vitePort}`,
          bunBaseURL: `http://127.0.0.1:${bunPort}`,
        });
      } finally {
        if (viteProc) await shutdown(viteProc, 500);
        if (bunProc) await shutdown(bunProc, 5_000);
      }
    },
    { scope: "worker" },
  ],

  baseURL: async ({ workerServers }, use) => {
    await use(workerServers.baseURL);
  },

  resetFixtureState: [
    async ({ workerServers }, use) => {
      const res = await fetch(`${workerServers.bunBaseURL}/api/__test__/reset`, {
        method: "POST",
        signal: AbortSignal.timeout(RESET_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`fixture状態のリセットに失敗しました: ${res.status}`);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
