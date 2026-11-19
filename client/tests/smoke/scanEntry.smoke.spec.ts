import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

test.use({ fixtureScenario: "scan-review" });

test("上のバーのスキャン入口は新しい項目に点を付け、開くと消えて再読み込みでも消えたまま、ベルは無い", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const entry = page.getByRole("button", { name: "スキャン（新しい項目あり）" });
  await expect(entry).toBeVisible();
  await expect(page.getByRole("button", { name: /^通知/ })).toHaveCount(0);

  await entry.click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("banner").getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name: "スキャン", exact: true })).toBeVisible();

  // openApp の初期化スクリプトは読み込みのたびに localStorage を空にするため、
  // 開いたときに記憶された値を、その後に走る初期化スクリプトで書き戻して再読み込みする。
  const remembered = await page.evaluate(() => localStorage.getItem("mimimilli:scanEntrySeen"));
  expect(remembered).not.toBeNull();
  await page.addInitScript((value) => {
    localStorage.setItem("mimimilli:scanEntrySeen", value as string);
  }, remembered);
  await page.reload();
  await expect(page.getByRole("button", { name: "スキャン", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /新しい項目あり/ })).toHaveCount(0);

  assertNoErrors(tracker);
});
