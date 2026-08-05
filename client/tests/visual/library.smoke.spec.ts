// スクリーンショットを撮らない役割ベースの動作確認。ここが赤いときは常に実際の不具合を
// 意味する（見た目のズレでは落ちない）。各テストはコンソールエラーと 4xx/5xx の
// レスポンスが出ていないことも併せて確認する。
import { expect, test } from "@playwright/test";
import { openApp, trackErrors } from "./support";

test("ライブラリシェル: 軸レール・結果面・チップ列が表示される", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await expect(page.locator(".mle-col.is-axis").getByText("CV", { exact: true })).toBeVisible();
  await expect(page.locator(".mll-tagband")).toBeVisible();
  await expect(page.locator(".mll-results, .mle-col.is-results").first()).toBeVisible();

  expect(tracker.consoleErrors).toEqual([]);
  expect(tracker.failedResponses).toEqual([]);
});

test("軸を選ぶと値一覧が出て、値を選ぶと作品一覧へ遷移しフィルタチップが付く", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.locator(".mll-axis", { hasText: "CV" }).click();
  const valueList = page.locator(".mle-col.is-axis-values");
  await expect(valueList.locator(".mll-vrow, .mll-vtile").first()).toBeVisible();

  await page.locator(".mll-vrow", { hasText: "霧島レイ" }).click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["cv/霧島レイ"]);
  await expect(page.locator(".mll-axis", { hasText: "すべての作品" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.locator(".mle-col.is-results")).toBeVisible();

  expect(tracker.consoleErrors).toEqual([]);
  expect(tracker.failedResponses).toEqual([]);
});

test("作品を選ぶとプレビューが開く", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("お気に入りだった朗読劇", { exact: false }).click();
  await expect(page.locator(".mle-prv")).toBeVisible();

  expect(tracker.consoleErrors).toEqual([]);
  expect(tracker.failedResponses).toEqual([]);
});

test("詳細パネル: 再開ボタンが正しいアクセシブル名で表示される", async ({ page }) => {
  const tracker = trackErrors(page);
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
  // 主ボタンのアクセシブル名は状態を表す短い文言（「続きから再生」）で、
  // 時刻はツールチップ（title）に載る。ボタン名に時刻は含めない設計。
  const resumeButton = panel.getByRole("button", { name: "続きから再生" });
  await expect(resumeButton).toBeVisible();
  await expect(resumeButton).toHaveAttribute("title", "古い本の読み聞かせ · 3:21 から再開");
  await expect(panel.getByText("再開 3:21", { exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "再生メニュー" }).click();
  await expect(panel.getByRole("menuitem", { name: "最初から再生" })).toBeVisible();

  expect(tracker.consoleErrors).toEqual([]);
  expect(tracker.failedResponses).toEqual([]);
});

test("詳細パネル: 編集モードでのみタグ削除ボタンが現れる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  const removeButtons = panel.getByRole("button", { name: /^タグ「.+」を削除$/ });
  await expect(removeButtons.first()).toBeHidden();

  // 誤操作防止のため既定は非表示。「タグを編集」で編集モードに入って初めて現れる。
  await panel.getByRole("button", { name: "タグを編集" }).click();
  await expect(removeButtons.first()).toBeVisible();

  await panel.getByRole("button", { name: "タグを追加" }).click();
  await expect(panel.getByRole("combobox", { name: "追加するタグ" })).toBeVisible();

  expect(tracker.consoleErrors).toEqual([]);
  expect(tracker.failedResponses).toEqual([]);
});

test("スキャンダイアログが開いて完了し、閉じられる", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop scenario only");

  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();

  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await expect(dialog.getByRole("heading", { name: "スキャン", level: 2 })).toBeVisible();

  await dialog.getByRole("button", { name: "スキャン開始" }).click();
  await expect(dialog.getByText("新規検出した作品")).toBeVisible({ timeout: 15_000 });
  // new-work シナリオの RJ501011。スキャン直後の DLsite 一括取得でタイトルが fixture 名に置き換わる。
  await expect(dialog.getByRole("button", { name: /RJ501011/ })).toBeVisible();
  await expect(dialog.getByText("完了しました")).toBeVisible({ timeout: 15_000 });

  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toBeHidden();

  expect(tracker.consoleErrors).toEqual([]);
  expect(tracker.failedResponses).toEqual([]);
});
