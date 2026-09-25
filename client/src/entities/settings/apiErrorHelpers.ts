import { ApiRequestError } from "../../shared/api/http";

/** root再設定中であることを示す409エラーか（ADR-0029）。画面がreconfiguringへ
 *  切り替わるのが正しい応答のため、常時マウントの呼び出し元はこれを検知したら
 *  「失敗」トーストを出さない。 */
export function isRootReconfiguringError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === "root_reconfiguring";
}
