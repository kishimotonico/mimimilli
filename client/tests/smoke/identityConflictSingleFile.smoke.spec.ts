import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, trackErrors } from "./support";

test.use({ fixtureScenario: "identity-conflict" });

test("Files: 単一ファイル形式のメタファイル行でID重複を再採番すると親フォルダーが選択される", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "ファイル", exact: true }).click();
  await page.locator(".mle-row", { hasText: "copies" }).click();
  const metaRow = page.getByTitle("d00002.mimimilli.json");
  await expect(metaRow).toBeVisible();
  await expect(metaRow.getByText("ID重複", { exact: true })).toBeVisible();
  await expect(page.getByTitle("d00002.mp3")).toBeVisible();

  await metaRow.click();
  const preview = page.locator(".mle-prv.is-files");
  await expect(preview.getByText("ID重複", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "別作品として取り込む" }).click();

  const dialog = page.getByRole("alertdialog", { name: "別作品として取り込む" });
  await expect(dialog.getByText("copies/d00002.mimimilli.json")).toBeVisible();
  await dialog.getByRole("button", { name: "取り込む" }).click();

  await expect(page.getByTitle("d00002.mimimilli.json")).toBeHidden();
  await expect(page.getByTitle("d00002.mp3").getByText("作品", { exact: true })).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "このフォルダーを作品として登録" }),
  ).toBeVisible();

  assertNoErrors(tracker);
});
