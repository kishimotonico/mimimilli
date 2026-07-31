import type { ResolvedTrack, TrackDurationKind } from "@mimimilli/shared";
import { isTrackDurationFailed } from "@mimimilli/shared";
import { formatDuration } from "./format";

/** トラックの durationKind に応じた表示文字列（0:00 は使わない） */
export function formatTrackDuration(
  track: Pick<ResolvedTrack, "durationSec" | "durationKind">,
): string {
  if (track.durationKind === "resolved" && track.durationSec !== null) {
    return formatDuration(track.durationSec) ?? "--:--";
  }
  if (track.durationKind === "unprobed") return "--:--";
  if (isTrackDurationFailed(track.durationKind)) return "—";
  return "--:--";
}

/** durationKind の人間向けラベル（aria-label 等） */
export function trackDurationAriaLabel(kind: TrackDurationKind): string {
  switch (kind) {
    case "resolved":
      return "再生時間";
    case "unprobed":
      return "再生時間未計測";
    case "missing":
      return "再生時間計測失敗（ファイル欠損）";
    case "unsupported":
      return "再生時間計測失敗（非対応または解析失敗）";
    case "invalid-start":
      return "再生時間計測失敗（開始位置不正）";
  }
}
