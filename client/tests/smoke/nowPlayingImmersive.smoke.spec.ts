import { expect, test } from "@playwright/test";
import { assertNoErrors, openApp, trackErrors } from "./support";

test("再生中タブ: 没入モードでカバーがビューポート内に収まり、シーク行の位置がモード切替前後で不変", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("ツンデレ後輩ちゃんの秘密のお世話ボイス", { exact: false }).click();
  await page.locator(".mle-prv").getByRole("button", { name: "最初から再生" }).click();
  await page
    .getByRole("navigation", { name: "メインナビゲーション" })
    .getByRole("button", { name: "再生中" })
    .click();

  const seekRow = page.locator(".mle-nowplaying__seek");
  await expect(seekRow).toBeVisible();
  const rectBefore = await seekRow.boundingBox();
  expect(rectBefore).not.toBeNull();

  await page.getByRole("button", { name: "没入モードにする" }).click();
  const cover = page.locator(".mle-nowplaying__immersive-cover");
  await expect(cover).toBeVisible();

  // カバー本体（img）がビューポート内に収まっていること（AC1 のはみ出し回帰ガード）。
  const viewport = page.viewportSize()!;
  const img = cover.locator("img");
  const imgBox = await img.boundingBox();
  expect(imgBox).not.toBeNull();
  expect(imgBox!.y).toBeGreaterThanOrEqual(0);
  expect(imgBox!.x).toBeGreaterThanOrEqual(0);
  expect(imgBox!.y + imgBox!.height).toBeLessThanOrEqual(viewport.height);
  expect(imgBox!.x + imgBox!.width).toBeLessThanOrEqual(viewport.width);

  // シーク行は同一DOMノードのまま、位置・寸法が変わらない（AC7）。
  const rectDuringImmersive = await seekRow.boundingBox();
  expect(rectDuringImmersive).toEqual(rectBefore);

  await page.getByRole("button", { name: "通常表示に戻す" }).click();
  await expect(page.locator(".mle-nowplaying__body")).toBeVisible();
  const rectAfter = await seekRow.boundingBox();
  expect(rectAfter).toEqual(rectBefore);

  assertNoErrors(tracker);
});
