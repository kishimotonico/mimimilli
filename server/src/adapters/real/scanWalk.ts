import { readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { isMetaFileName } from "./meta.ts";
import { isMetaStagingFileName } from "./metaStaging.ts";
import { isPathWithin } from "../../lib/path.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { AUDIO_EXTENSIONS, extOf } from "./scanAudio.ts";
import { naturalCompare } from "./naturalCompare.ts";

const scanLogger = getCategoryLogger("scan");

/** walk 時に収集するディレクトリの直下情報（findWorkRoot の readdirSync 代替） */
export interface DirEntryInfo {
  subdirCount: number;
  hasImage: boolean;
  childDirectories: string[];
}

export interface WalkResult {
  metaPaths: string[];
  stagedMetaPaths: string[];
  /** メタファイル（いずれかの形式）が直接存在するディレクトリ */
  metaDirs: Set<string>;
  /** 音声ファイルが直接存在するディレクトリ */
  audioDirs: Set<string>;
  /** 音声を直下に持つディレクトリごとの拡張子内訳 */
  audioBreakdownByDir: Map<string, Map<string, number>>;
  /** readdir に失敗したサブツリーのディレクトリパス（ルート失敗は例外） */
  unreadablePaths: string[];
  /** 走査済みディレクトリの直下サブフォルダー数・画像有無 */
  dirIndex: Map<string, DirEntryInfo>;
  /** 自身または配下にメタディレクトリがあるパス（findWorkRoot の swallowsMeta 判定用） */
  dirsWithMetaInSubtree: Set<string>;
}

/** ルートフォルダーの readdir 失敗。スキャン全体をエラー終了させ missing 更新を防ぐ。 */
export class ScanRootUnreadableError extends Error {
  constructor(root: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`ルートフォルダーを読み取れません: ${root}: ${detail}`);
    this.name = "ScanRootUnreadableError";
  }
}

const WALK_PROGRESS_INTERVAL = 50;

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp"]);

export class ScanCancelledError extends Error {
  constructor() {
    super("スキャンはキャンセルされました");
  }
}

export function throwIfAborted(signal?: AbortSignal, abortToken?: Int32Array): void {
  if (signal?.aborted || (abortToken && Atomics.load(abortToken, 0) !== 0))
    throw new ScanCancelledError();
}

export interface ScannerAbortHooks {
  abortToken?: Int32Array;
  beforeFinalize?: () => void;
}

/**
 * ディレクトリ木を非同期に走査する。fs/promises の readdir は都度 I/O を挟むため、
 * 大規模ライブラリでも SSE 接続や heartbeat の処理がイベントループに割り込める。
 */
export async function walk(
  root: string,
  onDirVisited?: (visited: number) => void,
  signal?: AbortSignal,
  abortToken?: Int32Array,
): Promise<WalkResult> {
  const result: WalkResult = {
    metaPaths: [],
    stagedMetaPaths: [],
    metaDirs: new Set(),
    audioDirs: new Set(),
    audioBreakdownByDir: new Map(),
    unreadablePaths: [],
    dirIndex: new Map(),
    dirsWithMetaInSubtree: new Set(),
  };
  const stack = [root];
  let visited = 0;
  while (stack.length > 0) {
    throwIfAborted(signal, abortToken);
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (dir === root) throw new ScanRootUnreadableError(root, e);
      scanLogger.warn(`ディレクトリを読めません: ${dir}`, {
        path: dir,
        error: (e as Error).message,
      });
      result.unreadablePaths.push(dir);
      continue;
    }
    let subdirCount = 0;
    const childDirectories: string[] = [];
    let hasImage = false;
    for (const entry of entries) {
      throwIfAborted(signal, abortToken);
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        subdirCount += 1;
        childDirectories.push(full);
        stack.push(full);
      } else if (entry.isFile()) {
        if (isMetaFileName(entry.name)) {
          result.metaPaths.push(full);
          result.metaDirs.add(dir);
          markDirsWithMetaInSubtree(dir, root, result.dirsWithMetaInSubtree);
        } else if (isMetaStagingFileName(entry.name)) {
          result.stagedMetaPaths.push(full);
        } else if (AUDIO_EXTENSIONS.has(extOf(entry.name))) {
          result.audioDirs.add(dir);
          const breakdown = result.audioBreakdownByDir.get(dir) ?? new Map<string, number>();
          const extension = extOf(entry.name);
          breakdown.set(extension, (breakdown.get(extension) ?? 0) + 1);
          result.audioBreakdownByDir.set(dir, breakdown);
        } else if (IMAGE_EXTENSIONS.has(extOf(entry.name))) {
          hasImage = true;
        }
      }
    }
    result.dirIndex.set(dir, { subdirCount, hasImage, childDirectories });
    visited += 1;
    if (visited % WALK_PROGRESS_INTERVAL === 0) {
      onDirVisited?.(visited);
    }
  }
  result.metaPaths.sort(naturalCompare);
  return result;
}

export function markDirsWithMetaInSubtree(
  metaDir: string,
  root: string,
  dirsWithMetaInSubtree: Set<string>,
): void {
  let cur = metaDir;
  while (isPathWithin(root, cur)) {
    dirsWithMetaInSubtree.add(cur);
    if (cur === root) break;
    cur = dirname(cur);
  }
}

export function isCoveredByMeta(dir: string, root: string, metaDirs: Set<string>): boolean {
  let cur = dir;
  while (isPathWithin(root, cur)) {
    if (metaDirs.has(cur)) return true;
    if (cur === root) break;
    cur = dirname(cur);
  }
  return false;
}

/** 音声ディレクトリから作品ルートを推定する（保守的に昇格。walk インデックス参照）。 */
export function findWorkRoot(
  audioDir: string,
  root: string,
  dirsWithMetaInSubtree: Set<string>,
  dirIndex: Map<string, DirEntryInfo>,
): string {
  let cur = audioDir;
  while (true) {
    const parent = dirname(cur);
    if (cur === root || parent === cur || !isPathWithin(root, parent) || parent === root) break;

    if (dirsWithMetaInSubtree.has(parent)) break;

    const info = dirIndex.get(parent);
    if (!info) break;

    if (info.hasImage || info.subdirCount === 1 || isMultiDiscContainer(info, audioDir)) {
      cur = parent;
    } else {
      break;
    }
  }
  return cur;
}

/** Disc 1/2 のような媒体分割だけは、カバーなしでも親フォルダーを一作品として扱う。 */
function isMultiDiscContainer(info: DirEntryInfo, audioDir: string): boolean {
  if (info.subdirCount < 2) return false;
  return info.childDirectories.every((path) => {
    const name = basename(path);
    return /^(?:cd|disc|disk|part|track)[ _.-]*\d+$/i.test(name) || path === audioDir;
  });
}
