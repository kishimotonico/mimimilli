// 検索の保存と、再生中の層を挟んだ探索（ADR-0041・構想の2本の流れ）。
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { assertNoErrors, openApp, openNowPlayingFromBar, trackErrors } from "./support";

const rail = (page: Page) => page.locator(".mll-sidebar");
const railRow = (page: Page, name: string | RegExp) =>
  rail(page).getByRole("button", typeof name === "string" ? { name, exact: true } : { name });
const search = (page: Page) => page.getByPlaceholder(/ライブラリを検索/);
const workTitles = (page: Page) =>
  page
    .locator(".mll-results")
    .getByRole("button", { name: /を選択、Enterで再生$/ })
    .allTextContents();
const path = (page: Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
};

test("CV別で値を選んで検索し、「検索を保存」して開き直すと、同じ作品が同じ並びで見える", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  await railRow(page, "CV別").click();
  await page
    .getByRole("group", { name: "CVの値一覧" })
    .getByRole("button", { name: /^霧島レイ(?!を)/ })
    .click();
  await expect(page).toHaveURL(/\/library\/by-cv\?group=/);
  await search(page).fill("ボイス");
  await expect.poll(async () => (await workTitles(page)).length).toBe(3);
  const before = await workTitles(page);

  await page.getByRole("button", { name: "検索を保存", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "検索を保存" });
  await expect(dialog.getByLabel("名前")).toHaveValue("霧島レイ");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/library\/sf-[0-9a-f-]+$/);
  await expect(railRow(page, /^霧島レイ/)).toHaveAttribute("aria-current", "true");
  await expect.poll(() => workTitles(page)).toEqual(before);
  await expect(page.getByRole("button", { name: "検索を保存", exact: true })).toHaveCount(0);

  await railRow(page, "すべて").click();
  await railRow(page, /^霧島レイ/).click();
  await expect.poll(() => workTitles(page)).toEqual(before);

  assertNoErrors(tracker);
});

test("自作のスマートフォルダーにチップを足して上書きし、トーストの「元に戻す」で条件が戻る", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);

  const created = await page.request.post("/api/smart-folders", {
    data: {
      name: "ボイス",
      condition: { type: "and", children: [{ type: "text", q: "ボイス" }] },
      sort: null,
      groupBy: null,
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  await page.goto(`/library/${id}`);
  await expect.poll(async () => (await workTitles(page)).length).toBeGreaterThan(1);
  const original = await workTitles(page);
  await expect(page.getByRole("button", { name: /を上書き$/ })).toHaveCount(0);

  await page.getByRole("button", { name: "絞り込み", exact: true }).click();
  await page.getByRole("button", { name: "CV", exact: true }).click();
  await page.getByRole("button", { name: /^霧島レイ/ }).click();
  await expect.poll(async () => (await workTitles(page)).length).toBeLessThan(original.length);
  await expect(page.getByLabel("CVの値を検索")).toHaveCount(0);

  await page.getByRole("button", { name: "並び替え", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /^タイトル（Z→A）/ }).click();
  await expect(page.getByTitle("並び替え: タイトル（Z→A）")).toBeVisible();
  await expect.poll(async () => (await workTitles(page)).length).toBeGreaterThan(0);
  const sorted = await workTitles(page);
  await page.getByRole("button", { name: "「ボイス」を上書き" }).click();
  await expect(page.getByText("「ボイス」を上書きしました")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/library/${id}$`));
  await expect.poll(() => workTitles(page)).toEqual(sorted);
  const overwritten = (await (await page.request.get("/api/smart-folders")).json()) as {
    id: string;
    sort: string | null;
  }[];
  expect(overwritten.find((item) => item.id === id)?.sort).toBe("title-desc");

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect.poll(() => workTitles(page)).toEqual(original);
  const restored = await page.request.get("/api/smart-folders");
  const folders = (await restored.json()) as {
    id: string;
    condition: unknown;
    sort: string | null;
  }[];
  const folder = folders.find((item) => item.id === id);
  expect(folder?.condition).toEqual({
    type: "and",
    children: [{ type: "text", q: "ボイス" }],
  });
  expect(folder?.sort).toBeNull();

  assertNoErrors(tracker);
});

test("ライブラリ → 層を開く → 閉じる → 戻る で、元の画面に戻って探索を続けられる", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await page.getByText("ツンデレ後輩ちゃんの秘密のお世話ボイス", { exact: false }).click();
  await page.locator(".mle-prv").getByRole("button", { name: "最初から再生" }).click();
  await expect(page.locator(".mle-bar1")).toBeVisible();

  await railRow(page, "CV別").click();
  await page
    .getByRole("group", { name: "CVの値一覧" })
    .getByRole("button", { name: /^霧島レイ(?!を)/ })
    .click();
  const valuePath = path(page);

  await openNowPlayingFromBar(page);
  await page.getByRole("button", { name: "再生中を閉じる" }).click();
  await expect(page.locator(".mle-layer")).toHaveCount(0);
  expect(path(page)).toBe(valuePath);

  await page.goBack();
  await expect(page).toHaveURL(/\/library\/by-cv$/);
  await page
    .getByRole("group", { name: "CVの値一覧" })
    .getByRole("button", { name: /^天音かなで/ })
    .click();
  await expect(page).toHaveURL(/\/library\/by-cv\?group=/);
  expect(new URL(page.url()).searchParams.get("group")).toBe("天音かなで");

  assertNoErrors(tracker);
});

test("サイドバーを閉じたままでも「検索を保存」でダイアログが出て、開いたときに古いダイアログは出ない", async ({
  page,
}) => {
  const tracker = trackErrors(page);
  await openApp(page);
  await search(page).fill("ボイス");
  await expect.poll(async () => (await workTitles(page)).length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "サイドバー" }).click();
  await expect(rail(page)).toHaveCount(0);
  await page.getByRole("button", { name: "検索を保存", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "検索を保存" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "サイドバー" }).click();
  await expect(rail(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  assertNoErrors(tracker);
});
