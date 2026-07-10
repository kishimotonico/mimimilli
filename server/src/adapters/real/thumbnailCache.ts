// カバー画像のサムネイル生成とディスクキャッシュ（real アダプタ専用）。
// キャッシュキーは 作品ID・幅・元ファイルの mtime から作る。元カバーが更新されて
// mtime が変わればキーも変わるため、古いキャッシュは自然に無効化される（明示的な削除はしない）。
import { createHash } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export interface Thumbnail {
  absolutePath: string;
  mime: string;
}

/** cacheDir 配下に workId・width・元ファイル mtime をキーにしたキャッシュファイル名を作る */
function cacheFileName(workId: string, width: number, mtimeMs: number): string {
  const hash = createHash("sha256").update(`${workId}\0${width}\0${mtimeMs}`).digest("hex");
  return `${hash}.webp`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** 同一 cachedPath への初回生成リクエストを束ねる single-flight マップ */
const inFlight = new Map<string, Promise<Thumbnail>>();
let tmpFileCounter = 0;

/** 一時ファイルへ生成してから rename する（生成途中のファイルを配信しないため）。
 *  失敗時は一時ファイルを削除して呼び出し側へそのままエラーを伝える（エラー隠蔽しない）。 */
async function generateThumbnail(
  cacheDir: string,
  cachedPath: string,
  width: number,
  sourceAbsolutePath: string,
): Promise<Thumbnail> {
  await mkdir(cacheDir, { recursive: true });
  const tmpPath = `${cachedPath}.tmp-${process.pid}-${tmpFileCounter++}`;
  try {
    await sharp(sourceAbsolutePath)
      .resize({ width, withoutEnlargement: true })
      .webp()
      .toFile(tmpPath);
    await rename(tmpPath, cachedPath);
  } catch (e) {
    await rm(tmpPath, { force: true });
    throw e;
  }
  return { absolutePath: cachedPath, mime: "image/webp" };
}

/**
 * 指定幅の webp サムネイルを返す。キャッシュがあればそれを使い、無ければ sharp で生成して
 * cacheDir に保存する（2回目以降は再生成しない）。同一キャッシュキーへの同時リクエストは
 * in-flight マップで束ねて変換を1回だけ実行する（異なるキーは並行のまま）。
 * 元画像が読めない場合は sharp のエラーをそのまま投げる（呼び出し側でエラー隠蔽しない）。
 */
export async function getOrCreateThumbnail(
  cacheDir: string,
  workId: string,
  width: number,
  sourceAbsolutePath: string,
): Promise<Thumbnail> {
  const sourceStat = await stat(sourceAbsolutePath);
  const fileName = cacheFileName(workId, width, sourceStat.mtimeMs);
  const cachedPath = join(cacheDir, fileName);

  if (await fileExists(cachedPath)) {
    return { absolutePath: cachedPath, mime: "image/webp" };
  }

  const existing = inFlight.get(cachedPath);
  if (existing) return existing;

  const promise = generateThumbnail(cacheDir, cachedPath, width, sourceAbsolutePath).finally(() => {
    inFlight.delete(cachedPath);
  });
  inFlight.set(cachedPath, promise);
  return promise;
}
