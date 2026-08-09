import { readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { Track } from "@mimimilli/shared";
import { toPortableRelativePath } from "./paths.ts";
import { naturalCompare } from "./naturalCompare.ts";
import { getCategoryLogger } from "../../lib/logger.ts";

const scanLogger = getCategoryLogger("scan");

export const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "m4a",
  "aac",
  "wav",
  "ogg",
  "flac",
  "webm",
  "opus",
]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp"]);

export function extOf(name: string): string {
  return extname(name).slice(1).toLowerCase();
}

export function findCoverImage(dir: string): string | null {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    scanLogger.warn(`ディレクトリを読めません: ${dir}`, { path: dir, error: (e as Error).message });
    return null;
  }
  const images = entries
    .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(extOf(e.name)))
    .map((e) => e.name)
    .sort(naturalCompare);
  const preferred = images.find((n) => {
    const lower = n.toLowerCase();
    return lower.includes("cover") || lower.includes("jacket");
  });
  return preferred ?? images[0] ?? null;
}

function collectAudioRecursive(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch (e) {
      scanLogger.warn(`ディレクトリを読めません: ${cur}`, {
        path: cur,
        error: (e as Error).message,
      });
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && AUDIO_EXTENSIONS.has(extOf(e.name))) out.push(full);
    }
  }
  return out;
}

/** 自動生成のトラック構築: 直下の音声を優先、無ければ最多の直下サブフォルダー */
export function buildDefaultTracks(workDir: string): Track[] {
  const entries = readdirSync(workDir, { withFileTypes: true });
  const directAudio = entries
    .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(extOf(e.name)))
    .map((e) => join(workDir, e.name));

  let files: string[];
  if (directAudio.length > 0) {
    files = directAudio;
  } else {
    const bySubdir = entries
      .filter((e) => e.isDirectory())
      .map((e) => collectAudioRecursive(join(workDir, e.name)));
    bySubdir.sort((a, b) => b.length - a.length);
    files = bySubdir[0] ?? [];
  }

  files.sort(naturalCompare);
  return files.map((f) => ({
    id: crypto.randomUUID(),
    title: basename(f, extname(f)),
    file: toPortableRelativePath(workDir, f),
  }));
}
