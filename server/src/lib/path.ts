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
  operations: PathOperations = nativePathOperations,
): boolean {
  const rel = operations.relative(base, target);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${operations.sep}`) && !operations.isAbsolute(rel))
  );
}
