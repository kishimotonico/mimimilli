import {
  coverFieldsFromColumns,
  resolveWorkPlacement,
  toTrackDurationFieldsFromSec,
  workPlacementOf,
} from "@mimimilli/shared";
import type {
  ResolvedPlaylist,
  ResolvedTrack,
  ResumeBody,
  Work,
  WorkPlacement,
  WorkSummary,
} from "@mimimilli/shared";
import { SEED_TRACK_NAMES, type FixtureCoverColumns, type SeedPlaylistSpec } from "./data.ts";
import { fixtureCoverFromColumns } from "./coverDto.ts";
import type { FixtureWorkRecord } from "./data.ts";
import type { FixtureState, PlaybackIds } from "./state.ts";
import { composeWork, coverColumnsOf } from "./state.ts";

/** totalDurationSec を trackCount で等分した決定的な durationSec（端数は最終トラックに寄せる） */
function splitDurationSec(totalDurationSec: number, trackCount: number, index: number): number {
  const base = Math.floor(totalDurationSec / trackCount);
  const remainder = totalDurationSec - base * trackCount;
  return index === trackCount - 1 ? base + remainder : base;
}

/** 作品の playlist/track 数に対応する安定したIDを割り当てる（初回のみ生成しキャッシュ） */
function ensurePlaybackIds(
  summary: WorkSummary,
  specPlaylists: SeedPlaylistSpec[] | undefined,
  playbackIds: Map<string, PlaybackIds>,
): PlaybackIds {
  const cached = playbackIds.get(summary.id);
  if (cached) return cached;

  const trackCounts = specPlaylists
    ? specPlaylists.map((p) => p.tracks.length)
    : summary.trackCount > 0
      ? [summary.trackCount]
      : [];
  const ids: PlaybackIds = {
    playlists: trackCounts.map((count) => ({
      id: crypto.randomUUID(),
      trackIds: Array.from({ length: count }, () => crypto.randomUUID()),
    })),
  };
  playbackIds.set(summary.id, ids);
  return ids;
}

export function buildFullWorkFromState(state: FixtureState, record: FixtureWorkRecord): Work {
  return buildFullWork(
    composeWork(state, record),
    workPlacementOf(record.metaPath),
    state.playlistSpecs.get(record.id),
    coverColumnsOf(state, record.id),
    state.resumes,
    state.playbackIds,
  );
}

export function buildFullWork(
  summary: WorkSummary,
  placement: WorkPlacement,
  specPlaylists: SeedPlaylistSpec[] | undefined,
  coverColumns: FixtureCoverColumns,
  resumes: Map<string, ResumeBody>,
  playbackIds: Map<string, PlaybackIds>,
): Work {
  const ids = ensurePlaybackIds(summary, specPlaylists, playbackIds);
  const namedTracks = SEED_TRACK_NAMES[summary.id];

  const playlists: ResolvedPlaylist[] = specPlaylists
    ? specPlaylists.map((spec, playlistIndex) => ({
        id: ids.playlists[playlistIndex]!.id,
        name: spec.name,
        tracks: spec.tracks.map((track, trackIndex) => ({
          id: ids.playlists[playlistIndex]!.trackIds[trackIndex]!,
          title: track.title,
          file: track.file,
          start: track.start,
          end: track.end,
          ...toTrackDurationFieldsFromSec(track.durationSec),
        })),
      }))
    : ids.playlists.length > 0
      ? [
          {
            id: ids.playlists[0]!.id,
            name: "default",
            tracks: Array.from({ length: summary.trackCount }, (_, i) => {
              const durationSec =
                summary.totalDurationSec !== null && summary.totalDurationSec > 0
                  ? splitDurationSec(summary.totalDurationSec, summary.trackCount, i)
                  : null;
              return {
                id: ids.playlists[0]!.trackIds[i]!,
                title: namedTracks?.[i] ?? `Track ${i + 1}`,
                file:
                  placement.kind === "audio-file"
                    ? summary.physicalPath.slice(placement.mediaRoot.length + 1)
                    : `track${String(i + 1).padStart(2, "0")}.mp3`,
                ...toTrackDurationFieldsFromSec(durationSec),
              };
            }),
          },
        ]
      : [];

  const { trackCount: _trackCount, ...rest } = summary;
  const resume = resumes.get(summary.id);
  const coverFields = coverFieldsFromColumns(
    coverColumns.image,
    coverColumns.dimensions?.width ?? null,
    coverColumns.dimensions?.height ?? null,
  );
  const cover = fixtureCoverFromColumns(summary, coverColumns);

  return {
    ...rest,
    cover,
    coverKind: coverFields.coverKind,
    coverImage: coverFields.coverImage,
    defaultPlaylistId: playlists[0]?.id ?? null,
    createdAt: summary.addedAt,
    playlists,
    resume: resume ?? null,
  };
}

/** 作品の全playlistから file が一致する最初のトラックを探す（audio locateMedia用） */
export function findTrackByFile(work: Work, relPath: string): ResolvedTrack | undefined {
  for (const playlist of work.playlists) {
    const track = playlist.tracks.find((t) => t.file === relPath);
    if (track) return track;
  }
  return undefined;
}

/** scan・登録の境界で配置を検査する。不整合なら real と同じ文言で作品を error にする */
export function checkWorkPlacement(
  state: FixtureState,
  record: FixtureWorkRecord,
): FixtureWorkRecord {
  const resolution = resolveWorkPlacement(record.metaPath, buildFullWorkFromState(state, record));
  if (resolution.ok) return record;
  return {
    ...record,
    status: "error",
    errorMessage: resolution.message,
    physicalPath: resolution.physicalPath,
  };
}
