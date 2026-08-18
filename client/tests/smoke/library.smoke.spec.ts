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

  await dialog.getByRole("button", { name: "スキャン" }).click();
  await expect(dialog.getByText("完了しました")).toBeVisible({ timeout: 15_000 });

  await dialog.getByRole("tab", { name: /^新規登録済み/ }).click();
  await expect(dialog.getByText("新規登録済みの作品")).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByRole("button", { name: /ツンデレ後輩ちゃんの秘密のお世話ボイス/ }),
  ).toBeVisible({ timeout: 15_000 });

  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toBeHidden();

  assertNoErrors(tracker);
});

test("未登録タブでRJコードを編集でき、候補を1件ずつ除外して元に戻せる", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop scenario only");

  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン" }).click();

  const unregistered = dialog.getByRole("tabpanel", { name: "未登録" });
  await expect(unregistered).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("tab", { name: "未登録（2件）" })).toBeVisible();

  // 行の accessible name は全セルの連結。x ボタンのラベルは全行が「〜を候補から外す」を
  // 含むため、行の識別は先頭セル（チェックボックスのラベル）へのアンカーで一意にする。
  const editRow = unregistered.getByRole("row", { name: /^「未登録作品」を選択/ });
  await editRow.getByRole("button", { name: "未検出" }).click();
  const rjInput = editRow.getByPlaceholder("RJコード");
  await rjInput.fill("RJ999999");
  await rjInput.press("Enter");
  await expect(editRow.getByRole("button", { name: "RJ999999" })).toBeVisible();

  const excludeRowName = /^「候補」を選択/;
  const excludeRow = unregistered.getByRole("row", { name: excludeRowName });
  await excludeRow.getByRole("button", { name: "「候補」を候補から外す" }).click();
  await expect(unregistered.getByRole("row", { name: excludeRowName })).toBeHidden();
  await expect(dialog.getByRole("tab", { name: "未登録（1件）" })).toBeVisible();

  await expect(dialog.getByText("「候補」を候補から外しました")).toBeVisible();
  await dialog.getByRole("button", { name: "元に戻す" }).click();

  await expect(dialog.getByRole("tab", { name: "未登録（2件）" })).toBeVisible();
  await expect(unregistered.getByRole("row", { name: excludeRowName })).toBeVisible();

  assertNoErrors(tracker);
});

test("スキャン完了後に候補を選択登録でき、問題をFilesで確認できる", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop scenario only");

  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン" }).click();

  const unregistered = dialog.getByRole("tabpanel", { name: "未登録" });
  await expect(unregistered).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("tab", { name: "未登録（2件）" })).toBeVisible();

  await unregistered.getByRole("button", { name: "2件をライブラリに追加" }).click();
  await expect(dialog.getByText("2件をライブラリに追加しました")).toBeVisible();

  // 切り替え完了を先に待つと、件数ラベル更新に別の5秒枠が与えられる（useScanCandidatesCache は setActiveTab と別レンダー）。
  await expect(dialog.getByRole("tab", { name: /^新規登録済み/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(dialog.getByRole("tab", { name: "未登録（0件）" })).toBeVisible();
  const newlyRegistered = dialog.getByRole("tabpanel", { name: "新規登録済み" });
  await expect(newlyRegistered.getByRole("button", { name: "未登録作品" })).toBeVisible();
  await expect(newlyRegistered.getByRole("button", { name: "候補" })).toBeVisible();

  await dialog.getByRole("tab", { name: /^要対応/ }).click();
  const attention = dialog.getByRole("tabpanel", { name: "要対応" });
  const primaryRow = attention.getByRole("row", { name: /夜想曲スタジオ/ });
  await expect(primaryRow.getByText("ID重複", { exact: true })).toBeVisible();
  const conflictRow = attention.getByRole("row", { name: /copies\// });
  await expect(conflictRow.getByText("競合相手", { exact: true })).toBeVisible();
  await expect(attention.getByText("読み取り失敗", { exact: true })).toBeVisible();

  await primaryRow.getByRole("button", { name: "Filesで開く" }).click();
  await expect(page.getByRole("button", { name: "ファイル", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTitle("RJ501001_夜更けの図書室で囁き朗読")).toHaveClass(/is-on/);

  assertNoErrors(tracker);
});

test("FilesでID重複を表示し、確認して別作品として取り込める（解決後はスキャンの要対応からも消える、TASK-322）", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "ファイル", exact: true }).click();
  await page.locator(".mle-row", { hasText: "dlsite" }).click();
  await page.locator(".mle-row", { hasText: "夜想曲スタジオ" }).click();
  const conflictRow = page.locator(".mle-row", { hasText: "夜更けの図書室で囁き朗読" });
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

  // 解決した診断はスキャン結果のスナップショットではなく常に最新を購読するため、
  // ダイアログを開き直しても要対応タブに残らない（TASK-322）。
  await page.getByRole("button", { name: "スキャン" }).click();
  const scanDialog = page.getByRole("dialog", { name: "スキャン" });
  await scanDialog.getByRole("tab", { name: /^要対応/ }).click();
  const attention = scanDialog.getByRole("tabpanel", { name: "要対応" });
  await expect(attention.getByRole("row", { name: /夜想曲スタジオ/ })).toBeHidden();
  await expect(attention.getByRole("row", { name: /copies\// })).toBeHidden();

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

test("Files: Workspace viewerで画像・PDF・text・videoをプレビューできる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "ファイル", exact: true }).click();
  await page.getByTitle("viewer").dblclick();
  await expect(page.getByText("sample.png", { exact: true })).toBeVisible();

  await page.getByTitle("sample.png").click();
  const sampleImage = page.locator('img[alt="sample.png"]');
  await expect(sampleImage).toBeVisible();
  await expect.poll(() => sampleImage.evaluate((image) => image.naturalWidth > 0)).toBe(true);

  await page.getByTitle("sample.pdf").click();
  await expect(page.locator("object[aria-label='sample.pdfのPDFプレビュー']")).toBeVisible();
  // ChromiumのPDF viewerはobject.contentDocumentを公開しないため、viewerが受け取るPDF本体を確認する。
  const pdfResponse = await page.request.get("/api/media/workspace?path=viewer%2Fsample.pdf");
  expect(pdfResponse.ok()).toBe(true);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await pdfResponse.text()).startsWith("%PDF-")).toBe(true);

  await page.getByTitle("sample.txt").click();
  await expect(page.locator(".mle-fprev__text")).toContainText("fixture text");

  await page.getByTitle("large.txt").click();
  await expect(page.getByText("サイズ上限のため先頭のみ表示", { exact: true })).toBeVisible();

  await page.getByTitle("sample.webm").click();
  const video = page.locator("video[controls]");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((element) => element.readyState >= 1 && element.duration > 0))
    .toBe(true);

  await page.getByTitle("archive.zip").click();
  await expect(page.getByText("ファイル（.zip）のプレビューは利用できません")).toBeVisible();

  assertNoErrors(tracker);
});
