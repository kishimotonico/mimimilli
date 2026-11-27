// スクリーンショットを撮らない役割ベースの動作確認。ここが赤いときは常に実際の不具合を
// 意味する（見た目のズレでは落ちない）。各テストはコンソールエラー・未捕捉例外・
// 4xx/5xxレスポンス・ネットワークリクエスト失敗が出ていないことも併せて確認する。
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { assertNoErrors, expectNoHorizontalOverflow, openApp, trackErrors } from "./support";

const rail = (page: Page) => page.locator(".mll-sidebar");
const railRow = (page: Page, name: string | RegExp) =>
  rail(page).getByRole("button", typeof name === "string" ? { name, exact: true } : { name });
const search = (page: Page) => page.getByPlaceholder(/ライブラリを検索/);

test("ライブラリシェル: サイドバー・結果面・チップ列が表示される", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await expect(railRow(page, "CV別")).toBeVisible();
  await expect(railRow(page, "すべて")).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".mll-tagband")).toBeVisible();
  await expect(page.locator(".mll-results, .mle-col.is-results").first()).toBeVisible();

  assertNoErrors(tracker);
});

test("スマートフォルダーを選ぶと値一覧が出て、値を選ぶと値の作品一覧へ遷移しパンくずに値が出る", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, "CV別").click();
  await expect(page).toHaveURL(/\/library\/by-cv$/);
  const valueList = page.getByRole("group", { name: "CVの一覧" });
  await expect(valueList.getByRole("button").first()).toBeVisible();

  await valueList.getByRole("button", { name: /^霧島レイ(?!を)/ }).click();
  await expect(page).toHaveURL(/\/library\/by-cv\?group=/);
  expect(new URL(page.url()).searchParams.get("group")).toBe("霧島レイ");
  expect(new URL(page.url()).searchParams.has("sort")).toBe(false);
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveCount(0);
  await expect(page.locator(".mle-crumbs").getByRole("button", { name: "CV別" })).toBeVisible();
  await expect(page.locator(".mle-crumbs").getByRole("button", { name: "霧島レイ" })).toBeVisible();
  await expect(railRow(page, "CV別")).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".mle-col.is-results")).toBeVisible();

  assertNoErrors(tracker);
});

test("パンくずの値から兄弟の値へ移れる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, "CV別").click();
  await page
    .getByRole("group", { name: "CVの一覧" })
    .getByRole("button", { name: /^霧島レイ(?!を)/ })
    .click();
  await page.locator(".mle-crumbs").getByRole("button", { name: "霧島レイ" }).click();
  await page.getByRole("button", { name: /^天音かなで/ }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get("group")).toBe("天音かなで");
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveCount(0);

  assertNoErrors(tracker);
});

test("グループの値一覧をグリッド表示に切り替えられる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, "CV別").click();
  await page.getByRole("button", { name: "グリッド" }).click();

  const valueList = page.getByRole("group", { name: "CVの一覧" });
  await expect(valueList.getByRole("button").first()).toBeVisible();

  assertNoErrors(tracker);
});

test("タグ別を名前順にすると入れ子タグが階層表示される", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, "タグ別").click();
  // 既定は件数ソート。名前順に切り替えると入れ子タグがインデント＋見出し行で並ぶ
  // （groupValueHierarchy.ts）。見出し行はrole="heading"を持たないためクラスで特定する。
  await page.getByRole("button", { name: "名前" }).click();

  const valueList = page.locator(".mle-col.is-group-values");
  await expect(valueList.locator(".mll-vrow-heading").first()).toBeVisible();

  assertNoErrors(tracker);
});

test("値の作品一覧で「＋絞り込み」からチップを足せる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, "CV別").click();
  await page
    .getByRole("group", { name: "CVの一覧" })
    .getByRole("button", { name: /^霧島レイ(?!を)/ })
    .click();

  await page.getByRole("button", { name: "絞り込み" }).click();
  await page
    .getByRole("group", { name: "絞り込みの種類" })
    .getByRole("button", { name: "サークル" })
    .click();
  await page
    .getByRole("group", { name: "サークルの一覧" })
    .getByRole("button", { name: /^月白製作所/ })
    .click();

  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["サークル/月白製作所"]);
  expect(new URL(page.url()).searchParams.get("group")).toBe("霧島レイ");
  await expect(page.locator(".mll-results")).toBeVisible();

  assertNoErrors(tracker);
});

test("サイドバーのクイックオーバーレイ: 値の主クリックでその値の一覧へ進み、追加ボタンは行き先どおりにチップを足す", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const quickList = page.getByRole("group", { name: "CVの一覧" });
  await railRow(page, "CV別").hover();
  await quickList.getByRole("button", { name: /^霧島レイ(?!を)/ }).click();
  await expect(page).toHaveURL(/\/library\/by-cv\?group=/);
  expect(new URL(page.url()).searchParams.get("group")).toBe("霧島レイ");
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveCount(0);

  // 作品一覧が開いているとき、追加ボタンはその一覧にチップを足す
  await railRow(page, "CV別").hover();
  await expect(quickList.getByRole("button", { name: "霧島レイをAND追加" })).toHaveCount(0);
  await quickList.getByRole("button", { name: "天音かなでをAND追加" }).click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["cv/天音かなで"]);
  expect(new URL(page.url()).searchParams.get("group")).toBe("霧島レイ");

  // 値一覧が開いているとき、追加ボタンは値一覧のままチップを足す
  await railRow(page, "CV別").click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveCount(0);
  await page.mouse.move(1200, 600);
  await expect(page.getByRole("dialog", { name: "CV", exact: true })).toHaveCount(0);
  await railRow(page, "CV別").hover();
  await quickList.getByRole("button", { name: "霧島レイをAND追加" }).click();
  await expect(page).toHaveURL(/\/library\/by-cv\?/);
  expect(new URL(page.url()).searchParams.has("group")).toBe(false);
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["cv/霧島レイ"]);
  await expect(page.locator(".mll-tagband__count")).toHaveText(/^\S+ \d+ 件$/);

  assertNoErrors(tracker);
});

test("値一覧でも検索でき、同じ値一覧のまま値と件数が絞り込み後になる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, "CV別").click();
  const valueList = page.getByRole("group", { name: "CVの一覧" });
  await expect(valueList.getByRole("button").first()).toBeVisible();
  const before = await valueList.getByRole("button").count();

  await expect(search(page)).toBeEnabled();
  await expect(valueList.getByRole("button", { name: /をAND追加/ })).toHaveCount(0);
  await expect(page.locator(".mll-tagband__count")).toHaveText(/^\S+ \d+ 件$/);

  await search(page).fill("霧島");
  await expect(page).toHaveURL(/\/library\/by-cv\?q=/);
  await expect(railRow(page, "CV別")).toHaveAttribute("aria-current", "true");
  await expect(valueList.getByRole("button", { name: /^霧島レイ(?!を)/ })).toBeVisible();
  await expect.poll(() => valueList.getByRole("button").count()).toBeLessThan(before);

  await valueList.getByRole("button", { name: /^霧島レイ(?!を)/ }).click();
  await expect(page).toHaveURL(/group=/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("霧島");
  await expect(search(page)).toHaveValue("霧島");

  assertNoErrors(tracker);
});

test("スマートフォルダーを切り替えるとチップと検索語が消える", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await search(page).fill("霧島");
  await railRow(page, "CV別").click();

  await expect(search(page)).toHaveValue("");
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveCount(0);

  // パンくずの先頭は値を選ぶ前の値一覧のまま。「すべて」へ戻ると条件なしの一覧になる
  await railRow(page, "すべて").click();
  await expect(search(page)).toHaveValue("");
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveCount(0);

  assertNoErrors(tracker);
});

test("0件のとき「すべて」で探すと、同じチップと検索語で「すべて」へ移る", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const quickList = page.getByRole("group", { name: "CVの一覧" });
  await railRow(page, "CV別").click();
  await page.mouse.move(1200, 600);
  await expect(quickList).toHaveCount(0);
  await railRow(page, "CV別").hover();
  await quickList.getByRole("button", { name: "霧島レイをAND追加" }).click();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["cv/霧島レイ"]);
  await search(page).fill("存在しない検索語");
  const valueList = page.locator(".is-group-values");
  await expect(
    valueList.getByText("「存在しない検索語」と選択中の絞り込みに一致する作品はありません"),
  ).toBeVisible();
  await valueList.getByRole("button", { name: "「すべて」で探す" }).click();

  await expect(page).toHaveURL(/\/library\/all\?/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("存在しない検索語");
  await expect(search(page)).toHaveValue("存在しない検索語");
  await expect(railRow(page, "すべて")).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["cv/霧島レイ"]);

  assertNoErrors(tracker);
});

test("並び順メニュー: 今の並びはURLに出ず、戻る・進むで保たれ、既定として保存できる", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const sortButton = page.getByRole("button", { name: "ソート", exact: true });
  await sortButton.click();
  await page.getByRole("menu").getByRole("menuitemradio", { name: "タイトル（A→Z）" }).click();
  expect(new URL(page.url()).searchParams.has("sort")).toBe(false);

  await railRow(page, "CV別").click();
  await expect(page).toHaveURL(/\/library\/by-cv/);
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/all/);
  await sortButton.click();
  await expect(
    page.getByRole("menu").getByRole("menuitemradio", { name: "タイトル（A→Z）" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menu").getByRole("menuitem", { name: "このソートを既定にする" }).click();

  // 保存後は今の並びが外れて既定に従い、メニューの保存項目も消える
  await sortButton.click();
  await expect(
    page.getByRole("menu").getByRole("menuitemradio", { name: "タイトル（A→Z）" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("menu").getByRole("menuitem", { name: "このソートを既定にする" }),
  ).toHaveCount(0);

  // サイドバーから入り直しても、保存した既定の並びになる
  await page.keyboard.press("Escape");
  await rail(page)
    .getByRole("button", { name: /^お気に入り/ })
    .click();
  await railRow(page, "すべて").click();
  await sortButton.click();
  await expect(
    page.getByRole("menu").getByRole("menuitemradio", { name: "タイトル（A→Z）" }),
  ).toHaveAttribute("aria-checked", "true");

  assertNoErrors(tracker);
});

test("ランダム: 「並べ直す」で順序が変わる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, "ランダム").click();
  const titles = () => page.locator(".mle-col.is-results [data-index]").allInnerTexts();
  await expect(page.getByRole("button", { name: "並べ直す" })).toBeVisible();
  const before = await titles();
  let changed = false;
  for (let i = 0; i < 5 && !changed; i++) {
    await page.getByRole("button", { name: "並べ直す" }).click();
    await expect.poll(async () => (await titles()).length).toBeGreaterThan(0);
    changed = JSON.stringify(await titles()) !== JSON.stringify(before);
  }
  expect(changed).toBe(true);

  assertNoErrors(tracker);
});

test("作品を選ぶとプレビューが開く（行方不明の状態表示を含む）", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("お気に入りだった朗読劇", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("行方不明", { exact: true })).toBeVisible();

  assertNoErrors(tracker);
});

/**
 * 一覧で、タイトルを含む行の作品 ID と、その次（末尾なら前）の作品 ID。登録解除でフォーカスが移る先。
 * 解除する行が先頭でも末尾でもない（隣の候補が前後にある）ことを確かめ、隣の取り違えを検出できるようにする
 */
async function unregisterTargetOf(
  page: Page,
  titlePart: string,
): Promise<{ id: string; neighborId: string }> {
  const target = await page.evaluate((title) => {
    const rows = [...document.querySelectorAll<HTMLElement>("[data-work-id][data-flat-index]")]
      .map((row) => ({
        id: row.dataset.workId ?? "",
        index: Number(row.dataset.flatIndex),
        label: row.getAttribute("aria-label") ?? "",
      }))
      .sort((a, b) => a.index - b.index);
    const at = rows.findIndex((row) => row.label.includes(title));
    return { at, last: rows.length - 1, id: rows[at]?.id ?? "", next: rows[at + 1]?.id ?? "" };
  }, titlePart);
  expect(target.at).toBeGreaterThan(0);
  expect(target.at).toBeLessThan(target.last);
  expect(target.next).not.toBe("");
  return { id: target.id, neighborId: target.next };
}

test("詳細パネルの「その他」メニューから登録解除できる（確認ダイアログ経由、パネルは閉じ一覧から消える）", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("添い寝カフェへようこそ", { exact: false }).click();
  const { neighborId } = await unregisterTargetOf(page, "添い寝カフェへようこそ");

  const panel = page.locator(".mle-prv");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "その他" }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "登録解除" }).click();

  const dialog = page.getByRole("alertdialog", { name: "登録解除" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "解除する" }).click();

  await expect(panel).toBeHidden();
  await expect(
    page.locator(".mll-results").getByText("添い寝カフェへようこそ", { exact: false }),
  ).toBeHidden();
  await expect(page.getByText("を登録解除しました", { exact: false })).toBeVisible();
  // フォーカスは、繰り上がった隣の行へ移る
  await expect(page.locator(`[data-work-id="${neighborId}"]`)).toBeFocused();

  // 解除した作品の詳細の取り直しが404になることが、選択解除の合図
  expect(tracker.failedResponses).toEqual([expect.stringMatching(/^404 .*\/api\/works\//)]);
  tracker.failedResponses.length = 0;
  expect(tracker.consoleErrors).toEqual([expect.stringContaining("status of 404")]);
  tracker.consoleErrors.length = 0;
  assertNoErrors(tracker);
});

test("作品詳細ページから登録解除すると、ライブラリへ戻って隣の行にフォーカスが移る", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("添い寝カフェへようこそ", { exact: false }).click();
  const { id, neighborId } = await unregisterTargetOf(page, "添い寝カフェへようこそ");
  await page.locator(".mle-prv").getByRole("button", { name: "全画面へ展開" }).click();
  await expect(page).toHaveURL(/\/work\//);

  await page.getByRole("button", { name: "その他" }).last().click();
  await page.getByRole("menu").getByRole("menuitem", { name: "登録解除" }).click();
  await page
    .getByRole("alertdialog", { name: "登録解除" })
    .getByRole("button", { name: "解除する" })
    .click();

  await expect(page).toHaveURL(/\/library\//);
  await expect(page.locator(`[data-work-id="${neighborId}"]`)).toBeFocused();

  // 解除した作品の詳細の取り直しが404になることが、ライブラリへ戻る合図（詳細ページでは複数回起きうる）
  expect(tracker.failedResponses.length).toBeGreaterThan(0);
  for (const response of tracker.failedResponses) {
    expect(response).toMatch(new RegExp(`^404 .*/api/works/${id}$`));
  }
  tracker.failedResponses.length = 0;
  for (const error of tracker.consoleErrors) expect(error).toContain("status of 404");
  tracker.consoleErrors.length = 0;
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
  await expect(
    page.getByRole("menu").getByRole("menuitem", { name: "最初から再生" }),
  ).toBeVisible();

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

test("詳細パネル: タグクリックで1クリックそのタグの作品一覧へ絞り込まれ詳細は閉じる", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "タグ「囁き」で絞り込む" }).click();

  await expect(panel).toBeHidden();
  await expect(page.locator(".mll-tagband .mll-tagband__chip")).toHaveText(["囁き"]);
  await expect(railRow(page, "すべて")).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".mle-col.is-results")).toBeVisible();

  assertNoErrors(tracker);
});

test("詳細パネル: 「全画面へ展開」で全画面詳細へ遷移し、戻るでパネル状態に戻る", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();

  const panel = page.locator(".mle-prv");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "全画面へ展開" }).click();

  await expect(page).toHaveURL(/\/work\//);
  await expect(
    page.getByRole("heading", { name: "夜更けの図書室で囁き朗読", exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "作品を編集" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/library\//);
  await expect(panel).toBeVisible();

  assertNoErrors(tracker);
});

test("作品編集: 関連URLを追加できる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();
  const panel = page.locator(".mle-prv");
  await panel.getByRole("button", { name: "作品を編集" }).click();

  const dialog = page.getByRole("dialog", { name: "作品を編集" });
  await dialog.getByRole("button", { name: "URLを追加" }).click();
  await dialog.getByLabel("URLラベル").last().fill("公式");
  await dialog
    .getByLabel(/^URL \d+$/)
    .last()
    .fill("https://example.com/work");
  await dialog.locator("footer").getByRole("button", { name: "保存" }).click();
  await dialog.locator("footer").getByRole("button", { name: "閉じる" }).click();

  await panel.getByRole("button", { name: "その他" }).click();
  await expect(page.getByRole("menu").getByRole("menuitem", { name: "公式を開く" })).toBeVisible();

  assertNoErrors(tracker);
});

test("作品編集: タイトルとタグをまとめて1回の保存で確定できる（一括draft保存）", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();
  const panel = page.locator(".mle-prv");
  await panel.getByRole("button", { name: "作品を編集" }).click();

  const dialog = page.getByRole("dialog", { name: "作品を編集" });
  const titleInput = dialog.getByLabel("タイトル");
  await expect(titleInput).toBeEnabled();
  await titleInput.fill("改題した朗読劇");

  // タグのdraft操作（既存タグの削除）もタイトルと一緒に1回の保存でまとめて確定する。
  await dialog.getByRole("button", { name: "タグ「癒し系」を削除" }).click();

  await dialog.locator("footer").getByRole("button", { name: "保存" }).click();
  await expect(dialog.locator("footer").getByRole("button", { name: "保存" })).toBeDisabled();
  await dialog.locator("footer").getByRole("button", { name: "閉じる" }).click();

  await expect(panel.getByText("改題した朗読劇", { exact: false })).toBeVisible();
  await expect(panel.getByRole("button", { name: "タグ「癒し系」で絞り込む" })).toBeHidden();

  assertNoErrors(tracker);
});

test("スキャンダイアログが開いて完了し、閉じられる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();

  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await expect(dialog.getByRole("heading", { name: "スキャン", level: 2 })).toBeVisible();

  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();
  await expect(dialog.getByRole("tab", { name: /^新規作品（\d+件）/ })).toBeVisible({
    timeout: 15_000,
  });

  await dialog.getByRole("tab", { name: /^新規作品/ }).click();
  await expect(
    dialog.getByRole("button", { name: /ツンデレ後輩ちゃんの秘密のお世話ボイス/ }),
  ).toBeVisible({ timeout: 15_000 });

  // スキャン完了トーストも同じ「閉じる」ラベルを持つため、ヘッダーの閉じるボタンに絞る。
  await dialog.getByRole("banner").getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toBeHidden();

  assertNoErrors(tracker);
});

test("更新済みタブで変更内容を種類別に絞り込め、作品タイトルから作品詳細を開ける", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();
  await expect(dialog.getByRole("tab", { name: /^更新済み（\d+件）/ })).toBeVisible({
    timeout: 15_000,
  });

  await dialog.getByRole("tab", { name: "更新済み" }).click();
  const panel = dialog.getByRole("tabpanel", { name: "更新済み" });
  const movedRow = panel.getByRole("row", { name: /環境音と読み聞かせ/ });
  await expect(movedRow.getByText("旧フォルダー/RJ501007 → RJ501007")).toBeVisible({
    timeout: 15_000,
  });
  await expect(movedRow.getByText("作品情報ファイルを更新")).toBeVisible();
  await expect(
    panel.getByRole("row", { name: /添い寝カフェ/ }).getByText("音声ファイル +3"),
  ).toBeVisible();
  await expect(
    panel.getByRole("row", { name: /意識がとろける/ }).getByText("ファイル構成を更新"),
  ).toBeVisible();

  await panel.getByRole("button", { name: /^移動/ }).click();
  await expect(panel.getByRole("row", { name: /添い寝カフェ/ })).toBeHidden();
  await expect(movedRow).toBeVisible();

  await panel
    .getByRole("button", { name: "【睡眠導入】環境音と読み聞かせ ~小雨の降る夜に~" })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/work\//);
  await expect(page.getByRole("button", { name: "作品を編集" })).toBeVisible();

  assertNoErrors(tracker);
});

test("新規作品タブでパスを押すとFilesが開き、スキャンモーダルが閉じる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();
  await expect(dialog.getByRole("tab", { name: /^新規作品（\d+件）/ })).toBeVisible({
    timeout: 15_000,
  });

  await dialog.getByRole("tab", { name: "新規作品" }).click();
  const panel = dialog.getByRole("tabpanel", { name: "新規作品" });
  await expect(panel.getByText("連携済み").first()).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByText("未連携").first()).toBeVisible();
  await expect(panel.getByText("取得待ち")).toHaveCount(0);

  await panel
    .getByTitle(/^Filesで開く: /)
    .first()
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "ファイル", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  assertNoErrors(tracker);
});

test("未登録タブでRJコードを編集でき、選んだ候補を除外して元に戻せる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();

  await dialog.getByRole("tab", { name: /^未登録（/ }).click();
  const unregistered = dialog.getByRole("tabpanel", { name: /^未登録/ });
  await expect(unregistered).toBeVisible({ timeout: 15_000 });

  // 行の accessible name は全セルの連結。行の識別は先頭セル（チェックボックスのラベル）へのアンカーで一意にする。
  const editRow = unregistered.getByRole("row", { name: /^「未登録作品」を選択/ });
  await editRow.getByRole("button", { name: "—" }).click();
  const rjInput = editRow.getByPlaceholder("RJコード");
  await rjInput.fill("RJ999999");
  await rjInput.press("Enter");
  await expect(editRow.getByRole("button", { name: "RJ999999" })).toBeVisible();

  const excludeRowName = /^「候補」を選択/;
  await unregistered.getByRole("button", { name: "「候補」の操作" }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "除外", exact: true }).click();
  await expect(unregistered.getByRole("row", { name: excludeRowName })).toBeHidden();

  await expect(dialog.getByText("「候補」を除外しました")).toBeVisible();
  await dialog.getByRole("button", { name: "元に戻す" }).click();
  await expect(unregistered.getByRole("row", { name: excludeRowName })).toBeVisible();
  await dialog.getByRole("tab", { name: "新規作品" }).click();
  await expect(dialog.getByRole("tab", { name: "未登録（2件）" })).toBeVisible();

  await dialog.getByRole("tab", { name: /^未登録/ }).click();
  await unregistered.getByRole("button", { name: "「候補」の操作" }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "除外", exact: true }).click();
  await expect(dialog.getByRole("tab", { name: "未登録（1件）" })).toBeVisible();

  await unregistered.getByRole("button", { name: /^除外済み/ }).click();
  await unregistered.getByRole("button", { name: /を未登録に戻す$/ }).click();
  await expect(dialog.getByRole("tab", { name: "未登録（2件）" })).toBeVisible();

  assertNoErrors(tracker);
});

test("スキャン完了後に候補を選択登録でき、問題をFilesで確認できる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByRole("button", { name: "スキャン" }).click();
  const dialog = page.getByRole("dialog", { name: "スキャン" });
  await dialog.getByRole("button", { name: "スキャン", exact: true }).click();

  await dialog.getByRole("tab", { name: /^未登録（/ }).click();
  const unregistered = dialog.getByRole("tabpanel", { name: /^未登録/ });
  await expect(unregistered).toBeVisible({ timeout: 15_000 });

  await unregistered.getByRole("button", { name: "2件を追加" }).click();

  // 切り替え完了を先に待つと、件数ラベル更新に別の5秒枠が与えられる（useScanCandidatesCache は setActiveTab と別レンダー）。
  await expect(dialog.getByRole("tab", { name: /^新規作品/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const newlyRegistered = dialog.getByRole("tabpanel", { name: "新規作品" });
  await expect(newlyRegistered.getByRole("row", { name: /未登録作品/ })).toBeVisible();
  await expect(newlyRegistered.getByRole("row", { name: /候補/ })).toBeVisible();

  await dialog.getByRole("tab", { name: /^要対応/ }).click();
  const attention = dialog.getByRole("tabpanel", { name: "要対応" });
  const conflictRow = attention.getByRole("row", { name: /ID重複/ });
  await expect(conflictRow.getByRole("button", { name: /copies\// })).toBeVisible();
  await expect(attention.getByText("読み取り失敗", { exact: true })).toBeVisible();

  await conflictRow
    .getByRole("button", { name: "dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読" })
    .click();
  await expect(page.getByRole("button", { name: "ファイル", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTitle("RJ501001_夜更けの図書室で囁き朗読")).toHaveClass(/is-on/);

  assertNoErrors(tracker);
});

test("FilesでID重複を表示し、確認して別の作品として取り込める（解決後はスキャンの要対応からも消える）", async ({
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
  await preview.getByRole("button", { name: "別の作品として取り込む" }).click();

  const dialog = page.getByRole("alertdialog", { name: "別の作品として取り込む" });
  await expect(
    dialog.getByText("dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "取り込む" }).click();
  await expect(preview.getByText("ID重複", { exact: true })).toBeHidden();

  // 解決した診断はスキャン結果のスナップショットではなく常に最新を購読するため、
  // ダイアログを開き直しても要対応タブに残らない。
  await page.getByRole("button", { name: "スキャン" }).click();
  const scanDialog = page.getByRole("dialog", { name: "スキャン" });
  await scanDialog.getByRole("tab", { name: /^要対応/ }).click();
  const attention = scanDialog.getByRole("tabpanel", { name: "要対応" });
  await expect(attention.getByRole("row", { name: /ID重複/ })).toBeHidden();
  await expect(attention.getByRole("row", { name: /copies\// })).toBeHidden();
  await expect(attention.getByRole("row", { name: /お気に入りだった朗読劇/ })).toBeVisible();

  assertNoErrors(tracker);
});

test("主要画面でヨコ方向スクロールが発生しない", async ({ page }) => {
  const tracker = trackErrors(page);

  // ライブラリシェル（作品一覧）
  await openApp(page);
  await expectNoHorizontalOverflow(page);

  // グループの値一覧（CV別を開いたときは結果面が値一覧に置き換わる。ADR-0012）
  await page.getByRole("button", { name: "CV" }).click();
  const valueList = page.getByRole("group", { name: "CVの一覧" });
  await expect(valueList.getByRole("button").first()).toBeVisible();
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

test("Files: 未登録の音声ファイルを作品として登録できる", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await page.getByRole("button", { name: "ファイル", exact: true }).click();
  await page.getByTitle("fanza").dblclick();
  await expect(page.getByTitle("d00001.mp3")).toBeVisible();
  await page.getByTitle("d00001.mp3").click();

  const preview = page.locator(".mle-prv.is-files");
  await preview.getByRole("button", { name: "このファイルを作品として登録" }).click();

  const dialog = page.getByRole("dialog", { name: "このファイルを作品として登録" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "登録" }).click();
  await expect(preview.getByRole("button", { name: "登録解除" })).toBeVisible();

  await page.getByRole("button", { name: "ライブラリへ戻る" }).click();
  await page.getByPlaceholder("ライブラリを検索（タイトル · CV · タグ · RJ ...）").fill("d00001");
  await expect(page.getByRole("button", { name: /FANZA単一ファイル|d00001/ })).toBeVisible();

  assertNoErrors(tracker);
});

test("サイドバー: アドレスバーのボタンと Ctrl+B で隠す・出せて、再読み込み後と作品詳細でも保たれる", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const toggle = page.getByRole("button", { name: "サイドバー" });
  await expect(rail(page)).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(rail(page)).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => localStorage.getItem("mimimilli:librarySidebarOpen"))).toBe(
    "false",
  );

  // openApp の初期化スクリプトは読み込みのたびに localStorage を消すため、保存済みの状態を積み直して再読み込みする
  await page.addInitScript(() => {
    localStorage.setItem("mimimilli:librarySidebarOpen", "false");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "サイドバー" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(rail(page)).toHaveCount(0);

  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();
  await page.locator(".mle-prv").getByRole("button", { name: "全画面へ展開" }).click();
  await expect(page).toHaveURL(/\/work\//);
  await expect(rail(page)).toHaveCount(0);

  await page.keyboard.press("Control+b");
  await expect(rail(page)).toBeVisible();

  await search(page).click();
  await page.keyboard.press("Control+b");
  await expect(rail(page)).toBeVisible();

  assertNoErrors(tracker);
});

test("作品詳細: サイドバーの選択中の行は元のスマートフォルダーで、押すと一覧の状態のまま戻る", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, /^お気に入り/).click();
  await expect(page).toHaveURL(/\/library\/fav/);
  await page.getByText("夜更けの図書室で囁き朗読", { exact: false }).click();
  await page.locator(".mle-prv").getByRole("button", { name: "全画面へ展開" }).click();
  await expect(page).toHaveURL(/\/work\//);

  await expect(railRow(page, /^お気に入り/)).toHaveAttribute("aria-current", "true");
  const crumbs = page.locator(".mle-crumbs");
  await expect(crumbs.getByRole("button", { name: "ライブラリ" })).toBeVisible();
  await crumbs.getByRole("button", { name: "お気に入り" }).click();
  await expect(page).toHaveURL(/\/library\/fav/);
  await expect(page.locator(".mle-prv")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/work\//);
  await railRow(page, /^お気に入り/).click();
  await expect(page).toHaveURL(/\/library\/fav/);
  await expect(page.locator(".mle-prv")).toBeVisible();

  assertNoErrors(tracker);
});

test("ファイル: トップバーのファイルボタンで全幅のカラム表示に移り、3通りの戻り方でライブラリの状態に戻る", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, /^お気に入り/).click();
  await search(page).fill("朗読");
  await expect(page).toHaveURL(/\/library\/fav\?q=/);
  const libraryUrl = page.url();

  const filesButton = page.getByRole("button", { name: "ファイル", exact: true });
  await expect(filesButton).toHaveAttribute("aria-pressed", "false");

  // ファイルボタンをもう一度押す
  await filesButton.click();
  await expect(page).toHaveURL(/\/files/);
  await expect(filesButton).toHaveAttribute("aria-pressed", "true");
  await expect(rail(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "サイドバー" })).toHaveCount(0);
  await filesButton.click();
  await expect(page).toHaveURL(libraryUrl);
  await expect(rail(page)).toBeVisible();

  // 「ライブラリへ戻る」
  await filesButton.click();
  await page.getByRole("button", { name: "ライブラリへ戻る" }).click();
  await expect(page).toHaveURL(libraryUrl);

  // ブラウザの戻る
  await filesButton.click();
  await expect(page).toHaveURL(/\/files/);
  await page.goBack();
  await expect(page).toHaveURL(libraryUrl);
  await expect(railRow(page, /^お気に入り/)).toHaveAttribute("aria-current", "true");

  assertNoErrors(tracker);
});

test("エラーの行: 件数を赤い丸で出す", async ({ page }) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const errorRow = rail(page).getByRole("button", { name: /^エラー/ });
  await expect(errorRow).toBeVisible();
  await expect(errorRow.locator(".ct")).toHaveClass(/is-error/);

  assertNoErrors(tracker);
});
