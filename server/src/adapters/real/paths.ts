// パス解決とトラバーサル対策。Rust 版（canonicalize + starts_with）と同水準。
// /api/fs と /api/media/* のすべての物理パス解決はここを通すこと。
import { realpathSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";

export interface PathOperations {
  isAbsolute(path: string): boolean;
  relative(from: string, to: string): string;
  sep: string;
}

const nativePathOperations: PathOperations = { isAbsolute, relative, sep };

/** target が base 自身または配下かを、パス区切り文字を含む境界で判定する。 */
export function isPathWithin(
  base: string,
  target: string,
  operations: PathOperations = nativePathOperations
): boolean {
  const rel = operations.relative(base, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${operations.sep}`) && !operations.isAbsolute(rel));
}

/** base 配下の target を API 用の `/` 区切り相対パスへ変換する。 */
export function toPortableRelativePath(base: string, target: string): string {
  if (!isPathWithin(base, target)) {
    throw new Error(`基準パス配下ではありません: ${target}`);
  }
  return relative(base, target).split(sep).join("/");
}

/**
 * realpath 解決した上で、base 配下にあることを検証する。
 * 配下でない・存在しない場合は null。
 */
export function resolveWithin(base: string, target: string): string | null {
  let realBase: string;
  let realTarget: string;
  try {
    realBase = realpathSync(base);
    realTarget = realpathSync(target);
  } catch {
    return null;
  }
  return isPathWithin(realBase, realTarget) ? realTarget : null;
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  webm: "audio/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  lrc: "text/plain; charset=utf-8",
  vtt: "text/vtt",
  srt: "text/plain; charset=utf-8",
  json: "application/json",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
};

export function mimeOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
