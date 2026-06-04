import { defineConfig, devices } from "@playwright/test";

const visualPort = 4175;

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "./test-results/visual",
  fullyParallel: true,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
  webServer: {
    command: `MIMIKAGO_MOCK_SCENARIO=new-work pnpm exec vite --host 127.0.0.1 --port ${visualPort} --strictPort`,
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
