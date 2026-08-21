import { expect, test } from "@playwright/test";
import { assertNoErrors, openApp, trackErrors } from "./support";

test("再生中タブ: 通常モードのトラックリストが多数トラックでも内部スクロールで最後まで到達できる", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("辺境の魔法使いと旅する日々", { exact: false }).click();
  await page
    .locator(".mle-prv")
    .getByRole("button", { name: /^(最初から再生|続きから再生)$/ })
    .click();
  await page
    .getByRole("navigation", { name: "メインナビゲーション" })
    .getByRole("button", { name: "再生中" })
    .click();

  const body = page.locator(".mle-nowplaying__body");
  await expect(body).toBeVisible();
  const bodyBox = await body.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bodyBox).not.toBeNull();
  // AC1回帰ガード: 通常表示の本文がビューポート内に収まる（中間 motion.div の高さ未指定で
  // ビューポートを超えて伸び、外側 overflow:hidden で後半が切り落とされる不具合の再発防止）。
  expect(bodyBox!.y + bodyBox!.height).toBeLessThanOrEqual(viewport.height + 1);

  const tracks = page.locator(".mle-nowplaying__right button");
  await expect(tracks).toHaveCount(20);
  const lastTrack = tracks.last();
  await lastTrack.scrollIntoViewIfNeeded();
  await expect(lastTrack).toBeInViewport();

  assertNoErrors(tracker);
});

test("再生中タブ: :modal存在下ではEscで最前面のdialogだけが閉じ、没入モードは維持される", async ({
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
  await page.getByRole("button", { name: "没入モードにする" }).click();
  await expect(page.locator(".mle-nowplaying__immersive-cover")).toBeVisible();

  // ブラウザの戻る/進む（没入中は TopBar が inert 化されておりUI操作できないため、
  // ブラウザの履歴API自体を使う。UIのinert化を経由しない履歴遷移で、没入を維持した
  // ままモーダルを開いた状態を作る）。
  await page.evaluate(() => window.history.back());
  await expect(page.locator(".mle-nowplaying")).toHaveCount(0);

  await page.getByRole("button", { name: "設定" }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();

  await page.evaluate(() => window.history.forward());
  await expect(page.locator(".mle-nowplaying__immersive-cover")).toBeVisible();
  await expect(page.locator("dialog[open]")).toBeVisible();

  // 1回目のEscは最前面のdialogだけを閉じ、没入は維持される。
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".mle-nowplaying__immersive-cover")).toBeVisible();

  // dialogが消えた後の2回目のEscで没入が解除される。
  await page.keyboard.press("Escape");
  await expect(page.locator(".mle-nowplaying__body")).toBeVisible();

  assertNoErrors(tracker);
});
