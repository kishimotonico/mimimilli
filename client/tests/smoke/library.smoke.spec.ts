// スクリーンショットを撮らない役割ベースの動作確認。ここが赤いときは常に実際の不具合を
// 意味する（見た目のズレでは落ちない）。各テストはコンソールエラー・未捕捉例外・
// 4xx/5xxレスポンス・ネットワークリクエスト失敗が出ていないことも併せて確認する。
import { expect, test } from "@playwright/test";
import { assertNoErrors, expectNoHorizontalOverflow, openApp, trackErrors } from "./support";

test("ライブラリシェル: 軸レール・結果面・チップ列が表示される", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await expect(page.locator(".mle-col.is-axis").getByText("CV", { exact: true })).toBeVisible();
  await expect(page.locator(".mll-tagband")).toBeVisible();
  await expect(page.locator(".mll-results, .mle-col.is-results").first()).toBeVisible();

  assertNoErrors(tracker);
});

test("軸を選ぶと値一覧が出て、値を選ぶと作品一覧へ遷移しフィルタチップが付く", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "CV" }).click();
  const valueList = page.getByRole("group", { name: "CVの値一覧" });
  await expect(valueList.getByRole("button").first()).toBeVisible();

  await valueList.getByRole("button", { name: /^霧島レイ(?!を)/ }).click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["cv/霧島レイ"]);
  await expect(page.getByRole("button", { name: "すべての作品" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.locator(".mle-col.is-results")).toBeVisible();

  assertNoErrors(tracker);
});

test("軸の値一覧をグリッド表示に切り替えられる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "CV" }).click();
  await page.getByRole("button", { name: "グリッド" }).click();

  const valueList = page.getByRole("group", { name: "CVの値一覧" });
  await expect(valueList.getByRole("button").first()).toBeVisible();

  assertNoErrors(tracker);
});

test("タグ軸を名前順にすると入れ子タグが階層表示される", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "タグ" }).click();
  // 既定は件数ソート。名前順に切り替えると入れ子タグがインデント＋見出し行で並ぶ
  // （axisValueHierarchy.ts）。見出し行はrole="heading"を持たないためクラスで特定する。
  await page.getByRole("button", { name: "名前" }).click();

  const valueList = page.locator(".mle-col.is-axis-values");
  await expect(valueList.locator(".mll-vrow-heading").first()).toBeVisible();

  assertNoErrors(tracker);
});

test("軸をまたいだAND絞り込みでチップが積み上がる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "CV" }).click();
  await page
    .getByRole("group", { name: "CVの値一覧" })
    .getByRole("button", { name: /^霧島レイ(?!を)/ })
    .click();

  await page.getByRole("button", { name: "サークル" }).click();
  const circleList = page.getByRole("group", { name: "サークルの値一覧" });
  await circleList.getByRole("button", { name: /^月白製作所(?!を)/ }).hover();
  await circleList.getByRole("button", { name: "月白製作所をAND追加" }).click();

  await page.getByRole("button", { name: "すべての作品" }).click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText([
    "cv/霧島レイ",
    "サークル/月白製作所",
  ]);
  await expect(page.locator(".mll-results")).toBeVisible();

  assertNoErrors(tracker);
});

test("作品を選ぶとプレビューが開く（ファイル欠損の状態表示を含む）", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("お気に入りだった朗読劇", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("ファイル欠損", { exact: true })).toBeVisible();

  assertNoErrors(tracker);
});

test("詳細パネル: 再開ボタンが正しいアクセシブル名で表示される", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const work = (await (await page.request.get("/api/works/RJ501001")).json()) as {
    defaultPlaylistId: string;
    playlists: Array<{ id: string; tracks: Array<{ id: string }> }>;
  };
  const playlist = work.playlists.find((candidate) => candidate.id === work.defaultPlaylistId)!;
  const resumeResponse = await page.request.post("/api/works/RJ501001/resume", {
    data: { playlistId: playlist.id, trackId: playlist.tracks[2]!.id, offsetSec: 201 },
  });
  expect(resumeResponse.ok()).toBe(true);

  const workTitle = page.getByText("夜更けの図書室で囁き朗読", { exact: false });
  await expect(workTitle).toBeVisible();
  await workTitle.click();

  const panel = page.locator(".mle-prv");
  // 主ボタンのアクセシブル名は状態を表す短い文言（「続きから再生」）で、
  // 時刻はツールチップ（title）に載る。ボタン名に時刻は含めない設計。
  const resumeButton = panel.getByRole("button", { name: "続きから再生" });
  await expect(resumeButton).toBeVisible();
  await expect(resumeButton).toHaveAttribute("title", "古い本の読み聞かせ · 3:21 から再開");
  await expect(panel.getByText("再開 3:21", { exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "再生メニュー" }).click();
  await expect(panel.getByRole("menuitem", { name: "最初から再生" })).toBeVisible();

  assertNoErrors(tracker);
});

test("詳細パネル: 編集モードでのみタグ削除ボタンが現れる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  const removeButtons = panel.getByRole("button", { name: /^タグ「.+」を削除$/ });
  await expect(removeButtons.first()).toBeHidden();

  // 誤操作防止のため既定は非表示。「タグを編集」で編集モードに入って初めて現れる。
  await panel.getByRole("button", { name: "タグを編集" }).click();
  await expect(removeButtons.first()).toBeVisible();

  await panel.getByRole("button", { name: "タグを追加" }).click();
  await expect(panel.getByRole("combobox", { name: "追加するタグ" })).toBeVisible();

  assertNoErrors(tracker);
});

test("スキャンダイアログが開いて完了し、閉じられる", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop scenario only");

  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();

  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await expect(dialog.getByRole("heading", { name: "スキャン", level: 2 })).toBeVisible();

  await dialog.getByRole("button", { name: "スキャン開始" }).click();
  await expect(dialog.getByText("新規検出した作品")).toBeVisible({ timeout: 15_000 });
  // new-work シナリオの RJ501011。スキャン直後の DLsite 一括取得でタイトルが fixture 名に置き換わる。
  await expect(dialog.getByRole("button", { name: /RJ501011/ })).toBeVisible();
  await expect(dialog.getByText("完了しました")).toBeVisible({ timeout: 15_000 });

  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toBeHidden();

  assertNoErrors(tracker);
});

test("FilesでID重複を表示し、確認して別作品として取り込める", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "ファイル" }).click();
  await page.locator(".mle-row", { hasText: "dlsite" }).click();
  await page.locator(".mle-row", { hasText: "夜想曲スタジオ" }).click();
  const conflictRow = page.locator(".mle-row", { hasText: "RJ501001_夜更けの図書室で囁き朗読" });
  await expect(conflictRow.getByText("ID重複", { exact: true })).toBeVisible();

  await conflictRow.click();
  const preview = page.locator(".mle-prv.is-files");
  await expect(preview.getByText("ID重複", { exact: true })).toBeVisible();
  await expect(preview.getByText("copies/RJ501001_夜更けの図書室で囁き朗読")).toBeVisible();
  await preview.getByRole("button", { name: "別作品として取り込む" }).click();

  const dialog = page.getByRole("alertdialog", { name: "別作品として取り込む" });
  await expect(
    dialog.getByText("dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "取り込む" }).click();
  await expect(preview.getByText("ID重複", { exact: true })).toBeHidden();

  assertNoErrors(tracker);
});

test("主要画面でヨコ方向スクロールが発生しない", async ({ page }) => {
  const tracker = trackErrors(page);

  // ライブラリシェル（作品一覧）
  await openApp(page);
  await expectNoHorizontalOverflow(page);

  // 軸の値一覧（CV軸選択時は結果面が値一覧に置き換わる。ADR-0012）
  await page.getByRole("button", { name: "CV" }).click();
  await expectNoHorizontalOverflow(page);

  // 作品プレビュー（画面遷移を跨がず独立に確認するため再度 openApp から）
  await openApp(page);
  await page.getByText("お気に入りだった朗読劇", { exact: false }).click();
  await expectNoHorizontalOverflow(page);

  assertNoErrors(tracker);
});
