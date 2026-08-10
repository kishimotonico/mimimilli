// 物理ファイルシステムブラウズ（GET /api/fs）の実装。
// ルートフォルダー配下のみ閲覧可（resolveWithin で検証）。
// 作品との対応付け: ディレクトリは physical_path 完全一致、ファイルは
// 「physical_path が祖先である作品」のうち最も深いものに紐づけ、workRelPath を付与する。
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FsEntry, FsListing } from "@mimimilli/shared";
import { isMetaFileName } from "./meta.ts";
import { toPortableRelativePath } from "./paths.ts";
import { isPathWithin } from "../../lib/path.ts";

/** GET /api/fs の作品対応付けに必要な最小投影。 */
export interface FsWorkRef {
  id: string;
  physicalPath: string;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** 物理パスで作品を引ける索引。重複時は従来の Array.find と同じく先勝ちにする。 */
export function buildWorkPathIndex(works: readonly FsWorkRef[]): Map<string, FsWorkRef> {
  const byPhysicalPath = new Map<string, FsWorkRef>();
  for (const work of works) {
    if (!byPhysicalPath.has(work.physicalPath)) {
      byPhysicalPath.set(work.physicalPath, work);
    }
  }
  return byPhysicalPath;
}

/**
 * path（絶対パス）の所属作品を索引から探す。葉から祖先へたどるため、
 * ネストした作品ルートでは最も深い physical_path を持つ作品を返す。
 */
export function findOwnerWork(
  root: string,
  path: string,
  worksByPhysicalPath: ReadonlyMap<string, FsWorkRef>,
): FsWorkRef | null {
  let current = path;
  while (isPathWithin(root, current)) {
    const owner = worksByPhysicalPath.get(current);
    if (owner) return owner;
    if (current === root) break;
    current = dirname(current);
  }
  return null;
}

export function browseFs(root: string, works: FsWorkRef[], target: string): FsListing | null {
  const worksByPhysicalPath = buildWorkPathIndex(works);

  let entries;
  try {
    entries = readdirSync(target, { withFileTypes: true });
  } catch {
    return null; // ファイルパスが指定された等
  }

  const realRoot = root;
  const dirWork = worksByPhysicalPath.get(target) ?? null;

  const fsEntries: FsEntry[] = [];
  for (const entry of entries) {
    const full = join(target, entry.name);
    if (entry.isDirectory()) {
      let childCount = 0;
      try {
        childCount = readdirSync(full).length;
      } catch {
        // 読めないディレクトリは 0 件として表示
      }
      fsEntries.push({
        name: entry.name,
        path: full,
        isDir: true,
        size: 0,
        fileType: "dir",
        childCount,
        workId: worksByPhysicalPath.get(full)?.id ?? null,
        workRelPath: null,
      });
    } else if (entry.isFile()) {
      if (isMetaFileName(entry.name) || entry.name.startsWith(".")) continue; // 管理ファイルは隠す
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        // stat できないファイルはサイズ不明のまま表示
      }
      const owner = findOwnerWork(realRoot, full, worksByPhysicalPath);
      fsEntries.push({
        name: entry.name,
        path: full,
        isDir: false,
        size,
        fileType: extOf(entry.name),
        childCount: 0,
        workId: owner?.id ?? null,
        workRelPath: owner ? toPortableRelativePath(owner.physicalPath, full) : null,
      });
    }
  }

  // ディレクトリ優先 → 自然順
  fsEntries.sort((a, b) =>
    a.isDir !== b.isDir
      ? a.isDir
        ? -1
        : 1
      : a.name.localeCompare(b.name, "ja", { numeric: true }),
  );

  return {
    path: target,
    parent: target === realRoot ? null : dirname(target),
    workId: dirWork?.id ?? null,
    entries: fsEntries,
  };
}
