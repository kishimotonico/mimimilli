// smoke用のworker単位サーバー起動とテスト間状態リセット。
// fixtureアダプタはBunサーバー1インスタンスにつき可変状態を1つ持つため、workerごとに
// 独立したBun+Viteのペアを立て、各テスト開始前にサーバー側の状態をリセットして分離する。
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { loadavg } from "node:os";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, test as base } from "@playwright/test";
import { NETWORK_CHANGE_NOTICE, watchNetworkChange } from "./networkChange.ts";
import { shutdown, withDeadline } from "./processSupport.ts";

// fixture状態リセットのHTTP待ちがADR-0020のWSL blackhole（未使用ポートへの接続が
// 約2分ハングする既知障害）を踏まないよう、明示的に短いタイムアウトで打ち切る。
const RESET_FETCH_TIMEOUT_MS = 5_000;

// 起動の各フェーズの上限。実測の最大は bun 1.3s・vite 4.1s・warmUp 34s（CPU負荷48本・Vite cache なし）。
// fixture 全体の timeout は上限の合計から導き、各フェーズが診断付きで先に落ちるようにする。
const BUN_LOG_TIMEOUT_MS = 60_000;
const VITE_LOG_TIMEOUT_MS = 60_000;
const WARM_UP_TIMEOUT_MS = 90_000;
const BROWSER_CLOSE_TIMEOUT_MS = 5_000;
const FIXTURE_SETUP_MARGIN_MS = 30_000;
const WORKER_SERVERS_TIMEOUT_MS =
  BUN_LOG_TIMEOUT_MS +
  VITE_LOG_TIMEOUT_MS +
  WARM_UP_TIMEOUT_MS +
  BROWSER_CLOSE_TIMEOUT_MS +
  FIXTURE_SETUP_MARGIN_MS;

const SUPERVISE_SCRIPT = fileURLToPath(new URL("./superviseProcess.mjs", import.meta.url));

// Viteは--port 0を受け付けない（既定ポートへ戻る）ため、OSに空きポートを借りて開始ポートとして
// 渡す。借りて閉じたあとに他のworkerが同じポートを取りうるので、Viteには--strictPortを付けず、
// 使用中なら次のポートへ進ませる（Viteが実際にbindして決めるので取り合いにならない）。
// 実際のポートは起動ログから読む。借りるときは接続せずbindだけで確保する
// （接続はADR-0020のWSL blackholeを踏みうる）。
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

// 起動待ちで落ちたときの原因切り分け用。各フェーズの経過時間と、その時点のリッスン中ポート・
// 負荷をエラーメッセージに添える（待っていたもの・待った時間・ポート衝突・負荷の区別がつくように）。
class StartupTrace {
  private readonly startedAt = Date.now();
  private readonly phases: string[] = [];
  private phase = "開始前";
  private phaseStartedAt = Date.now();

  begin(phase: string): void {
    this.end();
    this.phase = phase;
    this.phaseStartedAt = Date.now();
  }

  end(): void {
    if (this.phase !== "開始前") {
      this.phases.push(`${this.phase}: ${Date.now() - this.phaseStartedAt}ms`);
    }
    this.phase = "完了";
  }

  report(extra: Record<string, string | number>): string {
    const waitedMs = Date.now() - this.phaseStartedAt;
    let listening: string;
    try {
      listening = execFileSync("ss", ["-ltnpH"], { encoding: "utf8", timeout: 3_000 }).trim();
    } catch (error) {
      listening = `ss の実行に失敗: ${String(error)}`;
    }
    return [
      `[smoke起動診断] 待機中フェーズ: ${this.phase}（${waitedMs}ms 待機、開始から ${Date.now() - this.startedAt}ms）`,
      `完了済み: ${this.phases.join(", ") || "なし"}`,
      `ポート: ${JSON.stringify(extra)}`,
      `loadavg: ${loadavg()
        .map((v) => v.toFixed(1))
        .join(" ")}`,
      `ss -ltnp:\n${listening}`,
    ].join("\n");
  }
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
// launch・newPage・遷移・要素待ちを1つの期限（timeoutMs）で打ち切る。後始末（close）は別の短い上限で、
// 期限切れでもブラウザーの終了待ちで診断が遅れないようにする。
async function warmUp(baseURL: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());
  let browser: Browser | undefined;
  let sawNetworkChange = () => false;
  try {
    await withDeadline(
      async () => {
        browser = await chromium.launch({ timeout: remaining() });
        const page = await browser.newPage();
        sawNetworkChange = watchNetworkChange(page);
        await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: remaining() });
        await page.locator(".mll-sidebar").waitFor({ state: "visible", timeout: remaining() });
      },
      timeoutMs,
      "warmUp",
    );
  } catch (error) {
    if (error instanceof Error && sawNetworkChange()) error.message += `\n${NETWORK_CHANGE_NOTICE}`;
    throw error;
  } finally {
    const opened = browser;
    if (opened) {
      await withDeadline(() => opened.close(), BROWSER_CLOSE_TIMEOUT_MS, "browser.close").catch(
        () => undefined,
      );
    }
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

interface WorkerServers {
  baseURL: string;
  bunBaseURL: string;
}

export const test = base.extend<
  { resetFixtureState: void; networkChangeNotice: void },
  { workerServers: WorkerServers; fixtureScenario: string; dlsiteFetchDelayMs: number }
>({
  // spec側で test.use({ fixtureScenario }) するとworkerのサーバーがそのシナリオで起動する
  fixtureScenario: ["new-work", { scope: "worker", option: true }],
  // 取得中の表示を観測したいspecだけ test.use({ dlsiteFetchDelayMs }) で遅延を足す
  dlsiteFetchDelayMs: [0, { scope: "worker", option: true }],

  workerServers: [
    async ({ fixtureScenario, dlsiteFetchDelayMs }, use) => {
      let bunProc: ChildProcess | undefined;
      let viteProc: ChildProcess | undefined;
      const trace = new StartupTrace();
      const ports: Record<string, string | number> = {};
      let servers: WorkerServers;

      try {
        try {
          trace.begin("bunサーバー起動ログ待ち");
          bunProc = spawnSupervised("bun", ["src/index.ts"], {
            cwd: "../server",
            env: {
              ...process.env,
              MIMIMILLI_ADAPTER: "fixture",
              MIMIMILLI_MOCK_SCENARIO: fixtureScenario,
              MIMIMILLI_MOCK_DLSITE_FETCH_DELAY_MS: String(dlsiteFetchDelayMs),
              PORT: "0",
            },
          });
          const [, bunPortText] = await waitForLog(
            bunProc,
            /サーバーを起動しました: http:\/\/localhost:(\d+)\s/,
            BUN_LOG_TIMEOUT_MS,
          );
          const bunPort = Number(bunPortText);
          ports.bun = bunPort;

          trace.begin("vite起動ログ待ち");
          const startPort = await acquireFreePort();
          ports.viteStart = startPort;
          // ポート番号を色付きのエスケープ無しで読めるよう、色を切って起動する
          const { FORCE_COLOR: _forceColor, ...baseEnv } = process.env;
          viteProc = spawnSupervised(
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
              String(startPort),
            ],
            { env: { ...baseEnv, NO_COLOR: "1" } },
          );
          const [, vitePortText] = await waitForLog(
            viteProc,
            /Local:\s+http:\/\/127\.0\.0\.1:(\d+)\//,
            VITE_LOG_TIMEOUT_MS,
          );
          const vitePort = Number(vitePortText);
          ports.vite = vitePort;

          trace.begin("warmUp（実ブラウザの初回表示）");
          await warmUp(`http://127.0.0.1:${vitePort}`, WARM_UP_TIMEOUT_MS);
          trace.end();
          servers = {
            baseURL: `http://127.0.0.1:${vitePort}`,
            bunBaseURL: `http://127.0.0.1:${bunPort}`,
          };
        } catch (error) {
          if (error instanceof Error) error.message += `\n${trace.report(ports)}`;
          throw error;
        }

        await use(servers);
      } finally {
        if (viteProc) await shutdown(viteProc, 500);
        if (bunProc) await shutdown(bunProc, 5_000);
      }
    },
    // 既定ではテストのタイムアウト（30s）が起動にも掛かり、4worker同時のコールドスタートで
    // 打ち切られる。各フェーズの上限の合計より長く取り、診断付きの失敗を先に出す。
    { scope: "worker", timeout: WORKER_SERVERS_TIMEOUT_MS },
  ],

  baseURL: async ({ workerServers }, use) => {
    await use(workerServers.baseURL);
  },

  networkChangeNotice: [
    async ({ page }, use, testInfo) => {
      const sawNetworkChange = watchNetworkChange(page);
      await use();
      if (testInfo.status !== testInfo.expectedStatus && sawNetworkChange()) {
        testInfo.annotations.push({ type: "環境", description: NETWORK_CHANGE_NOTICE });
        console.error(`${testInfo.title}\n${NETWORK_CHANGE_NOTICE}`);
      }
    },
    { auto: true },
  ],

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
