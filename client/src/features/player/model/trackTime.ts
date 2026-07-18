import type { Track } from "../../../entities/work/model";

export function getTrackStart(track: Track): number {
  return track.start ?? 0;
}

/** ファイル全体の長さから、UI が扱うトラック相対の長さを求める。 */
export function getTrackDuration(track: Track, audioDuration: number): number {
  const start = getTrackStart(track);
  const absoluteEnd = track.end ?? audioDuration;
  return Math.max(0, absoluteEnd - start);
}

/** HTML Audio の絶対時刻を、UI が扱うトラック相対時刻へ変換する。 */
export function toTrackRelativeTime(
  absoluteTime: number,
  track: Track,
  trackDuration: number,
): number {
  return clamp(absoluteTime - getTrackStart(track), 0, trackDuration);
}

/** UI のトラック相対時刻を、HTML Audio が扱う絶対時刻へ変換する。 */
export function toAudioAbsoluteTime(
  relativeTime: number,
  track: Track,
  trackDuration: number,
): number {
  return getTrackStart(track) + clamp(relativeTime, 0, trackDuration);
}

export function hasReachedTrackEnd(absoluteTime: number, track: Track): boolean {
  return track.end !== undefined && absoluteTime >= track.end;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
