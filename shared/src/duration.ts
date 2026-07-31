import { z } from "zod";
import type { Track } from "./work.ts";

/** ファイル単体のプローブ結果（audio_probe_cache 境界） */
export const probeDurationKindSchema = z.enum(["resolved", "unprobed", "missing", "unsupported"]);
export type ProbeDurationKind = z.infer<typeof probeDurationKindSchema>;

/** トラック区間の解決済み再生時間（DTO・UI 境界） */
export const trackDurationKindSchema = z.enum([
  "resolved",
  "unprobed",
  "missing",
  "unsupported",
  "invalid-start",
]);
export type TrackDurationKind = z.infer<typeof trackDurationKindSchema>;

export type ProbeDurationResult =
  | { kind: "resolved"; durationSec: number }
  | { kind: "unprobed" }
  | { kind: "missing" }
  | { kind: "unsupported" };

export type TrackDurationResult =
  | { kind: "resolved"; durationSec: number }
  | { kind: "unprobed" }
  | { kind: "missing" }
  | { kind: "unsupported" }
  | { kind: "invalid-start" };

/** probe cache 行（または未登録）からプローブ結果を復元する */
export function probeResultFromCache(
  cached: { durationSec: number | null } | undefined,
): ProbeDurationResult {
  if (cached === undefined) return { kind: "unprobed" };
  if (cached.durationSec !== null) return { kind: "resolved", durationSec: cached.durationSec };
  return { kind: "unsupported" };
}

/**
 * start がファイル全体長以上か（データ不正）。fileDurationSec は解決済みの正の有限値であること。
 * end 指定の有無に関わらず、scanner・resolveTrackDuration の唯一の判定源とする。
 */
export function isInvalidTrackStart(
  track: Pick<Track, "start" | "end">,
  fileDurationSec: number,
): boolean {
  const startSec = track.start ?? 0;
  return startSec >= fileDurationSec;
}

/** トラック区間の再生時間を、プローブ結果と start/end から解決する */
export function resolveTrackDuration(
  track: Pick<Track, "start" | "end">,
  probe: ProbeDurationResult,
): TrackDurationResult {
  if (track.end !== undefined) {
    if (probe.kind === "resolved" && isInvalidTrackStart(track, probe.durationSec)) {
      return { kind: "invalid-start" };
    }
    return { kind: "resolved", durationSec: track.end - (track.start ?? 0) };
  }

  switch (probe.kind) {
    case "resolved": {
      if (isInvalidTrackStart(track, probe.durationSec)) {
        return { kind: "invalid-start" };
      }
      const durationSec = probe.durationSec - (track.start ?? 0);
      return durationSec > 0 ? { kind: "resolved", durationSec } : { kind: "invalid-start" };
    }
    case "unprobed":
      return { kind: "unprobed" };
    case "missing":
      return { kind: "missing" };
    case "unsupported":
      return { kind: "unsupported" };
  }
}

/** TrackDurationResult を DTO 用の durationSec + durationKind へ投影する */
export function toTrackDurationFields(result: TrackDurationResult): {
  durationSec: number | null;
  durationKind: TrackDurationKind;
} {
  if (result.kind === "resolved") {
    return { durationSec: result.durationSec, durationKind: "resolved" };
  }
  return { durationSec: null, durationKind: result.kind };
}

/** テスト・fixture 用。durationSec から DTO フィールドを組み立てる */
export function toTrackDurationFieldsFromSec(
  durationSec: number | null,
  failureKind: Exclude<TrackDurationKind, "resolved" | "unprobed"> = "unsupported",
): { durationSec: number | null; durationKind: TrackDurationKind } {
  if (durationSec !== null) {
    return { durationSec, durationKind: "resolved" };
  }
  return { durationSec: null, durationKind: failureKind };
}

/** 解決済み秒数のみ取り出す。それ以外は null */
export function trackDurationSecOrNull(result: TrackDurationResult): number | null {
  return result.kind === "resolved" ? result.durationSec : null;
}

/** 計測失敗（未計測を除く）かどうか */
export function isTrackDurationFailed(kind: TrackDurationKind): boolean {
  return kind === "missing" || kind === "unsupported" || kind === "invalid-start";
}
