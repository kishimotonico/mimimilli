import {
  coverFieldsFromColumns,
  type Cover,
  type CoverValueBase,
  type WorkSummary,
} from "@mimimilli/shared";
import { deriveCoverVersion } from "../../adapter/media.ts";
import type { FixtureCoverColumns } from "./data.ts";
import { synthesizeCoverSvg } from "./media.ts";

export function fixtureCoverFromColumns(
  work: Pick<WorkSummary, "id" | "title"> & { cover?: CoverValueBase | null },
  columns: FixtureCoverColumns,
): Cover {
  const { cover } = coverFieldsFromColumns(
    columns.image,
    columns.dimensions?.width ?? null,
    columns.dimensions?.height ?? null,
  );
  if (cover === null) return null;
  const location = synthesizeCoverSvg({ ...work, cover });
  if (location.type !== "synthetic") {
    throw new Error("fixtureのカバー画像はsynthetic MediaLocationである必要があります");
  }
  return {
    ...cover,
    version: deriveCoverVersion(work.id, undefined, { size: location.size, mtimeMs: 0 }),
  };
}
