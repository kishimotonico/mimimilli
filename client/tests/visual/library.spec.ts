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

test("work detail panel - missing file", async ({ page }) => {
  await openApp(page);

  await page.getByText("お気に入りだった朗読劇", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  await expect(panel.getByText("ファイル欠損", { exact: true })).toBeVisible();
  await expect(panel.getByText("ファイルが見つかりません")).toBeVisible();

  // パネル要素のみを撮影し、リスト側のレイアウト差分を含めない。
  await expect(panel).toHaveScreenshot("work-detail-missing.png");
});

test("work detail panel - resume playback", async ({ page }) => {
  await openApp(page);

  const resumeResponse = await page.request.post("/api/works/RJ501001/resume", {
    data: { position: 201, trackIndex: 2 },
  });
  expect(resumeResponse.ok()).toBe(true);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  // 再開情報はプライマリボタンに内包され、トラック名は title ツールチップに移った。
  const resumeButton = panel.getByRole("button", { name: "続きから 3:21" });
  await expect(resumeButton).toBeVisible();
  await expect(resumeButton).toHaveAttribute("title", "古い本の読み聞かせ · 3:21 から再開");
  await expect(panel.getByRole("button", { name: "最初から再生" })).toBeVisible();
  await expect(panel.getByText("再開 3:21", { exact: true })).toBeVisible();

  await expect(panel).toHaveScreenshot("work-detail-resume.png");
});

test("work detail panel - tag editing", async ({ page }) => {
  await openApp(page);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  // 編集モードは廃止され、常設の「+」からポップオーバーで直編集する。
  await panel.getByRole("button", { name: "タグを追加" }).click();

  await expect(panel.getByRole("combobox", { name: "追加するタグ" })).toBeVisible();
  // フラットタグの×（削除）が常設されている。
  await expect(panel.getByRole("button", { name: /^タグ「.+」を削除$/ }).first()).toBeVisible();

  await expect(panel).toHaveScreenshot("work-detail-tag-editing.png");
});

test("tag filter result grid", async ({ page }) => {
  await openApp(page);

  // タグ軸 → 「癒し系」を選択（AND絞り込み）。プレビューに結果グリッドが出る。
  await page.locator(".mll-axis", { hasText: "タグ" }).click();
  await page.locator(".mll-tagrow", { hasText: "癒し系" }).click();

  const panel = page.locator(".mle-prv");
  await expect(panel.locator(".mll-related__card").first()).toBeVisible();
  await expect(panel.locator(".mle-prv__hd .label")).toHaveText("絞り込み結果");
  await expect(panel.getByText("タグの結果", { exact: true })).toBeVisible();
  await expect(panel.getByText("左の列から絞り込みを選択してください")).toHaveCount(0);

  // パネル要素のみを撮影し、結果グリッドの導線（カード）を回帰対象にする。
  await expect(panel).toHaveScreenshot("tag-filter-result-grid.png");
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
