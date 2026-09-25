import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

async function openRootFolderEditForm(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "設定", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "変更", exact: true }).click();
  return settings;
}

test("設定からroot変更すると再設定画面(running)を経て通常画面に戻る", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const settings = await openRootFolderEditForm(page);
  await settings.getByLabel("ルートフォルダーのパス").fill("/library/other-audio");
  await settings.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByText("ライブラリを再構築しています")).toBeVisible();
  await expect(page.getByText("/library/other-audio")).toBeVisible();

  await expect(page.getByText("ライブラリを再構築しています")).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "設定", exact: true })).toBeVisible();

  assertNoErrors(tracker);
});

test("失敗（予約パス）→エラー表示→有効なパスで再試行すると通常画面に戻る", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const settings = await openRootFolderEditForm(page);
  await settings.getByLabel("ルートフォルダーのパス").fill("/fixture/unreadable-library");
  await settings.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByText("ライブラリの再構築に失敗しました")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel("ルートフォルダーのパス").fill("/library");
  await page.getByRole("button", { name: "再試行", exact: true }).click();

  await expect(page.getByText("ライブラリを再構築しています")).toBeVisible();
  await expect(page.getByText("ライブラリを再構築しています")).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "設定", exact: true })).toBeVisible();

  assertNoErrors(tracker);
});
