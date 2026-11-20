import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

test.use({ fixtureScenario: "needs-attention" });

async function openNeedsAttention(page: import("@playwright/test").Page) {
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();
  await expect(dialog.getByRole("tab", { name: /^要対応（6件）/ })).toBeVisible({
    timeout: 15_000,
  });
  await dialog.getByRole("tab", { name: /^要対応/ }).click();
  const panel = dialog.getByRole("tabpanel", { name: "要対応" });
  return { dialog, panel };
}

test("要対応の5種類が直すもの→行方不明の順に並び、件数は一覧の行数", async ({ page }) => {
  const tracker = trackErrors(page);
  const { panel } = await openNeedsAttention(page);

  const kinds = panel.locator("[role=row] > [role=cell]:first-child");
  await expect(kinds).toHaveText([
    "ID重複",
    "読み取り失敗",
    "アクセス不可",
    "データ不整合",
    "行方不明",
    "行方不明",
  ]);
  await expect(panel.getByRole("row", { name: /^読み取り失敗/ })).toContainText(
    "mimimilli.json 4行目: カンマが足りない",
  );
  await expect(panel.getByText(/RJコード|DLsite/)).toHaveCount(0);

  assertNoErrors(tracker);
});

test("読み直すと行が消え、登録解除は確認のあとで行が消える", async ({ page }) => {
  const tracker = trackErrors(page);
  const { panel } = await openNeedsAttention(page);

  await panel.getByRole("button", { name: "読み直す" }).click();
  await expect(panel.getByText("データ不整合", { exact: true })).toBeHidden();
  await expect(page.getByText("「タグの値が壊れた作品」を読み直しました")).toBeVisible();

  await expect(panel.getByText("行方不明", { exact: true })).toHaveCount(2);
  await panel.getByRole("button", { name: "登録解除" }).first().click();
  await page
    .getByRole("alertdialog", { name: "登録解除" })
    .getByRole("button", { name: "解除する" })
    .click();
  await expect(panel.getByText("行方不明", { exact: true })).toHaveCount(1);
  await expect(page.getByText(/を登録解除しました/)).toBeVisible();

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

test("スキャン前に開くと件数のある要対応へ着地し、未登録は「まだスキャンしていません」を出す", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });

  await expect(dialog.getByRole("tab", { name: /^要対応（/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const attention = dialog.getByRole("tabpanel", { name: /^要対応/ });
  await expect(attention.getByRole("row", { name: /^ID重複/ })).toBeVisible();
  await expect(attention.getByText("まだスキャンしていません")).toHaveCount(0);

  await dialog.getByRole("tab", { name: /^未登録/ }).click();
  const unregistered = dialog.getByRole("tabpanel", { name: /^未登録/ });
  await expect(unregistered.getByText("まだスキャンしていません")).toBeVisible();
  await expect(unregistered.getByRole("status").getByRole("button")).toHaveCount(0);

  assertNoErrors(tracker);
});

test("ID重複は登録済みと未登録をラベルとパスの行で出し、取り込むボタンは未登録の行と同じ高さに並び、取り込むと行が消える", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  const { panel } = await openNeedsAttention(page);

  const row = panel.getByRole("row").filter({ hasText: "ID重複" });
  await expect(row.getByText("登録済み", { exact: true })).toBeVisible();
  const unregisteredLabel = row.getByText("未登録", { exact: true });
  await expect(unregisteredLabel).toBeVisible();
  await expect(row.getByText("作品ID RJ501001", { exact: true })).toHaveCount(0);

  const importButton = row.getByRole("button", { name: "別の作品として取り込む" });
  const labelBox = await unregisteredLabel.boundingBox();
  const buttonBox = await importButton.boundingBox();
  const centerY = (box: { y: number; height: number } | null) =>
    box ? box.y + box.height / 2 : Number.NaN;
  expect(Math.abs(centerY(labelBox) - centerY(buttonBox))).toBeLessThan(2);

  await importButton.click();
  await page
    .getByRole("alertdialog", { name: "別の作品として取り込む" })
    .getByRole("button", { name: "取り込む" })
    .click();
  await expect(panel.getByText("ID重複", { exact: true })).toBeHidden();
  await expect(page.getByText(/を別の作品として取り込みました/)).toBeVisible();

  assertNoErrors(tracker);
});
