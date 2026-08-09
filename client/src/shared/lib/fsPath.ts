function pathSeparator(path: string): "/" | "\\" {
  return path.includes("\\") ? "\\" : "/";
}

function trimTrailingSeparator(path: string, separator: "/" | "\\"): string {
  if (path === separator || /^[A-Za-z]:\\$/.test(path)) return path;
  let end = path.length;
  while (end > 0 && path[end - 1] === separator) end -= 1;
  return path.slice(0, end);
}

/** 絶対パスをルート相対の segments に分解（root 自身 = []） */
export function relSegments(root: string, abs: string): string[] {
  const separator = pathSeparator(root);
  const r = trimTrailingSeparator(root, separator);
  if (abs === r) return [];
  const prefix = r.endsWith(separator) ? r : r + separator;
  if (!abs.startsWith(prefix)) return [];
  return abs.slice(prefix.length).split(separator).filter(Boolean);
}

/** ルートと相対 segments から絶対パスを再構成 */
export function joinPath(root: string, segments: string[]): string {
  const separator = pathSeparator(root);
  const r = trimTrailingSeparator(root, separator);
  if (segments.length === 0) return r;
  const prefix = r.endsWith(separator) ? r : r + separator;
  return prefix + segments.join(separator);
}
