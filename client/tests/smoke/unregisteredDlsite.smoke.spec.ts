import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

test.use({ fixtureScenario: "scan-review", dlsiteFetchDelayMs: 1500 });

const FETCH_BUTTON = /^DLsiteから取得 \d+件$/;
const ADD_BUTTON = /^\d+件を追加$/;

async function openUnregistered(page: import("@playwright/test").Page) {
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();
  await dialog.getByRole("tab", { name: /^未登録（/ }).click();
  const panel = dialog.getByRole("tabpanel", { name: /^未登録/ });
  await expect(panel.getByRole("button", { name: FETCH_BUTTON })).toBeVisible({
    timeout: 15_000,
  });
  return { dialog, panel };
}

test("未取得があるあいだ主ボタンは取得で、進捗の出入りとラベルの変化で主ボタンの位置が動かない", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  const { dialog, panel } = await openUnregistered(page);

  await expect(panel.getByRole("button", { name: ADD_BUTTON })).toBeHidden();
  const header = panel.getByText("タイトル", { exact: true });
  const primary = panel.getByRole("button", { name: /^(DLsiteから取得 \d+件|\d+件を追加)$/ });
  const progress = panel.getByRole("progressbar", { name: "DLsite取得の進捗" });
  const headerBefore = await header.boundingBox();
  const primaryBefore = await primary.boundingBox();

  await panel.getByRole("button", { name: FETCH_BUTTON }).click();
  await expect(progress).toBeVisible();
  await expect(panel.getByRole("button", { name: "中止" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "その他の操作" })).toBeHidden();
  expect((await header.boundingBox())?.y).toBe(headerBefore?.y);

  await panel.getByRole("checkbox", { name: "「朗読劇」を選択" }).check();
  await expect(primary).toHaveText("DLsiteから取得 1件");
  await expect(progress).toBeVisible();
  expect((await primary.boundingBox())?.x).toBe(primaryBefore?.x);

  await dialog.getByRole("banner").getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: /^スキャン/ }).click();
  const reopened = page
    .getByRole("dialog", { name: "スキャン" })
    .getByRole("tabpanel", { name: "未登録" });
  await expect(reopened.getByRole("progressbar", { name: "DLsite取得の進捗" })).toBeVisible();
  await reopened.getByRole("button", { name: "DLsiteから取得 1件" }).click();

  await expect(reopened.getByRole("button", { name: ADD_BUTTON })).toBeVisible({
    timeout: 30_000,
  });
  expect((await primary.boundingBox())?.x).toBe(primaryBefore?.x);
  await expect(reopened.getByText("取得済み").first()).toBeVisible();
  await expect(reopened.getByText("該当なし")).toBeVisible();
  await expect(reopened.getByText("失敗", { exact: true })).toBeVisible();
  assertNoErrors(tracker);
});

test("▾の「選択を除外」で選択中の行が消え、「項目を選んで追加」で残りを追加できる", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  const { dialog, panel } = await openUnregistered(page);
  await panel.getByRole("checkbox", { name: "「囁きの図書館」を選択" }).uncheck();
  await panel.getByRole("button", { name: "その他の操作" }).click();
  await page.getByRole("menuitem", { name: "選択を除外" }).click();
  await expect(page.getByText(/件を候補から外しました/)).toBeVisible();
  await expect(panel.getByRole("row", { name: /囁きの図書館/ })).toBeVisible();
  await expect(panel.getByRole("row", { name: /カバーなし作品/ })).toBeHidden();

  await panel.getByRole("checkbox", { name: "「囁きの図書館」を選択" }).check();
  await panel.getByRole("button", { name: "その他の操作" }).click();
  await page.getByRole("menuitem", { name: "項目を選んで追加…" }).click();
  const picker = page.getByRole("dialog", { name: "追加する項目" });
  await picker.getByLabel("カバー").uncheck();
  await picker.getByRole("button").first().click();
  await expect(dialog.getByRole("tab", { name: "新規作品（1件）" })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: /^未登録/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel.getByRole("row", { name: /朗読劇/ })).toBeVisible();
  assertNoErrors(tracker);
});

test("取得結果が該当なし・失敗の行は選択から外れ、追加すると残りは未登録にとどまる", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  const { dialog, panel } = await openUnregistered(page);
  await expect(panel.getByRole("checkbox", { name: "「見つからない作品」を選択" })).toBeChecked();
  await panel.getByRole("button", { name: FETCH_BUTTON }).click();
  await expect(panel.getByRole("button", { name: ADD_BUTTON })).toBeVisible({ timeout: 30_000 });

  await expect(
    panel.getByRole("checkbox", { name: "「見つからない作品」を選択" }),
  ).not.toBeChecked();
  await expect(
    panel.getByRole("checkbox", { name: "「取得に失敗する作品」を選択" }),
  ).not.toBeChecked();
  await expect(panel.getByRole("checkbox", { name: "「囁きの図書館」を選択" })).toBeChecked();

  await panel.getByRole("button", { name: ADD_BUTTON }).click();
  await expect(page.getByText(/を追加しました/)).toBeVisible();
  await expect(dialog.getByRole("tab", { name: /^未登録/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel.getByRole("row", { name: /取得に失敗する作品/ })).toBeVisible();

  await expect(panel.getByRole("checkbox", { name: "「朗読劇」を選択" })).not.toBeChecked();
  await panel.getByLabel("すべて選択").check();
  await expect(panel.getByRole("button", { name: FETCH_BUTTON })).toBeVisible();
  await panel.getByRole("button", { name: "その他の操作" }).click();
  await page.getByRole("menuitem", { name: "取得せずに追加" }).click();
  await expect(dialog.getByRole("tab", { name: /^新規作品/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  assertNoErrors(tracker);
});

test("取得中に未取得の行を選んで取得すると、実行中のジョブへ合流して分母が増える", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  const { panel } = await openUnregistered(page);
  await panel.getByRole("checkbox", { name: "「夜更けの朗読」を選択" }).uncheck();
  await panel.getByRole("checkbox", { name: "「朗読劇」を選択" }).uncheck();
  await panel.getByRole("button", { name: FETCH_BUTTON }).click();
  const progress = panel.getByRole("progressbar", { name: "DLsite取得の進捗" });
  await expect(progress).toHaveAttribute("aria-valuemax", "4");

  await panel.getByRole("checkbox", { name: "「夜更けの朗読」を選択" }).check();
  await panel.getByRole("button", { name: "DLsiteから取得 1件" }).click();
  await expect(progress).toHaveAttribute("aria-valuemax", "5");
  assertNoErrors(tracker);
});

test("取得を中止すると進捗が消え、待機中だった行は未取得に戻って主ボタンが取得に戻る", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  const { panel } = await openUnregistered(page);
  await panel.getByRole("button", { name: FETCH_BUTTON }).click();
  await panel.getByRole("button", { name: "中止" }).click();
  await expect(panel.getByRole("button", { name: FETCH_BUTTON })).toBeVisible({
    timeout: 15_000,
  });
  await expect(panel.getByRole("progressbar")).toBeHidden();
  assertNoErrors(tracker);
});
