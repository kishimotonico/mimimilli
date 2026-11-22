// サイドバーの編集（並べ替え・追加・編集・削除）。ADR-0041・ADR-0042。
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

const rail = (page: Page) => page.locator(".mll-sidebar");
const folderRow = (page: Page, id: string) => rail(page).locator(`[data-folder-id="${id}"]`);
const rowNames = (page: Page) => rail(page).locator(".mll-sbrow .nm").allTextContents();
const startEditing = (page: Page) =>
  rail(page).getByRole("button", { name: "編集", exact: true }).click();
const dialog = (page: Page) => page.getByRole("dialog");

async function createFolder(page: Page, body: Record<string, unknown>): Promise<string> {
  const res = await page.request.post("/api/smart-folders", {
    data: { name: "自作", sort: null, groupBy: null, ...body },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test("編集の状態でドラッグして並べ替えると、再読み込み後もその順になる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  const before = await rowNames(page);
  await startEditing(page);

  // お気に入りを、ランダムの上半分へ落とす（ランダムの前）
  await folderRow(page, "fav").dragTo(folderRow(page, "random"), {
    targetPosition: { x: 60, y: 3 },
  });
  const expected = before.filter((name) => name !== "お気に入り");
  expected.splice(expected.indexOf("ランダム"), 0, "お気に入り");
  await expect.poll(() => rowNames(page)).toEqual(expected);

  // 下半分なら後ろに入る
  await folderRow(page, "fav").dragTo(folderRow(page, "random"), {
    targetPosition: { x: 60, y: 26 },
  });
  const after = before.filter((name) => name !== "お気に入り");
  after.splice(after.indexOf("ランダム") + 1, 0, "お気に入り");
  await expect.poll(() => rowNames(page)).toEqual(after);

  await page.reload();
  await expect(rail(page)).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => rowNames(page)).toEqual(after);
  assertNoErrors(tracker);
});

test("削除してトーストの「元に戻す」で、同じ位置・同じ URL のまま戻る", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await rail(page)
    .getByRole("button", { name: /^最近追加/ })
    .click();
  await expect(page).toHaveURL(/\/library\/added$/);
  await rail(page)
    .getByRole("button", { name: /^最近再生/ })
    .click();
  await expect(page).toHaveURL(/\/library\/recent$/);
  const before = await rowNames(page);

  // 開いていない行を消して戻す。履歴に残った URL が同じ行を開く
  await startEditing(page);
  await folderRow(page, "added")
    .getByRole("button", { name: /を削除$/ })
    .click();
  await expect(page.getByText("「最近追加」を削除しました")).toBeVisible();
  await expect(folderRow(page, "added")).toHaveCount(0);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(folderRow(page, "added")).toBeVisible();
  await expect.poll(() => rowNames(page)).toEqual(before);
  await rail(page).getByRole("button", { name: "完了" }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/added$/);
  await expect(rail(page).getByRole("button", { name: /^最近追加/ })).toHaveAttribute(
    "aria-current",
    "true",
  );

  // 開いている行を消すと、置き換えで /library/all へ移る
  await startEditing(page);
  await folderRow(page, "added")
    .getByRole("button", { name: /を削除$/ })
    .click();
  await expect(page).toHaveURL(/\/library\/all$/);
  await expect(folderRow(page, "all")).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect.poll(() => rowNames(page)).toEqual(before);
  assertNoErrors(tracker);
});

test("＋メニュー: 既定から追加・グループ分けの追加・複製", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  // 既定から追加（最初に入らない既定が候補に出る）
  await rail(page).getByRole("button", { name: "追加", exact: true }).click();
  await rail(page).getByRole("menuitem", { name: "シリーズ別" }).click();
  await expect(page).toHaveURL(/\/library\/by-series$/);
  await expect(folderRow(page, "by-series")).toHaveCount(0);
  await expect(rail(page).getByRole("button", { name: /^シリーズ別/ })).toHaveAttribute(
    "aria-current",
    "true",
  );

  // 消した既定も候補に出る
  await startEditing(page);
  await folderRow(page, "by-year").getByRole("button", { name: "削除" }).click();
  await rail(page).getByRole("button", { name: "完了" }).click();
  await rail(page).getByRole("button", { name: "追加", exact: true }).click();
  await expect(rail(page).getByRole("menuitem", { name: "追加年別" })).toBeVisible();
  await page.keyboard.press("Escape");

  // グループ分けを追加
  await rail(page).getByRole("button", { name: "追加", exact: true }).click();
  await rail(page).getByRole("menuitem", { name: "グループ分けを追加" }).click();
  await expect(dialog(page).getByText("グループ分けを追加", { exact: true })).toBeVisible();
  await dialog(page).getByLabel("名前").fill("作曲者別");
  await dialog(page).getByLabel("グループ分け").selectOption({ label: "全タグ" });
  await dialog(page).getByRole("button", { name: "保存" }).click();
  await expect(page).toHaveURL(/\/library\/sf-[0-9a-f-]+$/);
  await expect(rail(page).getByRole("button", { name: /^作曲者別/ })).toHaveAttribute(
    "aria-current",
    "true",
  );

  // 絞り込みが無いとき、今のスマートフォルダーを複製（既定の並びを写す）
  await rail(page)
    .getByRole("button", { name: /^ランダム/ })
    .click();
  await rail(page).getByRole("button", { name: "追加", exact: true }).click();
  await rail(page).getByRole("menuitem", { name: "「ランダム」を複製" }).click();
  await expect(dialog(page).getByLabel("名前")).toHaveValue("ランダム（コピー）");
  await expect(dialog(page).getByLabel("既定の並び")).toHaveValue("random");
  await dialog(page).getByRole("button", { name: "保存" }).click();
  await expect(rail(page).getByRole("button", { name: /^ランダム（コピー）/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  assertNoErrors(tracker);
});

test("編集のダイアログ: 自作の条件を × で外すと件数が変わり、まとまりは1行で外れる", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  const id = await createFolder(page, {
    name: "絞った",
    condition: {
      type: "and",
      children: [
        { type: "bookmarked" },
        { type: "duration", op: "gte", sec: 7200 },
        { type: "or", children: [{ type: "hasError" }, { type: "bookmarked" }] },
      ],
    },
  });
  await openApp(page);
  const row = folderRow(page, id);
  await startEditing(page);
  await row.getByRole("button", { name: /を編集$/ }).click();
  await expect(dialog(page).getByText("「絞った」を編集")).toBeVisible();
  const rows = dialog(page).locator(".mll-condrow");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(2)).toHaveText("エラーあり または お気に入り");

  await rows.nth(2).getByRole("button", { name: "この条件を外す" }).click();
  await rows.nth(1).getByRole("button", { name: "この条件を外す" }).click();
  await expect(rows).toHaveCount(1);
  await dialog(page).getByRole("button", { name: "保存" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await rail(page).getByRole("button", { name: "完了" }).click();
  await expect(
    rail(page)
      .getByRole("button", { name: /^絞った/ })
      .locator(".ct"),
  ).toHaveText("4");
  assertNoErrors(tracker);
});

test("既定・「すべて」の編集権限と削除", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await startEditing(page);

  // 既定のもの: 条件は読み取り専用、グループ分けは変えられない
  await folderRow(page, "fav")
    .getByRole("button", { name: /を編集$/ })
    .click();
  await expect(dialog(page).locator(".mll-condrow")).toHaveCount(1);
  await expect(dialog(page).getByRole("button", { name: "この条件を外す" })).toHaveCount(0);
  await expect(dialog(page).getByLabel("名前")).toBeEnabled();
  await expect(dialog(page).getByLabel("グループ分け")).toBeDisabled();
  await dialog(page).getByRole("button", { name: "キャンセル" }).click();

  // 「すべて」: 名前・グループ分けは変えられず、削除もできない。並びは「すべて」と同じを選べない
  await folderRow(page, "all")
    .getByRole("button", { name: /を編集$/ })
    .click();
  await expect(dialog(page).getByLabel("名前")).toBeDisabled();
  await expect(dialog(page).getByLabel("グループ分け")).toBeDisabled();
  await expect(dialog(page).getByLabel("既定の並び").locator("option[value='']")).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "キャンセル" }).click();
  await expect(folderRow(page, "all").getByRole("button", { name: "削除" })).toHaveCount(0);
  assertNoErrors(tracker);
});
