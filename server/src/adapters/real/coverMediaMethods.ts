import { stat } from "node:fs/promises";
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
import { mimeOf, resolveWithin, workspaceMediaMetadata } from "./paths.ts";
import { ThumbnailCache } from "./thumbnailCache.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

export function createCoverMediaMethods(deps: {
  query: WorkQueryRepository;
  thumbnailCache: ThumbnailCache;
  thumbnailCacheDir: string;
  requireRoot: () => string;
}) {
  const { query, thumbnailCache, thumbnailCacheDir, requireRoot } = deps;
  async function describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
    const work = query.getCoverLocation(workId);
    if (!work?.coverImage) return null;

    const sourceAbsolutePath = resolveWithin(
      work.physicalPath,
      join(work.physicalPath, work.coverImage),
    );
    if (!sourceAbsolutePath) return null;

    let sourceStat: Awaited<ReturnType<typeof stat>>;
    try {
      sourceStat = await stat(sourceAbsolutePath);
    } catch {
      return null;
    }
    if (!sourceStat.isFile()) return null;
    const source = { size: sourceStat.size, mtimeMs: sourceStat.mtimeMs };
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
      const resolved = resolveWithin(root, join(root, ref.path));
      if (!resolved) return null;
      try {
        const stats = await stat(resolved);
        if (!stats.isFile()) return null;
        const metadata = workspaceMediaMetadata(resolved, stats.size);
        return {
          location: {
            type: "file" as const,
            absolutePath: resolved,
            mime: mimeOf(resolved),
            size: stats.size,
          },
          ...metadata,
          maxBytes: metadata.mediaKind === "text" ? TEXT_PREVIEW_LIMIT_BYTES : undefined,
        };
      } catch {
        return null;
      }
    },

    async locateMedia(
      _kind: CatalogMediaKind,
      workId: string,
      relPath?: string,
    ): Promise<MediaLocation | null> {
      const root = query.getMediaRoot(workId);
      if (!root) return null;

      const rel = relPath;
      if (!rel) return null;

      const resolved = resolveWithin(root.physicalPath, join(root.physicalPath, rel));
      if (!resolved) return null;

      return { type: "file", absolutePath: resolved, mime: mimeOf(resolved) };
    },

    async browseFs(path?: WorkspacePath): Promise<FsListing | null> {
      const root = requireRoot();
      const realRoot = resolveWithin(root, root);
      if (realRoot === null) return null;
      const target = resolveWithin(root, path ? join(root, path) : root);
      if (target === null) return null;
      return browseFilesystem(realRoot, query.listFsWorkRefs(target), target);
    },

    async describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
      return describeCover(workId, width);
    },
  };
}
