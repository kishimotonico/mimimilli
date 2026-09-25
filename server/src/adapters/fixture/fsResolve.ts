import type { FsNode } from "./data.ts";

export function normalizeFsPath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** target が rootAbs 自身または配下か。 */
export function isFsPathWithin(rootAbs: string, target: string): boolean {
  const root = normalizeFsPath(rootAbs);
  return target === root || target.startsWith(root === "/" ? "/" : `${root}/`);
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
