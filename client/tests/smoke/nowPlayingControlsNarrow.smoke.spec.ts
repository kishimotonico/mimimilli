import { expect, test } from "@playwright/test";
import { assertNoErrors, expectNoHorizontalOverflow, openApp, trackErrors } from "./support";

// 1024px（サポート下限）ではAB行がトランスポート下段へ退避する2段構成になる（TASK-366）。
// 1440x960のみのカバレッジだと退行に気づけないため、専用にこの幅で検証する。
test.use({ viewport: { width: 1024, height: 960 } });

test("再生中タブ: 1024px幅ではコントロールがトランスポート/AB行の2段構成になり崩れない", async ({
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

  const transport = page.locator(".mle-nowplaying__controls-transport");
  const abRow = page.locator(".mle-nowplaying__controls-ab");
  await expect(transport).toBeVisible();
  await expect(abRow).toBeVisible();

  await page.getByRole("button", { name: "A地点を設定" }).click();
  await expect(page.getByRole("button", { name: "A-Bリピートを解除" })).toBeVisible();

  const transportBox = await transport.boundingBox();
  const abBox = await abRow.boundingBox();
  expect(transportBox).not.toBeNull();
  expect(abBox).not.toBeNull();

  // 2段構成: AB行がトランスポートの下段にあり、縦方向で重ならない。
  expect(abBox!.y).toBeGreaterThanOrEqual(transportBox!.y + transportBox!.height - 1);

  // AB行の文言・時刻・解除ボタンが折り返さず1行に収まっている
  // （nowrapが効いていれば1行の高さで収まるはず。26pxのA/Bボタンより極端に高い場合は折り返し疑い）。
  expect(abBox!.height).toBeLessThan(40);

  await expectNoHorizontalOverflow(page);
  assertNoErrors(tracker);
});
