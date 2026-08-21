import { expect, test } from "@playwright/test";
import { assertNoErrors, openApp, trackErrors } from "./support";

test("ポップアップの展開ボタンから再生中タブへ遷移し、旧全画面dialog・ポップアップが残らず表示モードが維持される", async ({
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
  await expect(page.locator(".mle-col.is-axis")).toBeVisible({ timeout: 20_000 });

  await page.getByText("ツンデレ後輩ちゃんの秘密のお世話ボイス", { exact: false }).click();
  await page.locator(".mle-prv").getByRole("button", { name: "最初から再生" }).click();

  // バー→ポップアップへ切り替え、展開ボタンで再生中タブへ遷移する。
  await page.locator(".mle-bar1").getByRole("button", { name: "バーを展開" }).click();
  await expect(page.locator(".mle-popup")).toBeVisible();
  await page.getByRole("button", { name: "再生中タブを表示" }).click();

  // 旧 <dialog> 全画面プレイヤーは存在せず、ポップアップ／下部バーも画面に残らない。
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".mle-popup")).toHaveCount(0);
  await expect(page.locator(".mle-bar1")).toHaveCount(0);

  // 保存済みの表示モード（没入）のまま再生中タブが開く。
  await expect(page.locator(".mle-nowplaying__immersive-cover")).toBeVisible();

  assertNoErrors(tracker);
});
