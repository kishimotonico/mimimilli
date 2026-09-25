import { defineConfig, devices } from "@playwright/test";
import { SMOKE_WORKERS } from "./tests/smoke/workerCount.ts";

// fixture アダプタの可変状態はworkerごとに起動するBun+Viteサーバーペア（tests/smoke/fixtures.ts）
// に分離され、各テスト開始前にリセットされる。ポート導出はtests/smoke/derivePort.tsで行う。

export default defineConfig({
  testDir: "./tests/smoke",
  outputDir: "./test-results/smoke",
  fullyParallel: true,
  workers: SMOKE_WORKERS,
  // smokeは見た目のズレでは落ちず赤=実際の不具合なので、リトライで隠さず即座に検知する。
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
        trace: "retain-on-failure",
      },
    },
  ],
});
