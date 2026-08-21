import type { ResolvedTrack } from "../../../entities/work/model";
import { resolveTrackDurationSec } from "@mimimilli/shared";
import { clamp } from "../../../shared/lib/clamp";
import type { PlaybackTrack } from "../../../entities/player/model/playbackTrack";

export type { PlaybackTrack } from "../../../entities/player/model/playbackTrack";

/** durationSec を持つ ResolvedTrack（登録トラック）かどうかを判定する。 */
export function isResolvedTrack(track: PlaybackTrack): track is ResolvedTrack {
  return "durationSec" in track;
}

export function getTrackStart(track: PlaybackTrack): number {
  return track.start ?? 0;
}

/**
 * トラックの再生時間（秒）。登録トラックは DTO の durationSec をそのまま使う。
 * Files モードの即席トラックは start/end なしのため、durationchange で得たファイル全体長
 * （filesModeFileDurationSec、未取得なら null）から解決する。未知は null。
 */
export function getTrackDurationSec(
  track: PlaybackTrack,
  filesModeFileDurationSec: number | null,
): number | null {
  if (isResolvedTrack(track)) return track.durationSec;
  const probe =
    filesModeFileDurationSec === null
      ? ({ kind: "unprobed" } as const)
      : { kind: "resolved" as const, durationSec: filesModeFileDurationSec };
  return resolveTrackDurationSec(track, probe);
}

/** HTML Audio の絶対時刻を、UI が扱うトラック相対時刻へ変換する。trackDurationSec が null なら上限クランプなし。 */
export function toTrackRelativeTime(
  absoluteTime: number,
  track: PlaybackTrack,
  trackDurationSec: number | null,
): number {
  return clamp(
    absoluteTime - getTrackStart(track),
    0,
    trackDurationSec ?? Number.POSITIVE_INFINITY,
  );
}

/** UI のトラック相対時刻を、HTML Audio が扱う絶対時刻へ変換する。trackDurationSec が null なら上限クランプなし。 */
export function toAudioAbsoluteTime(
  relativeTime: number,
  track: PlaybackTrack,
  trackDurationSec: number | null,
): number {
  return (
    getTrackStart(track) + clamp(relativeTime, 0, trackDurationSec ?? Number.POSITIVE_INFINITY)
  );
}

export function hasReachedTrackEnd(absoluteTime: number, track: PlaybackTrack): boolean {
  return track.end !== undefined && absoluteTime >= track.end;
}
