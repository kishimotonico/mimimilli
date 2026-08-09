import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { FsListing } from "@mimimilli/shared";
import {
  createCoverValidators,
  type CoverDescriptor,
  type MediaKind,
  type MediaLocation,
} from "../../adapter/index.ts";
import { browseFs as browseFilesystem } from "./fsBrowse.ts";
import { mimeOf, isAudioPath, resolveWithin } from "./paths.ts";
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
    async locateFsAudio(absolutePath: string): Promise<MediaLocation | null> {
      const root = requireRoot();
      const resolved = resolveWithin(root, absolutePath);
      if (!resolved || !isAudioPath(resolved)) return null;
      try {
        const stats = await stat(resolved);
        if (!stats.isFile()) return null;
      } catch {
        return null;
      }
      return { type: "file", absolutePath: resolved, mime: mimeOf(resolved) };
    },

    async locateMedia(
      _kind: MediaKind,
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

    async browseFs(path?: string): Promise<FsListing | null> {
      const root = requireRoot();
      const realRoot = resolveWithin(root, root);
      if (realRoot === null) return null;
      const target = resolveWithin(root, path ?? root);
      if (target === null) return null;
      return browseFilesystem(realRoot, query.listFsWorkRefs(target), target);
    },

    async describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
      return describeCover(workId, width);
    },
  };
}
