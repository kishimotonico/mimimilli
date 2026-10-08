// smoke用のworker単位サーバー起動とテスト間状態リセット。
// fixtureアダプタはBunサーバー1インスタンスにつき可変状態を1つ持つため、workerごとに
// 独立したBun+Viteのペアを立て、各テスト開始前にサーバー側の状態をリセットして分離する。
import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium, test as base } from "@playwright/test";

// fixture状態リセットのHTTP待ちがADR-0020のWSL blackhole（未使用ポートへの接続が
// 約2分ハングする既知障害）を踏まないよう、明示的に短いタイムアウトで打ち切る。
const RESET_FETCH_TIMEOUT_MS = 5_000;

const SUPERVISE_SCRIPT = fileURLToPath(new URL("./superviseProcess.mjs", import.meta.url));

// Viteは--port 0を受け付けない（既定ポートへ戻る）ため、OSに空きポートを借りて渡す。
// 借りたポートは接続せずbindだけで確保する（接続はADR-0020のWSL blackholeを踏みうる）。
function acquireFreePort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("空きポートの取得に失敗しました"));
        return;
      }
      probe.close(() => resolvePromise(address.port));
    });
  });
}

function waitForLog(
  proc: ChildProcess,
  pattern: RegExp,
  timeoutMs: number,
): Promise<RegExpMatchArray> {
  return new Promise((resolvePromise, reject) => {
    let stderrOutput = "";
    let stdoutOutput = "";
    const onStderr = (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    };
    proc.stderr?.on("data", onStderr);

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `起動ログ ${pattern} が見つからないままタイムアウトしました（ログ文言を変更していないか確認）\n${stderrOutput}`,
        ),
      );
    }, timeoutMs);
    const onData = (chunk: Buffer) => {
      stdoutOutput += chunk.toString();
      const match = pattern.exec(stdoutOutput);
      if (match) {
        cleanup();
        resolvePromise(match);
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

// 監督プロセス（superviseProcess.mjs）経由でspawnし、workerが死んだ場合も子が残らないようにする。
function spawnSupervised(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): ChildProcess {
  return spawn(process.execPath, [SUPERVISE_SCRIPT, command, ...args], {
    ...options,
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });
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

export const test = base.extend<
  { resetFixtureState: void },
  { workerServers: WorkerServers; fixtureScenario: string }
>({
  // spec側で test.use({ fixtureScenario }) するとworkerのサーバーがそのシナリオで起動する
  fixtureScenario: ["new-work", { scope: "worker", option: true }],

  workerServers: [
    async ({ fixtureScenario }, use) => {
      let bunProc: ChildProcess | undefined;
      let viteProc: ChildProcess | undefined;

      try {
        bunProc = spawnSupervised("bun", ["src/index.ts"], {
          cwd: "../server",
          env: {
            ...process.env,
            MIMIMILLI_ADAPTER: "fixture",
            MIMIMILLI_MOCK_SCENARIO: fixtureScenario,
            PORT: "0",
          },
        });
        const [, bunPortText] = await waitForLog(
          bunProc,
          /サーバーを起動しました: http:\/\/localhost:(\d+)/,
          120_000,
        );
        const bunPort = Number(bunPortText);

        const vitePort = await acquireFreePort();
        viteProc = spawnSupervised("pnpm", [
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
        ]);
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
