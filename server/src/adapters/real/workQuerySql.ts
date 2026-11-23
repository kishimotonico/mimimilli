import type { GroupSortId, SortId } from "@mimimilli/shared";
import { normalizeRjCode } from "../../core/worksQuery.ts";

/** SQLite の IN 句パラメータ上限を避けるため、配列を一定件数ごとに分割する */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const SQLITE_IN_CHUNK_SIZE = 900;

export function inClausePlaceholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

export function worksOrderSql(sort: Exclude<SortId, "random">): string {
  const idTieBreaker = "works.id COLLATE BINARY ASC";
  switch (sort) {
    case "title-asc":
      return `works.title_sort_key COLLATE BINARY ASC, ${idTieBreaker}`;
    case "title-desc":
      return `works.title_sort_key COLLATE BINARY DESC, ${idTieBreaker}`;
    case "added-asc":
      return `work_states.added_at ASC, ${idTieBreaker}`;
    case "added-desc":
      return `work_states.added_at DESC, ${idTieBreaker}`;
    case "duration-asc":
      return `works.total_duration_sec IS NULL ASC, works.total_duration_sec ASC, ${idTieBreaker}`;
    case "duration-desc":
      return `works.total_duration_sec IS NULL ASC, works.total_duration_sec DESC, ${idTieBreaker}`;
    case "last-played":
      return `work_states.last_played_at IS NULL ASC, work_states.last_played_at DESC, ${idTieBreaker}`;
    case "id-asc":
      return idTieBreaker;
  }
}

function rjCodeNormalizedSql(alias: string): string {
  return (
    `CASE WHEN substr(UPPER(json_extract(${alias}.state_json, '$.rjCode')), 1, 2) IN ('RJ', 'VJ') ` +
    `THEN substr(UPPER(json_extract(${alias}.state_json, '$.rjCode')), 3) ` +
    `ELSE UPPER(json_extract(${alias}.state_json, '$.rjCode')) END`
  );
}

export function textSearchCondition(
  searchKey: string,
  rawQuery: string,
): { sql: string; bindings: string[] } {
  const rjKey = normalizeRjCode(rawQuery);
  const rjCondition = rjKey
    ? ` OR EXISTS (
          SELECT 1
          FROM main.work_dlsite AS query_dlsite
          WHERE query_dlsite.work_id = works.id
            AND instr(${rjCodeNormalizedSql("query_dlsite")}, ?) > 0
        )`
    : "";
  const bindings = [searchKey, searchKey];
  if (rjKey) bindings.push(rjKey);
  return {
    sql: `(
      instr(works.title_sort_key, ?) > 0 OR EXISTS (
        SELECT 1
        FROM main.work_tags AS query_work_tags
        INNER JOIN main.tags AS query_tags ON query_tags.id = query_work_tags.tag_id
        WHERE query_work_tags.work_id = works.id
          AND instr(query_tags.search_key, ?) > 0
      )${rjCondition}
    )`,
    bindings,
  };
}

export const RESUME_RESOLVED_CASE = `
  CASE WHEN EXISTS (
    SELECT 1 FROM main.playlists AS resume_playlists
    INNER JOIN main.tracks AS resume_tracks
      ON resume_tracks.playlist_id = resume_playlists.id
    WHERE resume_playlists.work_id = works.id
      AND resume_playlists.id = work_states.resume_playlist_id
      AND resume_tracks.work_id = works.id
      AND resume_tracks.id = work_states.resume_track_id
      AND work_states.resume_offset_sec >= 0
      AND (resume_tracks.end IS NULL OR work_states.resume_offset_sec <= resume_tracks.end - COALESCE(resume_tracks.start, 0))
  ) THEN 1 ELSE 0 END AS resumeResolved`;

export const JOINED_WORKS_SELECT = `
  SELECT
    works.id,
    works.title,
    works.title_sort_key AS titleSortKey,
    works.cover_image AS coverImage,
    works.cover_width AS coverWidth,
    works.cover_height AS coverHeight,
    works.default_playlist_id AS defaultPlaylistId,
    works.created_at AS createdAt,
    works.status,
    works.physical_path AS physicalPath,
    works.meta_path AS metaPath,
    works.total_duration_sec AS totalDurationSec,
    works.track_count AS trackCount,
    works.error_message AS errorMessage,
    works.urls_json AS urlsJson,
    work_states.work_id AS workId,
    work_states.added_at AS addedAt,
    work_states.bookmarked,
    work_states.last_played_at AS lastPlayedAt,
    work_states.resume_playlist_id AS resumePlaylistId,
    work_states.resume_track_id AS resumeTrackId,
    work_states.resume_offset_sec AS resumeOffsetSec,
    ${RESUME_RESOLVED_CASE}
  FROM main.works
  INNER JOIN user.work_states ON work_states.work_id = works.id`;

export const WORKS_QUERY_FROM = `
  FROM main.works
  INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id`;

const NAME_ASC = "sortKey COLLATE BINARY ASC, value COLLATE BINARY ASC";
const NAME_DESC = "sortKey COLLATE BINARY DESC, value COLLATE BINARY DESC";

/** 値一覧の並び。同順位は読み・値の BINARY 順（降順の並びは両方を逆順）。core の GROUP_SORT_COMPARATORS と同じ */
const GROUP_VALUE_ORDER: Record<GroupSortId, string> = {
  "count-desc": `count DESC, ${NAME_ASC}`,
  "count-asc": `count ASC, ${NAME_ASC}`,
  "name-asc": NAME_ASC,
  "name-desc": NAME_DESC,
  "duration-desc": `durationSec DESC, ${NAME_ASC}`,
  "duration-asc": `durationSec ASC, ${NAME_ASC}`,
  "added-desc": `lastAddedAt COLLATE BINARY DESC, ${NAME_ASC}`,
  "last-played": `lastPlayedAt IS NULL, lastPlayedAt COLLATE BINARY DESC, ${NAME_ASC}`,
};

export function groupValueSql(baseSelect: string, groupSort: GroupSortId): string {
  return `
    WITH base AS (${baseSelect}),
    ranked_covers AS (
      SELECT value, work_id, cover_image, cover_width, cover_height,
             ROW_NUMBER() OVER (PARTITION BY value ORDER BY added_at DESC, work_id ASC) AS rn
      FROM base
      WHERE cover_image IS NOT NULL AND cover_width IS NOT NULL AND cover_height IS NOT NULL
    ),
    covers_agg AS (
      SELECT value,
             json_group_array(
               json_object(
                 'workId', work_id,
                 'image', cover_image,
                 'dimensions', json_object('width', cover_width, 'height', cover_height)
               )
               ORDER BY rn
             ) AS covers_json
      FROM ranked_covers
      WHERE rn <= 4
      GROUP BY value
    )
    SELECT
      base.value AS value,
      COUNT(*) AS count,
      COALESCE(SUM(base.duration_sec), 0) AS durationSec,
      MAX(base.added_at) AS lastAddedAt,
      MAX(base.last_played_at) AS lastPlayedAt,
      MIN(base.sort_key) AS sortKey,
      COALESCE(covers_agg.covers_json, '[]') AS coversJson
    FROM base
    LEFT JOIN covers_agg ON covers_agg.value = base.value
    GROUP BY base.value
    ORDER BY ${GROUP_VALUE_ORDER[groupSort]}
  `;
}
