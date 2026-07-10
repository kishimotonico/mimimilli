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
      // フォントのサブピクセル描画ゆらぎ（直列実行でも数百px程度）を吸収しつつ、
      // レイアウト回帰は検出できるよう絶対値で指定する。
      // 旧設定の比率 0.03 はフルページ（1440x960）換算で約4.1万pxまで許容してしまい、
      // TASK-22 の text-align 回帰（行テキストの寄せズレ=数千px規模）を素通りさせた。
      // 1200px なら「ゆらぎの実測上限（数百px）<しきい値<最小の回帰規模（数千px）」に収まる。
      maxDiffPixels: 1200,
    },
  },
  webServer: {
    // VITE_DISABLE_QUERY_DEVTOOLS: スクリーンショットに devtools のトグルボタンが
    // 写り込まないよう、ビジュアルテスト用サーバーでは無効化する（TASK-9）
    command: `pnpm exec cross-env MIMIMILLI_MOCK_SCENARIO=new-work VITE_DISABLE_QUERY_DEVTOOLS=1 vite --host 127.0.0.1 --port ${visualPort} --strictPort`,
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
