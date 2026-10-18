import { join } from "node:path";
import { coverFieldsFromColumns, type Cover, type WorkPlacement } from "@mimimilli/shared";
import { deriveCoverVersion } from "../../adapter/media.ts";
import { resolveRegularFileWithin } from "./paths.ts";

export function statCoverSource(
  placement: WorkPlacement,
  coverImage: string,
): { size: number; mtimeMs: number } | null {
  const file = resolveRegularFileWithin(placement.mediaRoot, join(placement.mediaRoot, coverImage));
  return file && { size: file.size, mtimeMs: file.mtimeMs };
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
  const source = statCoverSource(placement, cover.image);
  if (source === null) return null;
  return { ...cover, version: deriveCoverVersion(workId, undefined, source) };
}
