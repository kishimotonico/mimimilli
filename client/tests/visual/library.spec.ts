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

  const work = (await (await page.request.get("/api/works/RJ501001")).json()) as {
    defaultPlaylistId: string;
    playlists: Array<{ id: string; tracks: Array<{ id: string }> }>;
  };
  const playlist = work.playlists.find((candidate) => candidate.id === work.defaultPlaylistId)!;
  const resumeResponse = await page.request.post("/api/works/RJ501001/resume", {
    data: { playlistId: playlist.id, trackId: playlist.tracks[2]!.id, offsetSec: 201 },
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

test("tag filter chips and cross-axis AND filtering", async ({ page }) => {
  await openApp(page);

  // タグ軸 → 「癒し系」を選択（ADR-0012: 選択は全軸共通のタグフィルタへ）。
  // 軸は値をブラウズするビューのままで、チップ列に選択中フィルタが積み上がる。
  await page.locator(".mll-axis", { hasText: "タグ" }).click();
  await page.locator(".mll-vrow", { hasText: "癒し系" }).click();

  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["癒し系"]);
  await expect(page.locator(".mll-vrow", { hasText: "癒し系" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const results = page.locator(".mll-results");

  // 軸を切り替えても選択中のフィルタは維持され（AC#6）、作品一覧を表示する軸では
  // そのままAND絞り込みされた作品一覧がチップ列の下に出る（AC#3・#4）。
  await page.locator(".mll-axis", { hasText: "すべての作品" }).click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["癒し系"]);
  await expect(results.locator(".mle-col.is-results")).toBeVisible();

  // パネル要素のみを撮影し、チップ列＋作品一覧の導線を回帰対象にする。
  await expect(results).toHaveScreenshot("tag-filter-result-list.png");
});

test("scan result dialog", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop scenario only");

  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();

  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await expect(dialog.getByRole("heading", { name: "スキャン", level: 2 })).toBeVisible();

  await dialog.getByRole("button", { name: "スキャン開始" }).click();
  await expect(dialog.getByText("新規検出した作品")).toBeVisible({ timeout: 15_000 });
  // new-work シナリオの RJ501011。スキャン直後の DLsite 一括取得でタイトルが fixture 名に置き換わる。
  await expect(dialog.getByRole("button", { name: /RJ501011/ })).toBeVisible();
  await expect(dialog.getByText("完了しました")).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("button", { name: "スキャン開始" })).toBeVisible({
    timeout: 15_000,
  });

  // fullPage 撮影だと半透明オーバーレイ越しの背景差分が閾値未満に圧縮され、
  // ダイアログ内容の変化を maxDiffPixelRatio が薄めて検出できない（偽パス）。
  // ダイアログ要素のみを撮影して差分の分母を内容に限定する。
  await expect(dialog).toHaveScreenshot("scan-result-dialog.png");
});
