import type { PlaybackTrack } from "./playbackTrack";

/** engine が現在ロードしているトラック。作品のトラックか、Files のファイルかで持つ情報が違う。 */
export type LoadedTrack =
  | {
      kind: "work";
      workId: string;
      playlistId: string | null;
      trackIndex: number;
      track: PlaybackTrack;
    }
  | { kind: "file"; trackIndex: number; track: PlaybackTrack };

interface LoadableItem {
  source: { kind: "work"; work: { id: string } } | { kind: "file" };
  playlistId: string | null;
  tracks: PlaybackTrack[];
  trackIndex: number;
}

export function toLoadedTrack(
  item: LoadableItem,
  trackIndex: number = item.trackIndex,
): LoadedTrack | null {
  const track = item.tracks[trackIndex];
  if (!track) return null;
  return item.source.kind === "work"
    ? {
        kind: "work",
        workId: item.source.work.id,
        playlistId: item.playlistId,
        trackIndex,
        track,
      }
    : { kind: "file", trackIndex, track };
}

function isSameTrack(a: LoadedTrack, b: LoadedTrack): boolean {
  if (a.track.id !== b.track.id) return false;
  if (a.kind === "file" || b.kind === "file") return a.kind === b.kind;
  return a.workId === b.workId && a.playlistId === b.playlistId;
}

/** 同じ音源ファイルを指すか（トラックが違っても区間違いなら true）。 */
export function sharesAsset(a: LoadedTrack, b: LoadedTrack): boolean {
  if (a.track.file !== b.track.file) return false;
  if (a.kind === "file" || b.kind === "file") return a.kind === b.kind;
  return a.workId === b.workId;
}

/** ロード済みの音源を再ロードせず、シークだけで次のトラックへ移れるか。 */
export function reusesLoadedAsset(previous: LoadedTrack | null, next: LoadedTrack | null): boolean {
  return (
    previous !== null &&
    next !== null &&
    !isSameTrack(previous, next) &&
    sharesAsset(previous, next)
  );
}
