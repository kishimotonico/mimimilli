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

  // カバーは拡大（scale）してから親の overflow: hidden でクロップする設計（TASK-365）。
  // img 自体はビューポートよりはみ出す想定なので、クロップの器
  // （.mle-nowplaying__immersive-cover）がビューポート内に収まり、ページに
  // スクロールを生まないことを回帰ガードとして確認する。
  const viewport = page.viewportSize()!;
  const coverBox = await cover.boundingBox();
  expect(coverBox).not.toBeNull();
  expect(coverBox!.y).toBeGreaterThanOrEqual(0);
  expect(coverBox!.x).toBeGreaterThanOrEqual(0);
  expect(coverBox!.y + coverBox!.height).toBeLessThanOrEqual(viewport.height);
  expect(coverBox!.x + coverBox!.width).toBeLessThanOrEqual(viewport.width);

  const hasPageOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth ||
      document.documentElement.scrollHeight > document.documentElement.clientHeight,
  );
  expect(hasPageOverflow).toBe(false);

  // シーク行は同一DOMノードのまま、位置・寸法が変わらない（AC7）。
  const rectDuringImmersive = await seekRow.boundingBox();
  expect(rectDuringImmersive).toEqual(rectBefore);

  await page.getByRole("button", { name: "通常表示に戻す" }).click();
  await expect(page.locator(".mle-nowplaying__body")).toBeVisible();
  const rectAfter = await seekRow.boundingBox();
  expect(rectAfter).toEqual(rectBefore);

  assertNoErrors(tracker);
});
