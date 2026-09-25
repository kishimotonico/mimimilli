import { statSync } from "node:fs";
import { join } from "node:path";
import { coverFieldsFromColumns, type Cover, type WorkPlacement } from "@mimimilli/shared";
import { deriveCoverVersion } from "../../adapter/media.ts";

export function statCoverSource(
  placement: WorkPlacement,
  coverImage: string,
): { size: number; mtimeMs: number } | null {
  try {
    const stats = statSync(join(placement.mediaRoot, coverImage));
    if (!stats.isFile()) return null;
    return { size: stats.size, mtimeMs: stats.mtimeMs };
  } catch {
    return null;
  }
}

export function coverDtoFromColumns(
  workId: string,
  placement: WorkPlacement,
  coverImage: string | null,
  coverWidth: number | null,
  coverHeight: number | null,
): Cover {
  const { cover } = coverFieldsFromColumns(coverImage, coverWidth, coverHeight);
  if (cover === null) return null;
  const source = statCoverSource(placement, coverImage!);
  if (source === null) return null;
  return { ...cover, version: deriveCoverVersion(workId, undefined, source) };
}
