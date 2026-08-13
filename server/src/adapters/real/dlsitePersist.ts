import type { NormalizedTag, UrlEntry } from "@mimimilli/shared";
import { patchMetaFileCas } from "./meta.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { CoverColumns } from "./workRowMapping.ts";
import type { Scanner } from "./scanner.ts";

export interface DlsiteWorkCatalogPatch {
  title?: string;
  tags?: NormalizedTag[];
  cover?: CoverColumns;
  urls?: UrlEntry[];
}

export interface DlsiteAppliedWorkPersistInput {
  workId: string;
  sourceRevision: string;
  catalogPatch: DlsiteWorkCatalogPatch;
  coverImage?: string;
}

export async function persistDlsiteAppliedWork(
  catalog: CatalogWorkRepository,
  scanner: Scanner,
  input: DlsiteAppliedWorkPersistInput,
  options?: { ifWorkMissing?: "return-false" | "throw" },
): Promise<boolean> {
  const ifWorkMissing = options?.ifWorkMissing ?? "return-false";
  const { workId, sourceRevision, catalogPatch, coverImage } = input;
  const metaPath = catalog.getWorkMetaPath(workId);
  if (!metaPath) {
    if (ifWorkMissing === "throw") {
      throw new Error(`一括取得中に作品が見つからなくなりました: ${workId}`);
    }
    return false;
  }
  const updated = patchMetaFileCas(metaPath, sourceRevision, {
    title: catalogPatch.title,
    tags: catalogPatch.tags,
    coverImage,
    urls: catalogPatch.urls,
  });
  await scanner.projectMetaFile(metaPath, updated.meta);
  return true;
}
