import { join } from "node:path";
import {
  coverFieldsFromColumns,
  dlsiteStateSchema,
  emptyDlsiteState,
  resolveTrackDuration,
  selectDefaultPlaylist,
  toTrackDurationFields,
  workSchema,
  workSummarySchema,
} from "@mimimilli/shared";
import type {
  DlsiteState,
  ProbeDurationResult,
  ResolvedPlaylist,
  Work,
  WorkSummary,
} from "@mimimilli/shared";
import { z } from "zod";
import { works } from "./catalogSchema.ts";
import type { workStates } from "./userSchema.ts";

export type CatalogWorkRow = typeof works.$inferSelect;
export type WorkStateRow = typeof workStates.$inferSelect;
export type WorkRow = CatalogWorkRow & WorkStateRow & { resumeResolved: boolean };
export type RawWorkRow = Omit<WorkRow, "bookmarked" | "resumeResolved"> & {
  bookmarked: number;
  resumeResolved: number;
};

export type SummaryRow = Pick<
  WorkRow,
  | "id"
  | "title"
  | "coverImage"
  | "coverWidth"
  | "coverHeight"
  | "status"
  | "physicalPath"
  | "totalDurationSec"
  | "addedAt"
  | "errorMessage"
  | "urlsJson"
  | "trackCount"
  | "bookmarked"
  | "lastPlayedAt"
>;

export type RawSummaryListRow = Omit<SummaryRow, "bookmarked"> & {
  bookmarked: number;
  dlsiteStateJson: string | null;
};

export type RawWorkListRow = {
  id: string;
  title: string;
  coverImage: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  status: WorkSummary["status"];
  totalDurationSec: number | null;
  trackCount: number;
  physicalPath: string;
  bookmarked: number;
  lastPlayedAt: string | null;
  dlsiteStateJson: string | null;
};

export interface ScanWorkState {
  sourceRevision: string | null;
  projectionRevision: string | null;
  mediaRevision: string | null;
  status: Work["status"];
  physicalPath: string;
  addedAt: string;
  bookmarked: boolean;
  lastPlayedAt: string | null;
  resume: Work["resume"];
  cover: CoverColumns;
}

export interface CoverColumns {
  image: string | null;
  dimensions: { width: number; height: number } | null;
}

export interface CoverLocationRow {
  id: string;
  physicalPath: string;
  coverImage: string | null;
}

export interface MediaRootRow {
  physicalPath: string;
}

export interface AxisFacetRow {
  value: string;
  count: number;
  durationSec: number;
  coversJson: string;
}

export interface WorkDetailParts {
  row: WorkRow;
  rawPlaylists: RawPlaylistRow[];
  tagNames: string[];
  dlsite: DlsiteState;
}

export class PersistentDataError extends Error {
  constructor(table: string, recordId: string | number, detail: string) {
    super(`SQLite の ${table} レコード "${recordId}" が不正です: ${detail}`);
    this.name = "PersistentDataError";
  }
}

export interface SummaryLoadSkip {
  workId: string;
  reason: string;
}

export interface ListSummariesResult {
  summaries: WorkSummary[];
  skipped: SummaryLoadSkip[];
}

export function parseJsonField(
  raw: string,
  table: string,
  recordId: string | number,
  field: string,
): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PersistentDataError(table, recordId, `${field}: JSON パースエラー: ${message}`);
  }
}

export function parseRecord<T>(
  schema: z.ZodType<T>,
  value: unknown,
  table: string,
  recordId: string | number,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const detail = result.error.issues
    .map((issue) => `${issue.path.join(".") || "(record)"}: ${issue.message}`)
    .join("; ");
  throw new PersistentDataError(table, recordId, detail);
}

export function coverColumnsFromWork(work: Pick<Work, "cover" | "coverImage">): CoverColumns {
  return {
    image: work.coverImage,
    dimensions: work.cover?.dimensions ?? null,
  };
}

export function defaultPlaylistOf<P extends { id: string; tracks: unknown[] }>(
  row: Pick<CatalogWorkRow, "id" | "defaultPlaylistId">,
  playlists: P[],
): P | null {
  const playlist = selectDefaultPlaylist(playlists, row.defaultPlaylistId);
  if (row.defaultPlaylistId && !playlist) {
    throw new PersistentDataError(
      "works",
      row.id,
      `defaultPlaylistId: playlists に "${row.defaultPlaylistId}" がありません`,
    );
  }
  return playlist;
}

export function rowToSummary(
  row: SummaryRow,
  tagNames: string[],
  dlsite: DlsiteState,
): WorkSummary {
  return parseRecord(
    workSummarySchema,
    {
      id: row.id,
      title: row.title,
      cover: coverFieldsFromColumns(row.coverImage, row.coverWidth, row.coverHeight).cover,
      status: row.status,
      physicalPath: row.physicalPath,
      totalDurationSec: row.totalDurationSec,
      addedAt: row.addedAt,
      errorMessage: row.errorMessage,
      urls: parseJsonField(row.urlsJson, "works", row.id, "urls_json"),
      tags: tagNames,
      trackCount: row.trackCount,
      bookmarked: row.bookmarked,
      lastPlayedAt: row.lastPlayedAt,
      dlsite,
    },
    "works",
    row.id,
  );
}

export interface RawPlaylistRow {
  id: string;
  name: string;
  position: number;
  tracks: Array<{
    id: string;
    title: string;
    file: string;
    start: number | null;
    end: number | null;
    position: number;
  }>;
}

export function rowsToPlaylists(rows: RawPlaylistRow[]): ResolvedPlaylist[] {
  return rows.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    tracks: playlist.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      file: track.file,
      ...(track.start === null ? {} : { start: track.start }),
      ...(track.end === null ? {} : { end: track.end }),
      durationSec: null,
      durationKind: "unprobed",
    })),
  }));
}

export function sumDefaultPlaylistDuration(
  row: WorkRow,
  playlists: ResolvedPlaylist[],
): number | null {
  const defaultPlaylist = defaultPlaylistOf(row, playlists);
  const tracks = defaultPlaylist?.tracks ?? [];
  if (tracks.some((track) => track.durationSec === null)) return null;
  return tracks.reduce((sum, track) => sum + track.durationSec!, 0);
}

export function rowToWork(
  row: WorkRow,
  rawPlaylists: RawPlaylistRow[],
  tagNames: string[],
  dlsite: DlsiteState,
  liveFileProbes: Map<string, ProbeDurationResult>,
): Work {
  const playlists: ResolvedPlaylist[] = rowsToPlaylists(rawPlaylists).map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    tracks: playlist.tracks.map((track) => {
      const probe = liveFileProbes.get(join(row.physicalPath, track.file)) ?? { kind: "unprobed" };
      return { ...track, ...toTrackDurationFields(resolveTrackDuration(track, probe)) };
    }),
  }));
  const resume = resolveResume(row, playlists);
  const totalDurationSec = sumDefaultPlaylistDuration(row, playlists);
  const coverFields = coverFieldsFromColumns(row.coverImage, row.coverWidth, row.coverHeight);
  return parseRecord(
    workSchema,
    {
      id: row.id,
      title: row.title,
      cover: coverFields.cover,
      coverKind: coverFields.coverKind,
      coverImage: coverFields.coverImage,
      status: row.status,
      physicalPath: row.physicalPath,
      totalDurationSec,
      addedAt: row.addedAt,
      errorMessage: row.errorMessage,
      urls: parseJsonField(row.urlsJson, "works", row.id, "urls_json"),
      tags: tagNames,
      defaultPlaylistId: row.defaultPlaylistId,
      createdAt: row.createdAt,
      playlists,
      bookmarked: row.bookmarked,
      lastPlayedAt: row.lastPlayedAt,
      resume,
      dlsite,
    },
    "works",
    row.id,
  );
}

export function resolveResume(row: WorkRow, playlists: ResolvedPlaylist[]): Work["resume"] {
  const { resumePlaylistId: playlistId, resumeTrackId: trackId, resumeOffsetSec: offsetSec } = row;
  if (!row.resumeResolved || playlistId === null || trackId === null || offsetSec === null) {
    return null;
  }
  const playlist = playlists.find((candidate) => candidate.id === playlistId);
  const track = playlist?.tracks.find((candidate) => candidate.id === trackId);
  if (!track || offsetSec < 0) return null;
  if (track.durationSec !== null && offsetSec > track.durationSec) return null;
  return { playlistId, trackId, offsetSec };
}

export function parseDlsiteStateJson(workId: string, stateJson: string | null): DlsiteState {
  if (stateJson === null) return emptyDlsiteState();
  return parseRecord(
    dlsiteStateSchema,
    parseJsonField(stateJson, "work_dlsite", workId, "state_json"),
    "work_dlsite",
    workId,
  );
}

export function mapRawWorkRows(rows: RawWorkRow[]): WorkRow[] {
  return rows.map((row) => ({
    ...row,
    bookmarked: row.bookmarked !== 0,
    resumeResolved: row.resumeResolved !== 0,
  }));
}
