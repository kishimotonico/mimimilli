import type { Work } from "@mimimilli/shared";
import { isRootReconfiguringError } from "../../settings/apiErrorHelpers";
import type { PlayRequestGuard } from "./playRequestGuard";

export interface WorkPlaybackRequestDeps {
  guard: PlayRequestGuard;
  prepare: (workId: string) => Promise<Work>;
  updateCaches: (prepared: Work) => Promise<void>;
  onError: (err: unknown) => void;
}

/**
 * 再生準備（API・キャッシュ更新）を済ませてから start を呼ぶ。待っている間に後続の要求・停止・
 * 再生開始があった要求は start を呼ばずに捨てる。
 */
export async function requestWorkPlayback(
  deps: WorkPlaybackRequestDeps,
  work: { id: string; status: Work["status"] },
  start: (prepared: Work) => void,
): Promise<void> {
  // ファイル欠損・メタ読み込みエラーの作品は再生できない（UI側の無効化が第一線、これは防衛線）。
  if (work.status !== "ok") return;
  const token = deps.guard.next();
  try {
    const prepared = await deps.prepare(work.id);
    if (!deps.guard.isCurrent(token)) return;
    await deps.updateCaches(prepared);
    if (!deps.guard.isCurrent(token)) return;
    start(prepared);
  } catch (err) {
    if (!isRootReconfiguringError(err)) deps.onError(err);
  }
}
