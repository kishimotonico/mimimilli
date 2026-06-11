// 作品フォルダー配下の物理ファイルツリー（GET /api/works/:id/files、フォルダービュー用）。
import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { FileEntry } from "@mimikago/shared";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function buildFileTree(dirPath: string): FileEntry | null {
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const children: FileEntry[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // .meta.json 等の管理ファイルは隠す
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const child = buildFileTree(full);
      if (child) children.push(child);
    } else if (entry.isFile()) {
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        // stat できないファイルはサイズ 0 のまま表示
      }
      children.push({ name: entry.name, path: full, isDir: false, size, fileType: extOf(entry.name), children: [] });
    }
  }
  children.sort((a, b) =>
    a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name, "ja", { numeric: true })
  );

  return { name: basename(dirPath), path: dirPath, isDir: true, size: 0, fileType: "dir", children };
}
