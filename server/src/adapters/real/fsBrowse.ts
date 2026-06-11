// 物理ファイルシステムブラウズ（GET /api/fs）の実装。
// ルートフォルダー配下のみ閲覧可（resolveWithin で検証）。
// 作品との対応付け: ディレクトリは physical_path 完全一致、ファイルは
// 「physical_path が祖先である作品」のうち最も深いものに紐づけ、workRelPath を付与する。
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FsEntry, FsListing, WorkSummary } from "@mimikago/shared";
import { isPathWithin, resolveWithin, toPortableRelativePath } from "./paths.ts";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** path（絶対パス）の所属作品を探す。最も深い physical_path を持つ作品を返す */
function findOwnerWork(path: string, works: WorkSummary[]): WorkSummary | null {
  let owner: WorkSummary | null = null;
  for (const w of works) {
    if (isPathWithin(w.physicalPath, path)) {
      if (!owner || w.physicalPath.length > owner.physicalPath.length) owner = w;
    }
  }
  return owner;
}

export function browseFs(root: string, works: WorkSummary[], path?: string): FsListing | null {
  const target = resolveWithin(root, path ?? root);
  if (target === null) return null;

  let entries;
  try {
    entries = readdirSync(target, { withFileTypes: true });
  } catch {
    return null; // ファイルパスが指定された等
  }

  const realRoot = resolveWithin(root, root)!;
  const dirWork = works.find((w) => w.physicalPath === target) ?? null;

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
        workId: works.find((w) => w.physicalPath === full)?.id ?? null,
        workRelPath: null,
      });
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".meta.json") || entry.name.startsWith(".")) continue; // 管理ファイルは隠す
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        // stat できないファイルはサイズ不明のまま表示
      }
      const owner = findOwnerWork(full, works);
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
    a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name, "ja", { numeric: true })
  );

  return {
    path: target,
    parent: target === realRoot ? null : dirname(target),
    workId: dirWork?.id ?? null,
    entries: fsEntries,
  };
}
