import { join } from "node:path";
import { TEXT_PREVIEW_LIMIT_BYTES, type WorkspaceResourceRef } from "@mimimilli/shared";
import type { FsListing } from "@mimimilli/shared";
import {
  createCoverValidators,
  type CatalogMediaKind,
  type CoverDescriptor,
  type MediaLocation,
} from "../../adapter/index.ts";
import type { WorkspacePath } from "@mimimilli/shared";
import { browseFs as browseFilesystem } from "./fsBrowse.ts";
import {
  mimeOf,
  resolveRegularFileWithin,
  resolveWithin,
  workspaceMediaMetadata,
} from "./paths.ts";
import { ThumbnailCache } from "./thumbnailCache.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

export function createCoverMediaMethods(deps: {
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  thumbnailCache: ThumbnailCache;
  thumbnailCacheDir: string;
  requireRoot: () => string;
}) {
  const { query, catalog, thumbnailCache, thumbnailCacheDir, requireRoot } = deps;
  async function describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
    const work = query.getCoverLocation(workId);
    if (!work?.coverImage) return null;

    const { mediaRoot } = work.placement;
    const file = resolveRegularFileWithin(mediaRoot, join(mediaRoot, work.coverImage));
    if (!file) return null;
    const sourceAbsolutePath = file.absolutePath;
    const source = { size: file.size, mtimeMs: file.mtimeMs };
    const validators = createCoverValidators(work.id, width, source);

    return {
      ...validators,
      async materialize(): Promise<MediaLocation> {
        if (width === undefined) {
          return {
            type: "file",
            absolutePath: sourceAbsolutePath,
            mime: mimeOf(sourceAbsolutePath),
            size: source.size,
          };
        }
        const thumbnail = await thumbnailCache.getOrCreate(
          thumbnailCacheDir,
          work.id,
          width,
          sourceAbsolutePath,
          source,
        );
        return {
          type: "file",
          absolutePath: thumbnail.absolutePath,
          mime: thumbnail.mime,
          size: thumbnail.size,
        };
      },
    };
  }
  return {
    async locateWorkspaceMedia(ref: WorkspaceResourceRef) {
      const root = requireRoot();
      const file = resolveRegularFileWithin(root, join(root, ref.path));
      if (!file) return null;
      const metadata = workspaceMediaMetadata(file.absolutePath, file.size);
      return {
        location: {
          type: "file" as const,
          absolutePath: file.absolutePath,
          mime: mimeOf(file.absolutePath),
          size: file.size,
        },
        ...metadata,
        maxBytes: metadata.mediaKind === "text" ? TEXT_PREVIEW_LIMIT_BYTES : undefined,
      };
    },

    async locateMedia(
      kind: CatalogMediaKind,
      workId: string,
      relPath?: string,
    ): Promise<MediaLocation | null> {
      const placement = query.getWorkPlacement(workId);
      if (!placement) return null;

      const rel = relPath;
      if (!rel) return null;

      if (kind === "audio" && !query.hasTrackFile(workId, rel)) return null;

      const { mediaRoot } = placement;
      const file = resolveRegularFileWithin(mediaRoot, join(mediaRoot, rel));
      if (!file) return null;

      return { type: "file", absolutePath: file.absolutePath, mime: mimeOf(file.absolutePath) };
    },

    async browseFs(path?: WorkspacePath): Promise<FsListing | null> {
      const root = requireRoot();
      const realRoot = resolveWithin(root, root);
      if (realRoot === null) return null;
      const target = resolveWithin(root, path ? join(root, path) : root);
      if (target === null) return null;
      const conflictPaths = new Set(
        catalog.listIdentityConflicts().flatMap((diagnostic) => diagnostic.paths),
      );
      return browseFilesystem(realRoot, query.listFsWorkRefs(target), target, conflictPaths);
    },

    async describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
      return describeCover(workId, width);
    },
  };
}
