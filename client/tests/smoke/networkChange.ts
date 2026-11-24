// WSL2 のミラードネットワークでは eth0 のアドレスが付け直されることがあり、その瞬間に Chromium が
// 進行中の通信を ERR_NETWORK_CHANGED で落とす。アプリの不具合ではないので、失敗の原因として見分けられるようにする。
import type { Page } from "@playwright/test";

const NETWORK_CHANGED = "ERR_NETWORK_CHANGED";

export const NETWORK_CHANGE_NOTICE =
  "[smoke環境] ホストのネットワーク変化（WSL2 の eth0 アドレスの付け直し）で Chromium が通信を落としました。アプリの不具合ではありません（`ip -ts monitor address` で同時刻の変化を確認できます）";

export function isNetworkChangeText(text: string): boolean {
  return text.includes(NETWORK_CHANGED);
}

/** page の通信失敗を監視し、ERR_NETWORK_CHANGED を1度でも見たかを返す。 */
export function watchNetworkChange(page: Page): () => boolean {
  let seen = false;
  page.on("console", (message) => {
    if (isNetworkChangeText(message.text())) seen = true;
  });
  page.on("requestfailed", (request) => {
    if (isNetworkChangeText(request.failure()?.errorText ?? "")) seen = true;
  });
  return () => seen;
}
