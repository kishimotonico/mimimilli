import { expect, type ConsoleMessage, type Page, type Request } from "@playwright/test";

export const FIXED_NOW = "2026-05-29T00:00:00+09:00";

/** smoke共通のアプリ起動処理。日時を固定し、アニメーション・devtoolsボタンを止めて
 *  遷移待ちの揺らぎを減らす。 */
export async function openApp(page: Page) {
  await page.addInitScript((fixedNow) => {
    localStorage.clear();
    sessionStorage.clear();
    const fixedTime = new Date(fixedNow as string).getTime();
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args: ConstructorParameters<DateConstructor>) {
        if (args.length === 0) {
          super(fixedTime);
        } else {
          super(...args);
        }
      }
      static now() {
        return fixedTime;
      }
    }
    window.Date = FixedDate as DateConstructor;
  }, FIXED_NOW);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const bootTimeout = 20_000;
  await expect(page.locator(".mle-col.is-axis")).toBeVisible({ timeout: bootTimeout });
  await expect(
    page.locator(".mll-results .mle-col.is-results").getByRole("button").first(),
  ).toBeVisible({ timeout: bootTimeout });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      button[aria-label="Open Tanstack query devtools"] {
        display: none !important;
      }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
}

export interface ErrorTracker {
  consoleErrors: string[];
  failedResponses: string[];
  pageErrors: string[];
  failedRequests: string[];
}

/** コンソールエラー・4xx/5xxレスポンス・未捕捉例外・ネットワークリクエスト失敗を記録する。
 *  smokeテストは末尾で assertNoErrors を呼び、実際の不具合（見た目のズレではない）だけを検知する。 */
export function trackErrors(page: Page): ErrorTracker {
  const tracker: ErrorTracker = {
    consoleErrors: [],
    failedResponses: [],
    pageErrors: [],
    failedRequests: [],
  };
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") tracker.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      tracker.failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    tracker.pageErrors.push(error.message);
  });
  page.on("requestfailed", (request: Request) => {
    const errorText = request.failure()?.errorText ?? "";
    // ERR_ABORTED はナビゲーションやTanStack Queryの再フェッチで前のリクエストを
    // 意図的に中断したときにも発生する正常な挙動。実際のネットワーク障害のみを拾う。
    if (errorText === "net::ERR_ABORTED") return;
    tracker.failedRequests.push(`${request.method()} ${request.url()} ${errorText}`);
  });
  return tracker;
}

/** trackErrors で集めた4種の異常がいずれも空であることを確認する。 */
export function assertNoErrors(tracker: ErrorTracker) {
  expect(tracker.consoleErrors).toEqual([]);
  expect(tracker.failedResponses).toEqual([]);
  expect(tracker.pageErrors).toEqual([]);
  expect(tracker.failedRequests).toEqual([]);
}

/** 主要画面でヨコ方向スクロールが発生していないことを確認する（レイアウト全損ガード）。 */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(overflowing, "横方向スクロールが発生している").toBe(false);
}
