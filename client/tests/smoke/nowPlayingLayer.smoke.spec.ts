import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, openNowPlayingFromBar, trackErrors } from "./support";

const railRow = (page: Page, name: string | RegExp) =>
  page
    .locator(".mll-sidebar")
    .getByRole("button", typeof name === "string" ? { name, exact: true } : { name });
const layer = (page: Page) => page.locator(".mle-layer");
const path = (page: Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
};

async function playFirstWork(page: Page) {
  await page.getByText("ツンデレ後輩ちゃんの秘密のお世話ボイス", { exact: false }).click();
  await page.locator(".mle-prv").getByRole("button", { name: "最初から再生" }).click();
  await expect(page.locator(".mle-bar1")).toBeVisible();
}

test("お気に入り → CV別 → 層を開く → Esc → 戻る でお気に入りに着く", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await playFirstWork(page);

  await railRow(page, /^お気に入り/).click();
  const favoritePath = path(page);
  await railRow(page, "CV別").click();
  await expect(page).toHaveURL(/\/library\/by-cv$/);

  await openNowPlayingFromBar(page);
  await expect(layer(page)).toBeVisible();
  expect(path(page)).toBe("/library/by-cv");
  await expect(page.locator(".mle-bar1")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(layer(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/library\/by-cv$/);

  await page.goBack();
  await expect.poll(() => path(page)).toBe(favoritePath);
  await expect(railRow(page, /^お気に入り/)).toHaveAttribute("aria-current", "true");

  assertNoErrors(tracker);
});

test("閉じるボタンとブラウザの戻るで層が閉じ、層の下の画面と再生バーが戻る", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await playFirstWork(page);
  const libraryPath = path(page);

  await openNowPlayingFromBar(page);
  await page.getByRole("button", { name: "再生中を閉じる" }).click();
  await expect(layer(page)).toHaveCount(0);
  await expect(page.locator(".mle-bar1")).toBeVisible();
  expect(path(page)).toBe(libraryPath);

  await openNowPlayingFromBar(page);
  await page.goBack();
  await expect(layer(page)).toHaveCount(0);
  expect(path(page)).toBe(libraryPath);

  assertNoErrors(tracker);
});

test("層を開いたまま再読み込みしても、再生していなければ履歴を1件戻って層を外す", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await playFirstWork(page);
  await railRow(page, "CV別").click();
  await expect(page).toHaveURL(/\/library\/by-cv$/);

  await openNowPlayingFromBar(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".mll-sidebar")).toBeVisible({ timeout: 20_000 });
  await expect(layer(page)).toHaveCount(0);
  await expect.poll(() => path(page)).toBe("/library/by-cv");
  await expect(
    page.getByRole("group", { name: "CVの一覧" }).getByRole("button").first(),
  ).toBeVisible();

  assertNoErrors(tracker);
});

test("ファイルの上で開いた層から作品詳細へ進み、戻るとファイルの位置に着く", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await playFirstWork(page);

  await page.getByRole("button", { name: "ファイル", exact: true }).click();
  await expect(page).toHaveURL(/\/files/);
  await expect(page.locator(".mll-sidebar")).toHaveCount(0);
  await page.getByRole("button", { name: /^dlsite/ }).click();
  await expect.poll(() => path(page)).toMatch(/^\/files\/dlsite/);
  const filesPath = path(page);

  await openNowPlayingFromBar(page);
  await expect(layer(page)).toBeVisible();
  expect(path(page)).toBe(filesPath);

  await layer(page).getByRole("button", { name: "この作品の詳細を見る" }).click();
  await expect(page).toHaveURL(/\/work\/[^?]+$/);
  await expect(layer(page)).toHaveCount(0);

  await page.goBack();
  await expect.poll(() => path(page)).toBe(filesPath);
  await expect(layer(page)).toHaveCount(0);

  assertNoErrors(tracker);
});

test("層の下の画面は、層を閉じるとサイドバーの状態もそのまま戻る", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await playFirstWork(page);

  await railRow(page, "CV別").click();
  await openNowPlayingFromBar(page);
  await expect(page.locator(".mll-sidebar")).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(layer(page)).toHaveCount(0);
  await expect(railRow(page, "CV別")).toHaveAttribute("aria-current", "true");

  assertNoErrors(tracker);
});

test("層のタグから「すべて」＋そのタグへ進み、戻ると層を開く前の画面に着く", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await playFirstWork(page);

  await railRow(page, "CV別").click();
  await expect(page).toHaveURL(/\/library\/by-cv$/);
  await openNowPlayingFromBar(page);

  await layer(page)
    .getByRole("button", { name: /^タグ「/ })
    .first()
    .click();
  await expect(layer(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/library\/all\?tags=/);

  await page.goBack();
  await expect.poll(() => path(page)).toBe("/library/by-cv");

  assertNoErrors(tracker);
});
