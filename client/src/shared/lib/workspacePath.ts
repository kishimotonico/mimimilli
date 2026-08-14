// ライブラリルートからの相対パス（WorkspacePath）に対する操作。

/** 相対パスの親ディレクトリ部分。ルート直下（親を持たない）なら null。 */
export function parentDirOf(path: string): string | null {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? null : path.slice(0, idx);
}
