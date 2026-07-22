// 増分スキャンの変更検知用 fingerprint（TASK-75）。
//
// fingerprint は以下を JSON 文字列化して SHA-256 ハッシュ（hex 先頭16文字）にする:
//   (a) メタ内容ハッシュ: title/tags/playlists/urls/coverImage/dlsite の正規形。
//       createdAt や dlsite.lastAttemptAt など機械的に変動しうるフィールドは除外する。
//   (b) デフォルトプレイリストの各トラックの size + mtimeMs + relativePath
//       （statSync で取得。duration 値そのものは不要）
//   (c) カバー画像の size + mtimeMs + relativePath
//   (d) 作品ルートディレクトリの絶対パス（ディレクトリ移動検知用）
//
// 意図:
//   - メタ内容と音声ファイルの実体が完全に未変更なら次回スキャンをスキップする。
//   - 音声ファイルが削除・mtime/size変更されると (b) が変化するため再処理され、
//     status/error 更新や duration 再計算が行われる。
//   - 作品ディレクトリが移動されると (d) が変化するため再処理され、physicalPath が更新される。
//   - トラック ID やプレイリスト ID の付け替え（外部編集・移行等）も (a) に反映される。
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MetaFile, Playlist } from "@mimimilli/shared";

interface FileStat {
  size: number;
  mtimeMs: number;
  relativePath: string;
}

interface FingerprintParts {
  metaContent: unknown;
  trackStats: FileStat[];
  coverStats: FileStat | null;
  physicalPath: string;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

/** メタ内容のうち、変更検知に用いる正規形。機械的に変動しうるフィールドは除外する。 */
function normalizeMetaContent(meta: MetaFile): unknown {
  return {
    title: meta.title,
    tags: meta.tags,
    playlists: meta.playlists,
    defaultPlaylistId: meta.defaultPlaylistId,
    urls: meta.urls,
    coverImage: meta.coverImage,
    dlsite: {
      rjCode: meta.dlsite.rjCode,
      status: meta.dlsite.status,
      error: meta.dlsite.error,
      appliedTags: meta.dlsite.appliedTags,
    },
  };
}

/**
 * 検証前の生JSONを、検証成功時のMetaFileと同じfingerprint入力へ寄せる。
 * ここではスキーマの妥当性を判定しない。fingerprintが既存値と一致しない場合だけ
 * readMetaFile による完全検証へ進む。
 */
function normalizeRawMetaContent(raw: JsonObject): unknown {
  const dlsite = raw.dlsite === undefined ? undefined : asObject(raw.dlsite);
  return {
    title: raw.title,
    tags: raw.tags === undefined ? [] : raw.tags,
    playlists:
      raw.playlists === undefined
        ? []
        : Array.isArray(raw.playlists)
          ? raw.playlists.map(normalizeRawPlaylist)
          : raw.playlists,
    defaultPlaylistId: raw.defaultPlaylistId === undefined ? null : raw.defaultPlaylistId,
    urls:
      raw.urls === undefined
        ? []
        : Array.isArray(raw.urls)
          ? raw.urls.map(normalizeRawUrlEntry)
          : raw.urls,
    coverImage: raw.coverImage ?? null,
    dlsite:
      dlsite === undefined
        ? {
            rjCode: null,
            status: "none",
            error: null,
            appliedTags: [],
          }
        : dlsite
          ? {
              rjCode: dlsite.rjCode,
              status: dlsite.status,
              error: dlsite.error,
              appliedTags: dlsite.appliedTags,
            }
          : {
              invalid: raw.dlsite,
            },
  };
}

/** z.object() が保存時に落とす未知キーを、生JSON側でもfingerprintから除外する。 */
function normalizeRawPlaylist(value: unknown): unknown {
  const playlist = asObject(value);
  if (!playlist) return value;
  return {
    id: playlist.id,
    name: playlist.name,
    tracks: Array.isArray(playlist.tracks)
      ? playlist.tracks.map(normalizeRawTrack)
      : playlist.tracks,
  };
}

function normalizeRawTrack(value: unknown): unknown {
  const track = asObject(value);
  if (!track) return value;
  return {
    id: track.id,
    title: track.title,
    file: track.file,
    start: track.start,
    end: track.end,
  };
}

function normalizeRawUrlEntry(value: unknown): unknown {
  const entry = asObject(value);
  if (!entry) return value;
  return { label: entry.label, url: entry.url };
}

function statOrNull(workDir: string, relativePath: string | null | undefined): FileStat | null {
  if (!relativePath) return null;
  try {
    const stat = statSync(join(workDir, relativePath));
    return {
      size: stat.size,
      mtimeMs: Math.floor(stat.mtimeMs),
      relativePath,
    };
  } catch {
    return null;
  }
}

/** メタファイルからデフォルトプレイリストを選ぶ（scanner の defaultPlaylistOf と同じロジック） */
function defaultPlaylistOf(meta: MetaFile): Playlist | null {
  if (meta.playlists.length === 0) return null;
  if (meta.defaultPlaylistId) {
    return meta.playlists.find((p) => p.id === meta.defaultPlaylistId) ?? null;
  }
  return meta.playlists[0]!;
}

function rawDefaultPlaylistOf(raw: JsonObject): JsonObject | null {
  const playlists = Array.isArray(raw.playlists) ? raw.playlists.map(asObject) : [];
  const validPlaylists = playlists.filter((playlist): playlist is JsonObject => playlist !== null);
  if (validPlaylists.length === 0) return null;
  if (typeof raw.defaultPlaylistId === "string") {
    return validPlaylists.find((playlist) => playlist.id === raw.defaultPlaylistId) ?? null;
  }
  return validPlaylists[0]!;
}

function rawTrackFiles(raw: JsonObject): string[] {
  const playlist = rawDefaultPlaylistOf(raw);
  if (!playlist || !Array.isArray(playlist.tracks)) return [];
  return playlist.tracks.flatMap((track) => {
    const value = asObject(track)?.file;
    return typeof value === "string" ? [value] : [];
  });
}

function fingerprintFromParts(parts: FingerprintParts): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

function fileStats(workDir: string, paths: string[]): FileStat[] {
  return paths.map(
    (relativePath) =>
      statOrNull(workDir, relativePath) ?? {
        size: -1,
        mtimeMs: -1,
        relativePath,
      },
  );
}

/** メタファイルの変更検知 fingerprint を計算する */
export function computeFingerprint(metaPath: string, meta: MetaFile): string {
  const workDir = dirname(metaPath);
  const playlist = defaultPlaylistOf(meta);
  return fingerprintFromParts({
    metaContent: normalizeMetaContent(meta),
    trackStats: fileStats(
      workDir,
      (playlist?.tracks ?? []).map((track) => track.file),
    ),
    coverStats: statOrNull(workDir, meta.coverImage),
    physicalPath: workDir,
  });
}

/**
 * 生JSONからfingerprintを求める。idが文字列でないメタは既存作品との照合ができないためnull。
 * null以外なら、値が既存fingerprintと一致した場合に限り完全なZod検証を省略できる。
 */
export function computeRawFingerprint(
  metaPath: string,
  value: unknown,
): {
  id: string;
  fingerprint: string;
} | null {
  const raw = asObject(value);
  if (!raw || typeof raw.id !== "string") return null;
  const workDir = dirname(metaPath);
  const coverImage = typeof raw.coverImage === "string" ? raw.coverImage : null;
  return {
    id: raw.id,
    fingerprint: fingerprintFromParts({
      metaContent: normalizeRawMetaContent(raw),
      trackStats: fileStats(workDir, rawTrackFiles(raw)),
      coverStats: statOrNull(workDir, coverImage),
      physicalPath: workDir,
    }),
  };
}
