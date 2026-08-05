// work ドメインのスキーマ。client/src/entities/work/model.ts の型を契約として固定したもの。
import { z } from "zod";
import { coverKindSchema, coverSchema } from "./cover.ts";
import { dlsiteStateSchema } from "./dlsite.ts";
import { trackDurationKindSchema } from "./duration.ts";
import {
  isInvalidTrackStart,
  resolveTrackDuration,
  trackDurationSecOrNull,
  type ProbeDurationResult,
} from "./duration.ts";
import { compareUtf8Bytes } from "./text.ts";

export const urlEntrySchema = z.object({
  label: z.string(),
  url: z.string(),
});
export type UrlEntry = z.infer<typeof urlEntrySchema>;

/** トラック = 「指定ファイルの指定区間を再生する」。start/end 省略時はファイル全体 */
const uuidV4Schema = z.uuid({ version: "v4" });

/** start/endはファイル内の絶対時刻（秒）。トラックの正本表現で、mimimilli.json にもこの形で保存する */
const trackBaseSchema = z.object({
  id: uuidV4Schema,
  title: z.string(),
  file: z.string(),
  start: z.number().nonnegative().optional(),
  end: z.number().nonnegative().optional(),
});

function refineTrackEndAfterStart(
  track: { start?: number; end?: number },
  ctx: z.RefinementCtx,
): void {
  if (track.end !== undefined && track.end <= (track.start ?? 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["end"],
      message: "endはstartより大きい値である必要があります",
    });
  }
}

export const trackSchema = trackBaseSchema.superRefine(refineTrackEndAfterStart);
export type Track = z.infer<typeof trackSchema>;

export const playlistSchema = z.object({
  id: uuidV4Schema,
  name: z.string().min(1),
  tracks: z.array(trackSchema),
});
export type Playlist = z.infer<typeof playlistSchema>;

/**
 * API DTO 用の解決済みトラック。durationSec はトラック区間の相対長（秒）で、
 * end 省略時はファイル全体長から解決する。durationKind が resolved 以外のときは
 * durationSec は null（0 で埋めない）。UI は durationKind で未計測と計測失敗を区別する。
 */
export const resolvedTrackSchema = trackBaseSchema
  .extend({
    durationSec: z.number().finite().positive().nullable(),
    durationKind: trackDurationKindSchema,
  })
  .superRefine((track, ctx) => {
    refineTrackEndAfterStart(track, ctx);
    if (track.durationKind === "resolved") {
      if (track.durationSec === null) {
        ctx.addIssue({
          code: "custom",
          path: ["durationSec"],
          message: "durationKind が resolved のとき durationSec は必須です",
        });
      }
    } else if (track.durationSec !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["durationSec"],
        message: "durationKind が resolved 以外のとき durationSec は null である必要があります",
      });
    }
  });
export type ResolvedTrack = z.infer<typeof resolvedTrackSchema>;

export const resolvedPlaylistSchema = z.object({
  id: uuidV4Schema,
  name: z.string().min(1),
  tracks: z.array(resolvedTrackSchema),
});
export type ResolvedPlaylist = z.infer<typeof resolvedPlaylistSchema>;

/**
 * トラックの解決済み再生時間（秒）を求める共通式。start/end は絶対ファイル時刻、
 * 戻り値は相対長。probe はファイル全体長のプローブ結果。
 * 解決不能の場合は null（0/負の値をDTOへ流さない）。
 * 不正 start の判定は isInvalidTrackStart に集約する。
 */
export function resolveTrackDurationSec(
  track: Pick<Track, "start" | "end">,
  probe: ProbeDurationResult,
): number | null {
  return trackDurationSecOrNull(resolveTrackDuration(track, probe));
}

export { isInvalidTrackStart, resolveTrackDuration };

/** 作品の再開位置。offsetSec はトラック区間先頭からの相対秒。 */
export const resumeSchema = z.object({
  playlistId: uuidV4Schema,
  trackId: uuidV4Schema,
  offsetSec: z.number().nonnegative(),
});
export type Resume = z.infer<typeof resumeSchema>;

export const workStatusSchema = z.enum(["ok", "missing", "error"]);
export type WorkStatus = z.infer<typeof workStatusSchema>;

export type { Cover } from "./cover.ts";

export const workSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  cover: coverSchema,
  status: workStatusSchema,
  physicalPath: z.string(),
  /** デフォルトプレイリストの合計再生時間（秒）。未解決トラックを1件でも含む場合はnull（未知）。 */
  totalDurationSec: z.number().nullable(),
  addedAt: z.string(),
  errorMessage: z.string().nullable(),
  urls: z.array(urlEntrySchema),
  tags: z.array(z.string()),
  trackCount: z.number().int().nonnegative(),
  bookmarked: z.boolean(),
  lastPlayedAt: z.string().nullable(),
  dlsite: dlsiteStateSchema,
});
export type WorkSummary = z.infer<typeof workSummarySchema>;

/** 一覧表示専用の軽量な作品DTO。検索・詳細編集で必要な情報は含めない。 */
export const workListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  cover: coverSchema,
  status: workStatusSchema,
  totalDurationSec: z.number().nullable(),
  trackCount: z.number().int().nonnegative(),
  bookmarked: z.boolean(),
  lastPlayedAt: z.string().nullable(),
  circleName: z.string().nullable(),
});
export type WorkListItem = z.infer<typeof workListItemSchema>;

const CIRCLE_TAG_PREFIXES = ["サークル/", "circle/"];

/**
 * タグ群から代表サークル名を選ぶ。
 * サークルタグが複数ある場合は compareUtf8Bytes 昇順で先頭を採用する（正の挙動）。
 * サークルタグが無ければ null。
 */
export function extractCircleName(tags: string[]): string | null {
  const circleTag = tags
    .filter((tag) => CIRCLE_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix)))
    .sort(compareUtf8Bytes)[0];
  return circleTag ? circleTag.slice(circleTag.indexOf("/") + 1) : null;
}

/** WorkSummary を一覧用の公開契約へ投影する。 */
export function toWorkListItem(work: WorkSummary): WorkListItem {
  return {
    id: work.id,
    title: work.title,
    cover: work.cover,
    status: work.status,
    totalDurationSec: work.totalDurationSec,
    trackCount: work.trackCount,
    bookmarked: work.bookmarked,
    lastPlayedAt: work.lastPlayedAt,
    circleName: extractCircleName(work.tags),
  };
}

export function refinePlaylistCollection(
  playlists: Array<Pick<Playlist, "id"> & { tracks: Array<Pick<Track, "id">> }>,
  defaultPlaylistId: string | null,
  ctx: z.RefinementCtx,
): void {
  const playlistIds = new Set<string>();
  const trackIds = new Set<string>();
  for (let playlistIndex = 0; playlistIndex < playlists.length; playlistIndex++) {
    const playlist = playlists[playlistIndex]!;
    if (playlistIds.has(playlist.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["playlists", playlistIndex, "id"],
        message: `プレイリストIDが重複しています: ${playlist.id}`,
      });
    }
    playlistIds.add(playlist.id);
    for (let trackIndex = 0; trackIndex < playlist.tracks.length; trackIndex++) {
      const track = playlist.tracks[trackIndex]!;
      if (trackIds.has(track.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["playlists", playlistIndex, "tracks", trackIndex, "id"],
          message: `トラックIDが重複しています: ${track.id}`,
        });
      }
      trackIds.add(track.id);
    }
  }
  if (defaultPlaylistId !== null && !playlistIds.has(defaultPlaylistId)) {
    ctx.addIssue({
      code: "custom",
      path: ["defaultPlaylistId"],
      message: `指定されたプレイリストIDが存在しません: ${defaultPlaylistId}`,
    });
  }
}

export function refineWorkCoverFields(
  work: Pick<Work, "cover" | "coverKind" | "coverImage">,
  ctx: z.RefinementCtx,
): void {
  switch (work.coverKind) {
    case "none":
      if (work.cover !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["cover"],
          message: "coverKind が none のとき cover は null である必要があります",
        });
      }
      if (work.coverImage !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["coverImage"],
          message: "coverKind が none のとき coverImage は null である必要があります",
        });
      }
      break;
    case "unmeasured":
      if (work.cover !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["cover"],
          message: "coverKind が unmeasured のとき cover は null である必要があります",
        });
      }
      if (work.coverImage === null) {
        ctx.addIssue({
          code: "custom",
          path: ["coverImage"],
          message: "coverKind が unmeasured のとき coverImage は必須です",
        });
      }
      break;
    case "measured":
      if (work.cover === null) {
        ctx.addIssue({
          code: "custom",
          path: ["cover"],
          message: "coverKind が measured のとき cover は必須です",
        });
      } else if (work.coverImage !== work.cover.image) {
        ctx.addIssue({
          code: "custom",
          path: ["coverImage"],
          message:
            "coverKind が measured のとき coverImage は cover.image と一致する必要があります",
        });
      }
      break;
  }
}

export const workSchema = workSummarySchema
  .omit({ trackCount: true })
  .extend({
    coverKind: coverKindSchema,
    coverImage: z.string().nullable(),
    defaultPlaylistId: uuidV4Schema.nullable(),
    createdAt: z.string().nullable(),
    playlists: z.array(resolvedPlaylistSchema),
    resume: resumeSchema.nullable(),
  })
  .superRefine((work, ctx) => {
    refinePlaylistCollection(work.playlists, work.defaultPlaylistId, ctx);
    refineWorkCoverFields(work, ctx);
  });
export type Work = z.infer<typeof workSchema>;

/** 詳細作品から一覧と同じデフォルトプレイリスト基準のトラック数を求める。 */
export function getDefaultPlaylistTrackCount(
  work: Pick<Work, "playlists" | "defaultPlaylistId">,
): number {
  const playlist =
    work.playlists.find((candidate) => candidate.id === work.defaultPlaylistId) ??
    work.playlists[0];
  return playlist?.tracks.length ?? 0;
}

/** 作品配下の物理ファイルツリー（GET /api/works/:id/files） */
export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  fileType: string;
  children: FileEntry[];
}

export const fileEntrySchema: z.ZodType<FileEntry> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    isDir: z.boolean(),
    size: z.number(),
    fileType: z.string(),
    children: z.array(fileEntrySchema),
  }),
);

// ── タグ解析 ──────────────────────────────────────────────────

export interface ParsedTag {
  kind: "annotated" | "flat";
  prefix: string;
  value: string;
  raw: string;
}

/** タグ文字列（"cv/水瀬なずな", "サークル/夜想曲", "バイノーラル" など）を解析する。
 *  最初のスラッシュでのみ分割する（値にスラッシュが含まれてもよい） */
export function parseTag(tag: string): ParsedTag {
  const idx = tag.indexOf("/");
  if (idx > 0) {
    return {
      kind: "annotated",
      prefix: tag.slice(0, idx).toLowerCase(),
      value: tag.slice(idx + 1),
      raw: tag,
    };
  }
  return { kind: "flat", prefix: "", value: tag, raw: tag };
}

/** タグを正規形へ寄せる（ADR-0005 決定5）。
 *  Annotated: prefix を trim + 小文字化、値を trim。フラット: 全体を trim。
 *  Annotated の prefix または値が空なら空文字列。値の大文字小文字は保持する */
export function normalizeTag(tag: string): string {
  const idx = tag.indexOf("/");
  if (idx > 0) {
    const prefix = tag.slice(0, idx).trim().toLowerCase();
    const value = tag.slice(idx + 1).trim();
    if (!prefix || !value) return "";
    return `${prefix}/${value}`;
  }
  return tag.trim();
}

/** 正規化しつつ空タグと重複を除く（順序は保持）。タグ書き込み経路の共通入口 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/** タグの同一性判定（prefix は大文字小文字を無視、値は区別） */
export function tagEquals(a: string, b: string): boolean {
  return normalizeTag(a) === normalizeTag(b);
}

/** 組み込み軸の擬似タグ専用の予約文字（ADR-0012 §2）。実タグでの使用は禁止する */
export const RESERVED_TAG_PREFIX = "@";

/** 実タグの書き込み検証。判定はすべて normalizeTag した後の値に対して行う（生文字列のままだと、
 *  先頭に空白を挟んだ "  @year/2024" が検証をすり抜けて normalizeTags 後に予約プレフィックスへ
 *  化ける）。
 *  - 正規化後に空になるタグ（空文字・prefix/値のどちらかが空白のみ）は拒否する。normalizeTags は
 *    このスキーマを通らない直接呼び出し向けの防御的なフィルタとして空タグを黙って除くが、
 *    書き込み経路の入口はここで弾き、隠蔽しない
 *  - 先頭の "@" は組み込み軸の擬似タグ（例: "@year/2024"）と衝突するため拒否する */
export const tagSchema = z
  .string()
  .refine((tag) => normalizeTag(tag).length > 0, {
    message: "空になるタグは登録できません",
  })
  .refine((tag) => !normalizeTag(tag).startsWith(RESERVED_TAG_PREFIX), {
    message: `タグを予約文字 "${RESERVED_TAG_PREFIX}" から始めることはできません`,
  });
