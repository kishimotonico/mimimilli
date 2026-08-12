import type { DlsiteState, NormalizedTag, UrlEntry } from "@mimimilli/shared";
import { patchMetaFileCas, readMetaSource } from "./meta.ts";
import { SourceChangedError } from "../../errors.ts";
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
  catalogPatch: DlsiteWorkCatalogPatch;
  coverImage?: string;
  dlsite: DlsiteState;
}

export async function persistDlsiteAppliedWork(
  catalog: CatalogWorkRepository,
  scanner: Scanner,
  input: DlsiteAppliedWorkPersistInput,
  options?: { ifWorkMissing?: "return-false" | "throw" },
): Promise<boolean> {
  const ifWorkMissing = options?.ifWorkMissing ?? "return-false";
  const { workId, catalogPatch, coverImage, dlsite } = input;
  const metaPath = catalog.getWorkMetaPath(workId);
  if (!metaPath) {
    if (ifWorkMissing === "throw") {
      throw new Error(`一括取得中に作品が見つからなくなりました: ${workId}`);
    }
    return false;
  }
  const source = readMetaSource(metaPath);
  try {
    const updated = patchMetaFileCas(metaPath, source.sourceRevision, {
      title: catalogPatch.title,
      tags: catalogPatch.tags,
      coverImage,
      urls: catalogPatch.urls,
      dlsite,
    });
    await scanner.projectMetaFile(metaPath, updated.meta);
    return true;
  } catch (error) {
    if (error instanceof SourceChangedError) return false;
    throw error;
  }
}
