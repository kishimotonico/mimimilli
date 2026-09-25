import {
  resolveWorkPlacement,
  type WorkEditSnapshot,
  type WorkSourceMutationResult,
} from "@mimimilli/shared";
import {
  SOURCE_FILE_BROKEN_MESSAGE,
  SOURCE_FILE_MISSING_MESSAGE,
  SOURCE_FORMAT_UNSUPPORTED_MESSAGE,
  SOURCE_IDENTITY_MISMATCH_MESSAGE,
  SOURCE_LOCATION_MISMATCH_MESSAGE,
  SourceConflictError,
  SourceParseError,
} from "../../errors.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import {
  MetaMutationReject,
  MetaParseError,
  encodeMetaRaw,
  mutateMetaSource,
  readMetaSource,
  type MetaSource,
} from "./meta.ts";
import type { Scanner } from "./scanner.ts";
import type { ProjectOutcome } from "./scanTypes.ts";

export type WorkSourceLocation = {
  metaPath: string;
  physicalPath: string;
};

export type VerifiedMetaSource = {
  source: MetaSource;
  metaPath: string;
  physicalPath: string;
};

export function mapMetaReadError(error: unknown): never {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    throw new SourceConflictError(SOURCE_FILE_MISSING_MESSAGE);
  }
  if (error instanceof MetaParseError) {
    if (error.kind === "formatVersion") {
      throw new SourceParseError(SOURCE_FORMAT_UNSUPPORTED_MESSAGE);
    }
    throw new SourceParseError(SOURCE_FILE_BROKEN_MESSAGE);
  }
  throw error;
}

export function assertSourceMatchesCatalog(
  source: MetaSource,
  workId: string,
  location: WorkSourceLocation,
): void {
  if (source.meta.id !== workId) {
    throw new SourceConflictError(SOURCE_IDENTITY_MISMATCH_MESSAGE);
  }
  if (resolveWorkPlacement(location.metaPath, source.meta).physicalPath !== location.physicalPath) {
    throw new SourceConflictError(SOURCE_LOCATION_MISMATCH_MESSAGE);
  }
}

export function toEditSnapshot(source: MetaSource, physicalPath: string): WorkEditSnapshot {
  return {
    sourceRevision: source.sourceRevision,
    id: source.meta.id,
    physicalPath,
    title: source.meta.title,
    tags: source.meta.tags,
    urls: source.meta.urls,
    coverImage: source.meta.coverImage ?? null,
    dlsite: source.meta.dlsite,
  };
}

export function readVerifiedEditSource(
  catalog: CatalogWorkRepository,
  workId: string,
): VerifiedMetaSource | null {
  const location = catalog.getWorkSourceLocation(workId);
  if (!location) return null;
  let source: MetaSource;
  try {
    source = readMetaSource(location.metaPath);
  } catch (error) {
    mapMetaReadError(error);
  }
  assertSourceMatchesCatalog(source, workId, location);
  return { source, ...location };
}

export function mutateVerifiedMetaSource(
  catalog: CatalogWorkRepository,
  workId: string,
  mutate: (source: MetaSource) => Uint8Array | MetaMutationReject,
): VerifiedMetaSource | null {
  const location = catalog.getWorkSourceLocation(workId);
  if (!location) return null;
  let source: MetaSource;
  try {
    source = mutateMetaSource(location.metaPath, (locked) => {
      try {
        assertSourceMatchesCatalog(locked, workId, location);
      } catch (error) {
        return new MetaMutationReject(error instanceof Error ? error : new Error(String(error)));
      }
      return mutate(locked);
    });
  } catch (error) {
    mapMetaReadError(error);
  }
  return { source, ...location };
}

export function mutationResultFromOutcome(
  snapshot: WorkEditSnapshot,
  outcome: ProjectOutcome,
): WorkSourceMutationResult {
  if (outcome.status === "published") {
    return { snapshot, projection: { status: "published" } };
  }
  return {
    snapshot,
    projection: {
      status: "pending",
      reason: outcome.reason === "error" ? "error" : "source_changed",
    },
  };
}

const scanLogger = getCategoryLogger("scan");

export async function projectVerifiedSource(
  scanner: Scanner,
  verified: VerifiedMetaSource,
): Promise<WorkSourceMutationResult> {
  const snapshot = toEditSnapshot(verified.source, verified.physicalPath);
  try {
    const outcome = await scanner.projectMetaFile(verified.metaPath, verified.source);
    return mutationResultFromOutcome(snapshot, outcome);
  } catch (error) {
    scanLogger.error("作品の一覧反映に失敗しました", {
      workId: snapshot.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { snapshot, projection: { status: "pending", reason: "error" } };
  }
}

export { encodeMetaRaw, MetaMutationReject };
