// カバー画像のサムネイル生成とディスクキャッシュ（real アダプタ専用）。
// キャッシュキーは 作品ID・幅・元ファイルの mtime から作る。元カバーが更新されて
// mtime が変わればキーは変わるが、旧ファイルは自然には消えないため、
// gcThumbnailCache による明示的な削除（GC）で掃除する（TASK-26）。
import { createHash } from "node:crypto";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { THUMBNAIL_WIDTHS } from "@mimimilli/shared";
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

/** GC対象を判定するために必要な、作品ごとのカバー実パス */
export interface WorkCoverEntry {
  workId: string;
  /** 作品配下のカバー画像の絶対パス（resolveWithin 済み） */
  coverAbsolutePath: string;
}

export interface ThumbnailGcResult {
  /** 削除したファイル数（孤児キャッシュ + 孤児 .tmp- ファイル） */
  deleted: number;
  /** 有効なキャッシュとして残したファイル数 */
  kept: number;
  /** カバーを stat できず有効集合の計算から除外した作品数 */
  skippedWorks: number;
}

/**
 * サムネイルキャッシュのGC。real アダプタのスキャン完了時（全作品を走査する自然な
 * タイミング）に呼ぶ想定。「現存する作品 × THUMBNAIL_WIDTHS × 現在のカバー mtime」
 * から有効なキャッシュファイル名の集合を作り、cacheDir 配下でそれ以外の .webp を
 * 削除する。元カバーが更新されて mtime が変わると旧ファイル名は有効集合に含まれなく
 * なるため、次のGCで自然に消える。
 *
 * カバーが無い・stat できない作品は有効集合の計算から単にスキップする（キー計算不能
 * = そのファイルは有効集合に入らないだけで、GC全体は止めない。skippedWorks で件数を
 * 可視化する）。
 *
 * 生成中の一時ファイル（.tmp-プレフィックス、cacheFileName の命名規則に一致しない）は
 * 有効集合に入りようがないため、孤児として常に削除対象になる。GC実行のタイミングと
 * ちょうど同時にサムネイル生成中だった場合、その一時ファイルが削除されて rename が
 * ENOENT で失敗しうるが、GCはスキャン完了時のみで頻度が低く、失敗時は呼び出し元が
 * エラーを受け取って次のリクエストで再試行できるため許容する（隠蔽はしない）。
 */
export async function gcThumbnailCache(
  cacheDir: string,
  works: WorkCoverEntry[],
): Promise<ThumbnailGcResult> {
  const validNames = new Set<string>();
  let skippedWorks = 0;
  for (const work of works) {
    let mtimeMs: number;
    try {
      mtimeMs = (await stat(work.coverAbsolutePath)).mtimeMs;
    } catch {
      skippedWorks++;
      continue;
    }
    for (const width of THUMBNAIL_WIDTHS) {
      validNames.add(cacheFileName(work.workId, width, mtimeMs));
    }
  }

  let entries: string[];
  try {
    entries = await readdir(cacheDir);
  } catch {
    // cacheDir 自体が未作成（一度もサムネイルを生成していない）なら削除対象は無い
    return { deleted: 0, kept: 0, skippedWorks };
  }

  let deleted = 0;
  let kept = 0;
  for (const name of entries) {
    if (validNames.has(name)) {
      kept++;
      continue;
    }
    await rm(join(cacheDir, name), { force: true });
    deleted++;
  }
  return { deleted, kept, skippedWorks };
}
