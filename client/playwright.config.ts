import { createHash } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// worktreeの絶対パスから決定的にポートを導出する。同一worktreeなら常に同じポートになる。
// 予約済みの固定ポート（旧smokePort=4175、real-adapter検証用の手動起動サーバー=4177）を避けた帯域。
// webServerはログ待ち方式（ADR-0020）でreuseExistingServerを参照しないため、
// ポートが衝突した場合はVite側は--strictPort、Bun側はbind失敗で明示的に落ちる。
const VITE_PORT_RANGE_START = 4200;
const VITE_PORT_RANGE_SIZE = 500;
const BUN_PORT_RANGE_START = 4700;
const BUN_PORT_RANGE_SIZE = 500;

function derivePort(rangeStart: number, rangeSize: number): number {
  const offset = createHash("sha256").update(process.cwd()).digest().readUInt32BE(0) % rangeSize;
  return rangeStart + offset;
}

const smokePort = derivePort(VITE_PORT_RANGE_START, VITE_PORT_RANGE_SIZE);
const bunPort = derivePort(BUN_PORT_RANGE_START, BUN_PORT_RANGE_SIZE);

export default defineConfig({
  testDir: "./tests/smoke",
  outputDir: "./test-results/smoke",
  // fixture アダプタは Bun サーバー 1 インスタンスにつき可変状態を1つ共有するため、
  // 並列実行すると相互に状態を壊して描画前にコケる。直列実行で固定する。
  fullyParallel: false,
  workers: 1,
  // smokeは見た目のズレでは落ちず赤=実際の不具合なので、リトライで隠さず即座に検知する。
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  webServer: [
    {
      command: "bun src/index.ts",
      cwd: "../server",
      env: {
        ...process.env,
        MIMIMILLI_ADAPTER: "fixture",
        MIMIMILLI_MOCK_SCENARIO: "new-work",
        PORT: String(bunPort),
      },
      // url/portのTCPプローブはWSL2 mirroredのloopbackブラックホールを踏むため使わず、
      // 起動完了ログを待つ（ADR-0020）。
      wait: { stdout: /サーバーを起動しました/ },
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // VITE_DISABLE_QUERY_DEVTOOLS: smokeテスト用サーバーではdevtoolsのトグルボタンを
      // 無効化する（TASK-9）
      command: `pnpm exec cross-env VITE_DISABLE_QUERY_DEVTOOLS=1 MIMIMILLI_BACKEND_URL=http://127.0.0.1:${bunPort} vite --host 127.0.0.1 --port ${smokePort} --strictPort`,
      // url/portのTCPプローブはWSL2 mirroredのloopbackブラックホールを踏むため使わず、
      // 起動完了ログを待つ（ADR-0020）。ANSIカラーが混ざるため色コードに影響されない最小の正規表現にする。
      wait: { stdout: /ready in/ },
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 500 },
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${smokePort}`,
        viewport: { width: 1440, height: 960 },
      },
    },
  ],
});
