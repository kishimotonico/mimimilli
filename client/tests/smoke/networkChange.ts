// WSL2 のミラードネットワークでは eth0 のアドレスが付け直されることがあり、その瞬間に Chromium が
// 進行中の通信を ERR_NETWORK_CHANGED で落とす。アプリの不具合ではないので、失敗の原因として見分けられるようにする。
import type { BrowserContext, TestInfoError } from "@playwright/test";

const NETWORK_CHANGED = "ERR_NETWORK_CHANGED";

export const NETWORK_CHANGE_NOTICE =
  "[smoke環境] ホストのネットワーク変化（WSL2 の eth0 アドレスの付け直し）で Chromium が通信を落としています。この失敗はそれが原因の可能性があります。時間を置いて流し直して確かめてください（`ip -ts monitor address` で同時刻の変化を確認できます）";

export function isNetworkChangeText(text: string): boolean {
  return text.includes(NETWORK_CHANGED);
}

/** context 配下の全ページ（ポップアップを含む）の通信失敗を監視し、ERR_NETWORK_CHANGED を1度でも見たかを返す。 */
export function watchNetworkChange(context: BrowserContext): () => boolean {
  let seen = false;
  context.on("console", (message) => {
    if (isNetworkChangeText(message.text())) seen = true;
  });
  context.on("requestfailed", (request) => {
    if (isNetworkChangeText(request.failure()?.errorText ?? "")) seen = true;
  });
  return () => seen;
}

/** 失敗の詳細（reporter の失敗一覧）に注記が出るよう、エラーを1件足す。合否は変えない。 */
export function appendNetworkChangeNotice(errors: TestInfoError[]): void {
  errors.push({ message: NETWORK_CHANGE_NOTICE });
}
