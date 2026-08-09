import type { DlsiteState, NormalizedTag, UrlEntry } from "@mimimilli/shared";
import { patchMetaFile } from "./meta.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { CoverColumns } from "./workRowMapping.ts";

export interface DlsiteWorkCatalogPatch {
  title?: string;
  tags?: NormalizedTag[];
  cover?: CoverColumns;
  urls?: UrlEntry[];
}

export interface DlsiteAppliedWorkPersistInput {
  workId: string;
  catalogPatch: DlsiteWorkCatalogPatch;
  coverImage?: string;
  dlsite: DlsiteState;
}

export function persistDlsiteAppliedWork(
  db: Db,
  catalog: CatalogWorkRepository,
  input: DlsiteAppliedWorkPersistInput,
  options?: { ifWorkMissing?: "return-false" | "throw" },
): boolean {
  const ifWorkMissing = options?.ifWorkMissing ?? "return-false";
  const { workId, catalogPatch, coverImage, dlsite } = input;
  return db.transaction(() => {
    const updated = catalog.patchWorkCatalog(workId, catalogPatch);
    if (!updated) {
      if (ifWorkMissing === "throw") {
        throw new Error(`一括取得中に作品が見つからなくなりました: ${workId}`);
      }
      return false;
    }
    catalog.setDlsiteState(workId, dlsite);
    patchMetaFile(updated.metaPath, {
      title: catalogPatch.title,
      tags: catalogPatch.tags,
      coverImage,
      urls: catalogPatch.urls,
      dlsite,
    });
    return true;
  });
}
