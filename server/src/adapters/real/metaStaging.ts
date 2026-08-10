import { basename, dirname, join } from "node:path";
import { isMetaFileName } from "./meta.ts";

export const META_STAGING_SUFFIX = ".unregistering";

export function metaStagingPath(canonicalPath: string): string {
  return join(dirname(canonicalPath), `.${basename(canonicalPath)}${META_STAGING_SUFFIX}`);
}

export function isMetaStagingFileName(name: string): boolean {
  if (!name.startsWith(".") || !name.endsWith(META_STAGING_SUFFIX)) return false;
  const inner = name.slice(1, name.length - META_STAGING_SUFFIX.length);
  return isMetaFileName(inner);
}

export function canonicalMetaPathFromStaging(stagingPath: string): string {
  const name = basename(stagingPath);
  const inner = name.slice(1, name.length - META_STAGING_SUFFIX.length);
  return join(dirname(stagingPath), inner);
}
