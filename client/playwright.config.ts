import { defineConfig, devices } from "@playwright/test";

const visualPort = 4175;

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "./test-results/visual",
  // fixture アダプタは vite 1 インスタンスにつき可変状態を1つ共有するため、
  // 並列実行すると相互に状態を壊して描画前にコケる。直列実行で固定する。
  fullyParallel: false,
  workers: 1,
  // vite のコールドスタート（初回ナビゲーションが React マウント前に networkidle 到達）や
  // フォント描画ゆらぎによる初回フレークをリトライで吸収する。
  retries: 2,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      // フォントのサブピクセル描画ゆらぎ（直列実行でも数百px・~0.02 程度）を吸収する。
      maxDiffPixelRatio: 0.03,
    },
  },
  webServer: {
    command: `pnpm exec cross-env MIMIMILLI_MOCK_SCENARIO=new-work vite --host 127.0.0.1 --port ${visualPort} --strictPort`,
    port: visualPort,
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
        baseURL: `http://127.0.0.1:${visualPort}`,
        viewport: { width: 1440, height: 960 },
      },
    },
  ],
});
