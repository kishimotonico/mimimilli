import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

test("ポップアップの ⤢ から再生中の層が重なり、URL は下の画面のまま、下の画面が残り、表示モードが維持される", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  // 保存済みの表示モード（没入）を再現する。openApp の addInitScript は毎回 localStorage を
  // クリアするため、その後段に積む addInitScript で reload 後に上書きする。
  await page.addInitScript(() => {
    localStorage.setItem("mimimilli:nowPlayingViewMode", JSON.stringify("immersive"));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".mll-sidebar")).toBeVisible({ timeout: 20_000 });

  await page.getByText("ツンデレ後輩ちゃんの秘密のお世話ボイス", { exact: false }).click();
  await page.locator(".mle-prv").getByRole("button", { name: "最初から再生" }).click();

  // バー→ポップアップへ切り替え、⤢ で再生中の層を開く。
  await page.locator(".mle-bar1").getByRole("button", { name: "バーを展開" }).click();
  await expect(page.locator(".mle-popup")).toBeVisible();
  const urlBefore = page.url();
  await page.locator(".mle-popup").getByRole("button", { name: "再生中を開く" }).click();
  await expect(page.locator(".mle-layer")).toBeVisible();
  expect(page.url()).toBe(urlBefore);

  // 下の画面（ライブラリ）は層の下に残り、サイドバーは層に隠れる（状態は変わらない）。
  await expect(page.locator(".mll-results")).toBeAttached();
  await expect(page.locator(".mll-sidebar")).toBeAttached();

  // 層は dialog ではなく、ポップアップ／下部バーも画面に残らない。
  await expect(page.locator(".mle-nowplaying dialog")).toHaveCount(0);
  await expect(page.locator(".mle-popup")).toHaveCount(0);
  await expect(page.locator(".mle-bar1")).toHaveCount(0);

  // 保存済みの表示モード（没入）のまま層が開く。
  await expect(page.locator(".mle-nowplaying__immersive-cover")).toBeVisible();

  assertNoErrors(tracker);
});
