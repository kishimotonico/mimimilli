import { expect, test, type Page } from "@playwright/test";

const FIXED_NOW = "2026-05-29T00:00:00+09:00";

async function openApp(page: Page) {
  await page.addInitScript((fixedNow) => {
    const fixedTime = new Date(fixedNow as string).getTime();
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args: ConstructorParameters<DateConstructor>) {
        if (args.length === 0) {
          super(fixedTime);
        } else {
          super(...args);
        }
      }
      static now() {
        return fixedTime;
      }
    }
    window.Date = FixedDate as DateConstructor;
  }, FIXED_NOW);

  await page.goto("/", { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      button[aria-label="Open Tanstack query devtools"] {
        display: none !important;
      }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
}

test("library shell", async ({ page }) => {
  await openApp(page);

  await expect(page.getByText("ライブラリ", { exact: true }).first()).toBeVisible();
  await expect(page).toHaveScreenshot("library-shell.png", { fullPage: true });
});

test("scan result dialog", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop scenario only");

  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン完了" });
  await expect(page.getByRole("heading", { name: "スキャン完了" })).toBeVisible();
  await expect(page.getByText("新規検出された作品")).toBeVisible();

  // fullPage 撮影だと半透明オーバーレイ越しの背景差分が閾値未満に圧縮され、
  // ダイアログ内容の変化を maxDiffPixelRatio が薄めて検出できない（偽パス）。
  // ダイアログ要素のみを撮影して差分の分母を内容に限定する。
  await expect(dialog).toHaveScreenshot("scan-result-dialog.png");
});
