import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

test.use({ fixtureScenario: "needs-attention" });

async function openNeedsAttention(page: import("@playwright/test").Page) {
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();
  await expect(dialog.getByRole("tab", { name: /^要対応（4件）/ })).toBeVisible({
    timeout: 15_000,
  });
  await dialog.getByRole("tab", { name: /^要対応/ }).click();
  const panel = dialog.getByRole("tabpanel", { name: "要対応" });
  return { dialog, panel };
}

test("要対応の5種類が直すもの→行方不明の順に並び、件数は直すものだけを数える", async ({ page }) => {
  const tracker = trackErrors(page);
  const { panel } = await openNeedsAttention(page);

  const kinds = panel.locator("tbody tr td:first-child");
  await expect(kinds).toHaveText([
    "ID重複",
    "読み取り失敗",
    "アクセス不可",
    "データ不整合",
    "行方不明",
    "行方不明",
  ]);
  await expect(panel.getByText("mimimilli.json 4行目: カンマが足りない")).toBeVisible();
  await expect(panel.getByText(/RJコード|DLsite/)).toHaveCount(0);

  assertNoErrors(tracker);
});

test("読み直すと行が消え、登録を解除は確認のあとで行が消える", async ({ page }) => {
  const tracker = trackErrors(page);
  const { panel } = await openNeedsAttention(page);

  await panel.getByRole("button", { name: "この作品を読み直す" }).click();
  await expect(panel.getByText("データ不整合", { exact: true })).toBeHidden();

  await expect(panel.getByText("行方不明", { exact: true })).toHaveCount(2);
  await panel.getByRole("button", { name: "登録を解除" }).first().click();
  await page
    .getByRole("alertdialog", { name: "登録を解除" })
    .getByRole("button", { name: "解除する" })
    .click();
  await expect(panel.getByText("行方不明", { exact: true })).toHaveCount(1);

  assertNoErrors(tracker);
});

test("行方不明のタイトルで作品詳細が開き、スキャンのダイアログが閉じる", async ({ page }) => {
  const tracker = trackErrors(page);
  const { dialog, panel } = await openNeedsAttention(page);

  await panel
    .getByRole("button", { name: "ツンデレ後輩との放課後トレーニング【ボイスドラマ】" })
    .click();
  await expect(dialog).toBeHidden();

  assertNoErrors(tracker);
});

test("パスを押すとFilesで開く", async ({ page }) => {
  const tracker = trackErrors(page);
  const { panel } = await openNeedsAttention(page);

  await panel.getByRole("button", { name: "壊れた/mimimilli.json" }).click();
  await expect(page.getByRole("button", { name: "ファイル", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  assertNoErrors(tracker);
});
