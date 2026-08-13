import { expect, test } from "@playwright/test";
import { assertNoErrors, openApp, trackErrors } from "./support";

test("設定モーダルから未設定項目の一括適用ができる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "設定", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();

  await settings.getByRole("button", { name: "未設定項目をまとめて適用", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "未設定項目をまとめて適用" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "適用", exact: true }).click();

  await expect(
    page.getByText(/未設定項目を適用: 適用 \d+件・スキップ \d+件・失敗 \d+件/),
  ).toBeVisible();
  await expect(dialog).toBeHidden();

  assertNoErrors(tracker);
});
