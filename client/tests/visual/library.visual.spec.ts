// ピクセル比較専用。役割ベースの操作確認は library.smoke.spec.ts が担うため、ここでは
// スクリーンショットへ辿り着くための最小限の操作だけを行う。対象は全画面ではなく、
// 単体で安定している範囲（軸レール・値一覧・作品一覧・詳細パネルの各要素）に絞る。
// 全画面は作品件数・カバー画像の組み合わせで差分が出やすく、閾値を維持できない。
import { expect, test } from "@playwright/test";
import { openApp } from "./support";

test("library shell", async ({ page }) => {
  await openApp(page);

  const axisRail = page.locator(".mle-col.is-axis");
  await expect(axisRail.getByText("CV", { exact: true })).toBeVisible();
  await expect(axisRail).toHaveScreenshot("library-shell.png");
});

test("work detail panel - missing file", async ({ page }) => {
  await openApp(page);

  await page.getByText("お気に入りだった朗読劇", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  await expect(panel.getByText("ファイル欠損", { exact: true })).toBeVisible();

  await expect(panel).toHaveScreenshot("work-detail-missing.png");
});

test("tag filter chips and cross-axis AND filtering", async ({ page }) => {
  await openApp(page);

  // タグ軸 → 「癒し系」を選択（ADR-0012: 選択は全軸共通のタグフィルタへ）。
  await page.locator(".mll-axis", { hasText: "タグ" }).click();
  await page.locator(".mll-vrow", { hasText: "癒し系" }).click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["癒し系"]);

  const results = page.locator(".mll-results");
  await expect(results.locator(".mle-col.is-results")).toBeVisible();

  await expect(results).toHaveScreenshot("tag-filter-result-list.png");
});

test("axis value list - grid", async ({ page }) => {
  await openApp(page);

  await page.locator(".mll-axis", { hasText: "CV" }).click();
  await page.getByRole("button", { name: "グリッド" }).click();

  const valueList = page.locator(".mle-col.is-axis-values");
  await expect(valueList.locator(".mll-vtile").first()).toBeVisible();

  await expect(valueList).toHaveScreenshot("axis-value-list-grid.png");
});

test("axis value list - list（入れ子タグの階層表示）", async ({ page }) => {
  await openApp(page);

  await page.locator(".mll-axis", { hasText: "タグ" }).click();
  // 既定は件数ソート。名前順に切り替えると入れ子タグがインデント＋見出し行で並ぶ
  // （ADR-0012 §5、axisValueHierarchy.ts）。
  await page.locator(".mll-vlist-hd__sort", { hasText: "名前" }).click();

  const valueList = page.locator(".mle-col.is-axis-values");
  await expect(valueList.locator(".mll-vrow-heading").first()).toBeVisible();

  await expect(valueList).toHaveScreenshot("axis-value-list-hierarchy.png");
});

test("chip band compound filtering（軸をまたいだAND絞り込み）", async ({ page }) => {
  await openApp(page);

  await page.locator(".mll-axis", { hasText: "CV" }).click();
  await page.locator(".mll-vrow", { hasText: "霧島レイ" }).click();

  await page.locator(".mll-axis", { hasText: "サークル" }).click();
  const circleRow = page.locator(".mll-vrow", { hasText: "月白製作所" });
  await circleRow.hover();
  await circleRow.getByRole("button", { name: /をAND追加$/ }).click();

  await page.locator(".mll-axis", { hasText: "すべての作品" }).click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText([
    "cv/霧島レイ",
    "サークル/月白製作所",
  ]);

  const results = page.locator(".mll-results");
  await expect(results).toHaveScreenshot("chip-band-compound-filter.png");
});
