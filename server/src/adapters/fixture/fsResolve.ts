import { buildWorkFileTree, type FixtureCoverColumns, type FsNode } from "./data.ts";
import type { WorkSummary } from "@mimimilli/shared";

export function normalizeFsPath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** root 配下の絶対パスからファイルまたはディレクトリを辿る。root 配下でない・存在しなければ null */
export function resolveFsPath(root: FsNode, rootAbs: string, target: string): FsNode | null {
  if (target === rootAbs) return root;
  if (!target.startsWith(`${rootAbs}/`)) return null;
  const segments = target
    .slice(rootAbs.length + 1)
    .split("/")
    .filter(Boolean);
  let cur = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const next = cur.children.find((c) => c.name === seg);
    if (!next) return null;
    if (i === segments.length - 1) return next;
    if (!next.isDir) return null;
    cur = next;
  }
  return null;
}

/** browseFs 用。ディレクトリのみ辿る（最終セグメントがファイルの場合は null） */
export function resolveFsDir(root: FsNode, rootAbs: string, target: string): FsNode | null {
  const node = resolveFsPath(root, rootAbs, target);
  return node?.isDir ? node : null;
}

/** 作品配下のファイルツリーから相対パス（"特典/台本.pdf" 等）でノードを探す。
 *  存在しない・ディレクトリの場合は null */
export function findWorkFile(
  work: WorkSummary,
  coverColumns: FixtureCoverColumns,
  relPath: string,
): FsNode | null {
  const segments = relPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let nodes = buildWorkFileTree(work, coverColumns.image);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const node = nodes.find((n) => n.name === seg);
    if (!node) return null;
    if (i === segments.length - 1) return node.isDir ? null : node;
    if (!node.isDir) return null;
    nodes = node.children;
  }
  return null;
}

export function isImagePath(path: string): boolean {
  return /\.(jpe?g|png|gif|bmp|webp|avif|svg)$/i.test(path);
}

export function isAudioFileType(fileType: string): boolean {
  return ["mp3", "m4a", "aac", "wav", "ogg", "flac", "webm", "opus"].includes(
    fileType.toLowerCase(),
  );
}
