import { join } from "node:path";
import { CoverSaveError } from "../../errors.ts";
import {
  commitTempFile,
  removeTempFile,
  restoreAsideFile,
  setAsideFile,
  writeTempFile,
} from "./atomicFile.ts";
import { dlsiteCoverBaseName, errorMessage, type WorkPlacement } from "@mimimilli/shared";
import { getCategoryLogger } from "../../lib/logger.ts";
import { normalizeDlsiteCoverUrl } from "./dlsite.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { resolveWithin } from "./paths.ts";
import { measureCoverDimensions } from "./thumbnailCache.ts";
import type { CoverColumns } from "./workRowMapping.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

const COVER_EXTENSION_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export interface StagedCover {
  fileName: string;
  dimensions: NonNullable<CoverColumns["dimensions"]>;
  /** 最終名へ確定する。旧カバーは退避され、saveWithDlsiteCover が保存の成否で消すか戻す */
  place(): void;
}

/** 先頭バイトから画像形式を判定する。判定できないときはnull */
export function sniffImageContentType(body: Uint8Array): string | null {
  const startsWith = (offset: number, bytes: number[]) =>
    bytes.every((byte, index) => body[offset + index] === byte);
  if (startsWith(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(0, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(0, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(0, [0x52, 0x49, 0x46, 0x46]) && startsWith(8, [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp";
  }
  return null;
}

/**
 * キャッシュにあるカバーを作品の配置に沿った名前で保存する共通手順。
 * ステージ → persist 内の place() で配置 → persist 失敗時は旧カバーへ戻す → 後始末。
 * persist は、メタの保存まで含めて成否を決める処理。DLsiteへは取りに行かない。
 * キャッシュに無い・画像形式を判定できない・ルート外の作品フォルダー・画像として読めないときは cover=null で persist を呼ぶ。
 */
export async function saveWithDlsiteCover<T>(
  source: {
    cache: Pick<DlsiteCache, "getCover">;
    coverUrl: string | null | undefined;
    /** 保存前のメタの coverImage。自分の配置から導いた名前で拡張子だけ違うときは、成功後に消す */
    previousCoverImage?: string | null;
  },
  placement: WorkPlacement,
  root: string,
  persist: (cover: StagedCover | null) => T | Promise<T>,
): Promise<T> {
  const staged = source.coverUrl ? await stageCachedDlsiteCover(source, placement, root) : null;
  try {
    const result = await persist(staged?.cover ?? null);
    staged?.settle();
    return result;
  } catch (error) {
    try {
      staged?.revert();
    } catch (revertError) {
      dlsiteLogger.error("DLsiteカバーを元に戻せませんでした", {
        error: errorMessage(revertError),
      });
    }
    throw error;
  } finally {
    staged?.discard();
  }
}

interface StagingHandle {
  cover: StagedCover;
  /** 保存に成功したので退避した旧カバーを消す */
  settle(): void;
  /** 保存に失敗したので配置済みなら旧カバーへ戻す */
  revert(): void;
  discard(): void;
}

async function stageCachedDlsiteCover(
  { cache, coverUrl, previousCoverImage }: Parameters<typeof saveWithDlsiteCover>[0],
  placement: WorkPlacement,
  root: string,
): Promise<StagingHandle | null> {
  if (!coverUrl) return null;
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeDlsiteCoverUrl(coverUrl);
  } catch {
    return null;
  }
  const cached = cache.getCover(normalizedUrl);
  if (!cached) return null;
  const contentType = sniffImageContentType(cached.body);
  const extension = contentType ? COVER_EXTENSION_BY_CONTENT_TYPE[contentType] : undefined;
  if (!extension) return null;
  const realWorkDir = resolveWithin(root, placement.mediaRoot);
  if (!realWorkDir) return null;
  const baseName = dlsiteCoverBaseName(placement);
  const fileName = `${baseName}.${extension}`;
  let tmpPath: string;
  try {
    tmpPath = writeTempFile(realWorkDir, baseName, cached.body);
  } catch (error) {
    throw new CoverSaveError({ cause: error });
  }
  let dimensions: CoverColumns["dimensions"] | null = null;
  try {
    dimensions = await measureCoverDimensions(tmpPath);
  } finally {
    if (!dimensions) removeTempFile(tmpPath);
  }
  if (!dimensions) return null;
  const finalPath = join(realWorkDir, fileName);
  let placed = false;
  let aside: string | null = null;
  return {
    cover: {
      fileName,
      dimensions,
      place: () => {
        try {
          aside = setAsideFile(finalPath);
          placed = true;
          commitTempFile(tmpPath, finalPath);
        } catch (error) {
          throw new CoverSaveError({ cause: error });
        }
      },
    },
    settle: () => {
      if (aside) removeTempFile(aside);
      if (
        placed &&
        previousCoverImage &&
        previousCoverImage !== fileName &&
        Object.values(COVER_EXTENSION_BY_CONTENT_TYPE).some(
          (ext) => previousCoverImage === `${baseName}.${ext}`,
        )
      ) {
        removeTempFile(join(realWorkDir, previousCoverImage));
      }
    },
    revert: () => {
      if (placed) restoreAsideFile(finalPath, aside);
    },
    discard: () => removeTempFile(tmpPath),
  };
}
