import { coverFieldsFromColumns, toTrackDurationFieldsFromSec } from "@mimimilli/shared";
import type {
  FileEntry,
  ResolvedPlaylist,
  ResolvedTrack,
  ResumeBody,
  Work,
  WorkSummary,
} from "@mimimilli/shared";
import {
  buildWorkFileTree,
  SEED_PLAYLIST_SPECS,
  SEED_TRACK_NAMES,
  type FixtureCoverColumns,
  type FsNode,
} from "./data.ts";
import { fixtureCoverFromColumns } from "./coverDto.ts";
import type { FixtureState, PlaybackIds } from "./state.ts";
import { coverColumnsOf } from "./state.ts";

/** totalDurationSec を trackCount で等分した決定的な durationSec（端数は最終トラックに寄せる） */
function splitDurationSec(totalDurationSec: number, trackCount: number, index: number): number {
  const base = Math.floor(totalDurationSec / trackCount);
  const remainder = totalDurationSec - base * trackCount;
  return index === trackCount - 1 ? base + remainder : base;
}

/** 作品の playlist/track 数に対応する安定したIDを割り当てる（初回のみ生成しキャッシュ） */
function ensurePlaybackIds(
  summary: WorkSummary,
  playbackIds: Map<string, PlaybackIds>,
): PlaybackIds {
  const cached = playbackIds.get(summary.id);
  if (cached) return cached;

  const specPlaylists = SEED_PLAYLIST_SPECS[summary.id];
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

export function buildFullWorkFromState(state: FixtureState, work: WorkSummary): Work {
  return buildFullWork(work, coverColumnsOf(state, work.id), state.resumes, state.playbackIds);
}

export function buildFullWork(
  summary: WorkSummary,
  coverColumns: FixtureCoverColumns,
  resumes: Map<string, ResumeBody>,
  playbackIds: Map<string, PlaybackIds>,
): Work {
  const ids = ensurePlaybackIds(summary, playbackIds);
  const specPlaylists = SEED_PLAYLIST_SPECS[summary.id];
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
                file: `track${String(i + 1).padStart(2, "0")}.mp3`,
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
    sourceRevision: "fixture",
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

/** 作品の FileEntry ツリー（ルートは作品フォルダー自体。path は相対パスで `""` がルート直下を示す） */
export function buildWorkFileEntryTree(
  work: WorkSummary,
  coverColumns: FixtureCoverColumns,
): FileEntry {
  const children = buildWorkFileTree(work, coverColumns.image);

  function convert(nodes: FsNode[], basePath: string): FileEntry[] {
    return nodes.map((n): FileEntry => {
      const path = basePath ? `${basePath}/${n.name}` : n.name;
      return {
        name: n.name,
        path,
        isDir: n.isDir,
        size: n.size,
        fileType: n.fileType,
        children: n.isDir ? convert(n.children, path) : [],
      };
    });
  }

  return {
    name: work.id,
    path: "",
    isDir: true,
    size: 0,
    fileType: "dir",
    children: convert(children, ""),
  };
}
