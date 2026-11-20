import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

test.use({ fixtureScenario: "scan-review", dlsiteFetchDelayMs: 1500 });

async function openUnregistered(page: import("@playwright/test").Page) {
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();
  await dialog.getByRole("tab", { name: /^未登録（/ }).click();
  const panel = dialog.getByRole("tabpanel", { name: /^未登録/ });
  await expect(panel.getByRole("button", { name: "DLsiteから取得" })).toBeVisible({
    timeout: 15_000,
  });
  return { dialog, panel };
}

test("取得の枠が進捗に替わっても一覧の位置が動かず、閉じて開き直しても進捗が残る", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  const { dialog, panel } = await openUnregistered(page);

  const header = panel.getByText("タイトル", { exact: true });
  const before = await header.boundingBox();
  await panel.getByRole("button", { name: "DLsiteから取得" }).click();
  await expect(panel.getByRole("progressbar", { name: "DLsite取得の進捗" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "中止" })).toBeVisible();
  const during = await header.boundingBox();
  expect(during?.y).toBe(before?.y);

  await dialog.getByRole("banner").getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: /^スキャン/ }).click();
  const reopened = page
    .getByRole("dialog", { name: "スキャン" })
    .getByRole("tabpanel", { name: "未登録" });
  await expect(reopened.getByRole("progressbar", { name: "DLsite取得の進捗" })).toBeVisible();

  await expect(reopened.getByRole("button", { name: "DLsiteから取得" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(reopened.getByText("取得済み").first()).toBeVisible();
  await expect(reopened.getByText("該当なし")).toBeVisible();
  await expect(reopened.getByText("失敗", { exact: true })).toBeVisible();
  assertNoErrors(tracker);
});

test("失敗の行の再試行は枠を変えず、取得後に追加すると新規作品タブへ移る", async ({ page }) => {
  const tracker = trackErrors(page);
  const { dialog, panel } = await openUnregistered(page);
  await panel.getByRole("button", { name: "DLsiteから取得" }).click();
  await expect(panel.getByRole("button", { name: "DLsiteから取得" })).toBeVisible({
    timeout: 30_000,
  });

  const failedRow = panel.getByRole("row", { name: /取得に失敗する作品/ });
  await failedRow.getByRole("button", { name: "再試行" }).click();
  await expect(failedRow.getByText("取得中")).toBeVisible();
  await expect(panel.getByRole("button", { name: "DLsiteから取得" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "中止" })).toBeHidden();

  await expect(panel.getByText(/うち\d+件はDLsite情報なし/)).toBeVisible({ timeout: 15_000 });
  await panel.getByRole("button", { name: /^\d+件を追加$/ }).click();
  await expect(dialog.getByRole("tab", { name: /^新規作品/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  assertNoErrors(tracker);
});

test("取得を中止すると枠が戻り、待機中だった行は空欄に戻る", async ({ page }) => {
  const tracker = trackErrors(page);
  const { panel } = await openUnregistered(page);
  await panel.getByRole("button", { name: "DLsiteから取得" }).click();
  await panel.getByRole("button", { name: "中止" }).click();
  await expect(panel.getByRole("button", { name: "DLsiteから取得" })).toBeVisible({
    timeout: 15_000,
  });
  assertNoErrors(tracker);
});
