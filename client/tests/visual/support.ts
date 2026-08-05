import { type ConsoleMessage, type Page } from "@playwright/test";

export const FIXED_NOW = "2026-05-29T00:00:00+09:00";

/** smoke/visual 共通のアプリ起動処理。日時を固定し、アニメーション・devtoolsボタンを止める
 *  （visual側のスクリーンショット安定化が主目的だが、smoke側でも遷移待ちの揺らぎを減らせる）。 */
export async function openApp(page: Page) {
  await page.addInitScript((fixedNow) => {
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

  await page.goto("/", { waitUntil: "networkidle" });
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
}

/** コンソールエラーと 4xx/5xx レスポンスを記録する。smoke テストは末尾で
 *  assertNoErrors を呼び、実際の不具合（見た目のズレではない）だけを検知する。 */
export function trackErrors(page: Page): ErrorTracker {
  const tracker: ErrorTracker = { consoleErrors: [], failedResponses: [] };
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") tracker.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      tracker.failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return tracker;
}
