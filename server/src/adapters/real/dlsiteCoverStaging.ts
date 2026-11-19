import { existsSync } from "node:fs";
import { join } from "node:path";
import { CoverSaveError } from "../../errors.ts";
import { commitTempFile, removeTempFile, writeTempFile } from "./atomicFile.ts";
import { normalizeDlsiteCoverUrl } from "./dlsite.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { resolveWithin } from "./paths.ts";
import { measureCoverDimensions } from "./thumbnailCache.ts";
import type { CoverColumns } from "./workRowMapping.ts";

const DLSITE_COVER_BASENAME = "dlsite_cover";

const COVER_EXTENSION_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export interface StagedCover {
  fileName: string;
  dimensions: NonNullable<CoverColumns["dimensions"]>;
  commit(): void;
  /** commit後に登録が失敗したとき、commitで新しく作ったカバーを消す */
  rollback(): void;
  discard(): void;
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
 * カバーキャッシュにあるカバーを作品フォルダー内の一時ファイルへ置く。DLsiteへは取りに行かない。
 * 最終名への確定は呼び出し側が commit() で行う。キャッシュに無い・画像形式を判定できない・
 * ルート外の作品フォルダー・画像として読めない場合は null。
 */
export async function stageCachedDlsiteCover(
  cache: Pick<DlsiteCache, "getCover">,
  coverUrl: string,
  workDir: string,
  root: string,
): Promise<StagedCover | null> {
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
  const realWorkDir = resolveWithin(root, workDir);
  if (!realWorkDir) return null;
  const fileName = `${DLSITE_COVER_BASENAME}.${extension}`;
  let tmpPath: string;
  try {
    tmpPath = writeTempFile(realWorkDir, DLSITE_COVER_BASENAME, cached.body);
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
  let createdByCommit = false;
  return {
    fileName,
    dimensions,
    rollback: () => {
      if (createdByCommit) removeTempFile(finalPath);
    },
    commit: () => {
      try {
        createdByCommit = !existsSync(finalPath);
        commitTempFile(tmpPath, finalPath);
      } catch (error) {
        throw new CoverSaveError({ cause: error });
      }
    },
    discard: () => removeTempFile(tmpPath),
  };
}
