import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MetaFile } from "@mimimilli/shared";

const PROJECTION_PARSER_VERSION = 1;

interface MediaEntry {
  relativePath: string;
  exists: boolean;
  size: number | null;
  mtimeMs: number | null;
}

function revision(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function mediaEntry(workDir: string, relativePath: string): MediaEntry {
  try {
    const stat = statSync(join(workDir, relativePath));
    return { relativePath, exists: true, size: stat.size, mtimeMs: Math.floor(stat.mtimeMs) };
  } catch {
    return { relativePath, exists: false, size: null, mtimeMs: null };
  }
}

/** mimimilli.jsonのexact bytes。外部編集とのCASとpublish直前の再検証に使う。 */
export function computeSourceRevision(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** formatと検証済みの投影入力。物理locationは含めない。 */
export function computeProjectionRevision(meta: MetaFile): string {
  return revision({
    parserVersion: PROJECTION_PARSER_VERSION,
    formatVersion: meta.formatVersion,
    id: meta.id,
    title: meta.title,
    tags: meta.tags,
    playlists: meta.playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      tracks: playlist.tracks.map((track) => ({
        id: track.id,
        title: track.title,
        file: track.file,
        start: track.start,
        end: track.end,
      })),
    })),
    defaultPlaylistId: meta.defaultPlaylistId,
    urls: meta.urls,
    coverImage: meta.coverImage,
    createdAt: meta.createdAt,
    dlsite: { rjCode: meta.dlsite.rjCode, appliedTags: meta.dlsite.appliedTags },
  });
}

/** 全Playlistの音声とcoverの相対パス・存在・size・mtime。 */
export function computeMediaRevision(metaPath: string, meta: MetaFile): string {
  const workDir = dirname(metaPath);
  const entries = meta.playlists.flatMap((playlist) =>
    playlist.tracks.map((track) => mediaEntry(workDir, track.file)),
  );
  if (meta.coverImage) entries.push(mediaEntry(workDir, meta.coverImage));
  return revision(entries);
}

export interface WorkRevisions {
  sourceRevision: string;
  projectionRevision: string;
  mediaRevision: string;
}

export function computeWorkRevisions(
  metaPath: string,
  meta: MetaFile,
  bytes: Buffer,
): WorkRevisions {
  return {
    sourceRevision: computeSourceRevision(bytes),
    projectionRevision: computeProjectionRevision(meta),
    mediaRevision: computeMediaRevision(metaPath, meta),
  };
}
