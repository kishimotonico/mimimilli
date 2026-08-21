import { statSync } from "node:fs";
import { join } from "node:path";
import { coverFieldsFromColumns, type Cover } from "@mimimilli/shared";
import { deriveCoverVersion } from "../../adapter/media.ts";

export function statCoverSource(
  physicalPath: string,
  coverImage: string,
): { size: number; mtimeMs: number } | null {
  try {
    const stats = statSync(join(physicalPath, coverImage));
    if (!stats.isFile()) return null;
    return { size: stats.size, mtimeMs: stats.mtimeMs };
  } catch {
    return null;
  }
}

export function coverDtoFromColumns(
  workId: string,
  physicalPath: string,
  coverImage: string | null,
  coverWidth: number | null,
  coverHeight: number | null,
): Cover {
  const { cover } = coverFieldsFromColumns(coverImage, coverWidth, coverHeight);
  if (cover === null) return null;
  const source = statCoverSource(physicalPath, coverImage!);
  if (source === null) return null;
  return { ...cover, version: deriveCoverVersion(workId, undefined, source) };
}
