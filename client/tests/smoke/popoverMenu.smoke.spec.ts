import { expect, test } from "./fixtures";

test("Escでメニュー、ポップオーバー、native dialogが一段ずつ閉じる", async ({ page }) => {
  await page.goto("/tests/smoke/harness/popover-menu.html");
  const dialog = page.locator("dialog[open]");
  const trigger = page.getByRole("button", { name: "ダイアログを開く" });
  await trigger.click();
  await dialog.getByRole("button", { name: "ポップオーバーを開く" }).click();
  const popover = dialog.getByRole("dialog", { name: "ポップオーバー" });
  await popover.getByRole("button", { name: "メニューを開く" }).click();
  const menu = popover.getByRole("menu");
  await expect(menu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(popover).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
