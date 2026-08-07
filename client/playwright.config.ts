import { defineConfig, devices } from "@playwright/test";

const smokePort = 4175;

export default defineConfig({
  testDir: "./tests/smoke",
  outputDir: "./test-results/smoke",
  // fixture アダプタは vite 1 インスタンスにつき可変状態を1つ共有するため、
  // 並列実行すると相互に状態を壊して描画前にコケる。直列実行で固定する。
  fullyParallel: false,
  workers: 1,
  // smokeは見た目のズレでは落ちず赤=実際の不具合なので、リトライで隠さず即座に検知する。
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  webServer: {
    // VITE_DISABLE_QUERY_DEVTOOLS: smokeテスト用サーバーではdevtoolsのトグルボタンを
    // 無効化する（TASK-9）
    command: `pnpm exec cross-env MIMIMILLI_MOCK_SCENARIO=new-work VITE_DISABLE_QUERY_DEVTOOLS=1 vite --host 127.0.0.1 --port ${smokePort} --strictPort`,
    port: smokePort,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 500 },
    stdout: "pipe",
    stderr: "pipe",
  },
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
