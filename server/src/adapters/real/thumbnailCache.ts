// カバー画像のサムネイル生成とディスクキャッシュ（real アダプタ専用）。
// キャッシュキーは 作品ID・幅・元ファイルの mtime から作る。元カバーが更新されて
// mtime が変わればキーは変わるが、旧ファイルは自然には消えないため、
// gcThumbnailCache による明示的な削除（GC）で掃除する（TASK-26）。
import { createHash } from "node:crypto";
import { availableParallelism } from "node:os";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { THUMBNAIL_WIDTHS } from "@mimimilli/shared";
import sharp from "sharp";

export interface Thumbnail {
  absolutePath: string;
  mime: string;
}

export interface ThumbnailSource {
  size: number;
  mtimeMs: number;
}

export interface ThumbnailTransformInput {
  sourceAbsolutePath: string;
  width: number;
  tmpPath: string;
}

export interface ThumbnailCacheOptions {
  maxConcurrent?: number;
  transform?: (input: ThumbnailTransformInput) => Promise<void>;
  /** rename失敗を含むファイル確定処理の検証用。通常はnode:fs/promisesのrenameを使う。 */
  rename?: (oldPath: string, newPath: string) => Promise<void>;
}

/** cacheDir配下にworkId・width・元ファイルsize/mtimeをキーにしたキャッシュファイル名を作る。 */
function cacheFileName(workId: string, width: number, source: ThumbnailSource): string {
  const hash = createHash("sha256")
    .update(`${workId}\0${width}\0${source.size}\0${source.mtimeMs}`)
    .digest("hex");
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

async function sharpTransform({
  sourceAbsolutePath,
  width,
  tmpPath,
}: ThumbnailTransformInput): Promise<void> {
  await sharp(sourceAbsolutePath)
    .resize({ width, withoutEnlargement: true })
    .webp()
    .toFile(tmpPath);
}

/** FIFO順で変換slotを渡す、サービス内の小さなsemaphore。 */
class FifoSemaphore {
  private available: number;
  private readonly waiting: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    this.available = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.available++;
  }
}

/** single-flight と待機列をサービス単位に閉じ込めるサムネイル生成サービス。 */
export class ThumbnailCache {
  private readonly inFlight = new Map<string, Promise<Thumbnail>>();
  /** cache判定とsingle-flight登録を呼出順に行い、非同期statの完了順でFIFOを崩さない。 */
  private admissionTail: Promise<void> = Promise.resolve();
  private readonly semaphore: FifoSemaphore;
  private readonly transform: (input: ThumbnailTransformInput) => Promise<void>;
  private readonly renameFile: (oldPath: string, newPath: string) => Promise<void>;
  private tmpFileCounter = 0;

  constructor(options: ThumbnailCacheOptions = {}) {
    const maxConcurrent = options.maxConcurrent ?? Math.max(1, availableParallelism());
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("thumbnailCache.maxConcurrent は1以上の整数で指定してください");
    }
    this.semaphore = new FifoSemaphore(maxConcurrent);
    this.transform = options.transform ?? sharpTransform;
    this.renameFile = options.rename ?? rename;
  }

  private async generate(
    cachedPath: string,
    width: number,
    sourceAbsolutePath: string,
  ): Promise<Thumbnail> {
    const tmpPath = `${cachedPath}.tmp-${process.pid}-${this.tmpFileCounter++}`;
    await this.semaphore.acquire();
    try {
      await this.transform({ sourceAbsolutePath, width, tmpPath });
      await this.renameFile(tmpPath, cachedPath);
      return { absolutePath: cachedPath, mime: "image/webp" };
    } catch (error) {
      // cleanup失敗で変換/renameの原因を覆い隠さない。
      try {
        await rm(tmpPath, { force: true });
      } catch {
        // 元のエラーを返す。
      }
      throw error;
    } finally {
      this.semaphore.release();
    }
  }

  private async admit(
    cacheDir: string,
    workId: string,
    width: number,
    sourceAbsolutePath: string,
    source?: ThumbnailSource,
  ): Promise<{ result: Promise<Thumbnail> }> {
    const sourceStat = source ?? (await stat(sourceAbsolutePath));
    const sourceKey: ThumbnailSource = { size: sourceStat.size, mtimeMs: sourceStat.mtimeMs };
    const cachedPath = join(cacheDir, cacheFileName(workId, width, sourceKey));
    if (await fileExists(cachedPath)) {
      return { result: Promise.resolve({ absolutePath: cachedPath, mime: "image/webp" }) };
    }

    const existing = this.inFlight.get(cachedPath);
    if (existing) return { result: existing };

    await mkdir(cacheDir, { recursive: true });
    const promise = this.generate(cachedPath, width, sourceAbsolutePath).finally(() => {
      this.inFlight.delete(cachedPath);
    });
    this.inFlight.set(cachedPath, promise);
    return { result: promise };
  }

  getOrCreate(
    cacheDir: string,
    workId: string,
    width: number,
    sourceAbsolutePath: string,
    source?: ThumbnailSource,
  ): Promise<Thumbnail> {
    const admitted = this.admissionTail.then(() =>
      this.admit(cacheDir, workId, width, sourceAbsolutePath, source),
    );
    this.admissionTail = admitted.then(
      () => {},
      () => {},
    );
    return admitted.then(({ result }) => result);
  }
}

const defaultThumbnailCache = new ThumbnailCache();

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
  source?: ThumbnailSource,
): Promise<Thumbnail> {
  return defaultThumbnailCache.getOrCreate(cacheDir, workId, width, sourceAbsolutePath, source);
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
  options: { throwIfCancelled?: () => void } = {},
): Promise<ThumbnailGcResult> {
  const checkpoint = options.throwIfCancelled ?? (() => {});
  checkpoint();
  const validNames = new Set<string>();
  let skippedWorks = 0;
  for (const work of works) {
    checkpoint();
    let source: ThumbnailSource;
    try {
      const sourceStat = await stat(work.coverAbsolutePath);
      source = { size: sourceStat.size, mtimeMs: sourceStat.mtimeMs };
    } catch {
      skippedWorks++;
      continue;
    }
    checkpoint();
    for (const width of THUMBNAIL_WIDTHS) {
      checkpoint();
      validNames.add(cacheFileName(work.workId, width, source));
    }
  }

  let entries: string[];
  checkpoint();
  try {
    entries = await readdir(cacheDir);
  } catch {
    // cacheDir 自体が未作成（一度もサムネイルを生成していない）なら削除対象は無い
    return { deleted: 0, kept: 0, skippedWorks };
  }
  checkpoint();

  let deleted = 0;
  let kept = 0;
  for (const name of entries) {
    checkpoint();
    if (validNames.has(name)) {
      kept++;
      continue;
    }
    await rm(join(cacheDir, name), { force: true });
    checkpoint();
    deleted++;
  }
  return { deleted, kept, skippedWorks };
}
