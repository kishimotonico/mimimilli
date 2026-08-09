// カバー画像のサムネイル生成とディスクキャッシュ（real アダプタ専用）。
// キャッシュキーは 作品ID・幅・元ファイルの mtime から作る。元カバーが更新されて
// mtime が変わればキーは変わるが、旧ファイルは自然には消えないため、
// gcThumbnailCache による明示的な削除（GC）で掃除する（TASK-26）。
import { createHash } from "node:crypto";
import { availableParallelism } from "node:os";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { THUMBNAIL_WIDTHS } from "@mimimilli/shared";
import sharp, { type Metadata } from "sharp";

export interface Thumbnail {
  absolutePath: string;
  mime: string;
  size: number;
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
  /**
   * admission時のキャッシュ有無判定に使うstat。キー単位ロックの並行性を検証するテスト用に
   * 差し替え可能にしてある（本番ではstatSizeOrNullそのもの）。
   */
  statCachedFile?: (path: string) => Promise<number | null>;
}

/** cacheDir配下にworkId・width・元ファイルsize/mtimeをキーにしたキャッシュファイル名を作る。 */
function cacheFileName(workId: string, width: number, source: ThumbnailSource): string {
  const hash = createHash("sha256")
    .update(`${workId}\0${width}\0${source.size}\0${source.mtimeMs}`)
    .digest("hex");
  return `${hash}.webp`;
}

async function statSizeOrNull(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

async function sharpTransform({
  sourceAbsolutePath,
  width,
  tmpPath,
}: ThumbnailTransformInput): Promise<void> {
  // .rotate() はEXIF orientationを適用してピクセルを実際に回転させる（配信WebPの向きを
  // 保存済み cover_width/height と一致させる。measureCoverDimensions と同じ規則）。
  await sharp(sourceAbsolutePath)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp()
    .toFile(tmpPath);
}

export interface CoverDimensions {
  /** px（EXIF回転後の表示幅） */
  width: number;
  /** px（EXIF回転後の表示高さ） */
  height: number;
}

/**
 * カバー画像の表示寸法を計測する。EXIF orientation を反映した表示向きで返し、
 * GIF等マルチページは先頭ページの寸法にする（合成高さを誤って保存しない）。
 * 画像が読めない・寸法を取得できない場合は null（呼び出し側で計測失敗として扱う）。
 */
export async function measureCoverDimensions(
  sourceAbsolutePath: string,
): Promise<CoverDimensions | null> {
  let metadata: Metadata;
  try {
    metadata = await sharp(sourceAbsolutePath).metadata();
  } catch {
    return null;
  }
  const rawWidth = metadata.width;
  // pageHeight はマルチページ画像の1ページ分の高さ。無ければ height を使う。
  const rawHeight = metadata.pageHeight ?? metadata.height;
  if (!rawWidth || !rawHeight) return null;
  // orientation 5-8 は90°回転が伴うため表示上の幅高さが入れ替わる。
  const swapped = metadata.orientation !== undefined && metadata.orientation >= 5;
  const width = swapped ? rawHeight : rawWidth;
  const height = swapped ? rawWidth : rawHeight;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
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
  /**
   * cache判定とsingle-flight登録をcachedPathキー単位で直列化する（同一キーのcheck-then-act
   * を原子的にし、二重生成を防ぐ）。キーが異なればエントリも別なので、あるキーの判定待ちが
   * 他キーの判定をブロックしない（グローバル直列化によるhead-of-lineブロッキングの解消）。
   */
  private readonly admissionTails = new Map<string, Promise<void>>();
  private readonly semaphore: FifoSemaphore;
  private readonly transform: (input: ThumbnailTransformInput) => Promise<void>;
  private readonly renameFile: (oldPath: string, newPath: string) => Promise<void>;
  private readonly statCachedFile: (path: string) => Promise<number | null>;
  private tmpFileCounter = 0;

  constructor(options: ThumbnailCacheOptions = {}) {
    const maxConcurrent = options.maxConcurrent ?? Math.max(1, availableParallelism());
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("thumbnailCache.maxConcurrent は1以上の整数で指定してください");
    }
    this.semaphore = new FifoSemaphore(maxConcurrent);
    this.transform = options.transform ?? sharpTransform;
    this.renameFile = options.rename ?? rename;
    this.statCachedFile = options.statCachedFile ?? statSizeOrNull;
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
      const size = await statSizeOrNull(cachedPath);
      if (size === null) {
        throw new Error(`サムネイル生成直後のstatに失敗しました: ${cachedPath}`);
      }
      return { absolutePath: cachedPath, mime: "image/webp", size };
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

  /** cache判定とsingle-flight登録。cachedPathが確定した後、呼出元でキー単位に直列化される。 */
  private async admit(
    cacheDir: string,
    cachedPath: string,
    width: number,
    sourceAbsolutePath: string,
  ): Promise<{ result: Promise<Thumbnail> }> {
    const cachedSize = await this.statCachedFile(cachedPath);
    if (cachedSize !== null) {
      return {
        result: Promise.resolve({ absolutePath: cachedPath, mime: "image/webp", size: cachedSize }),
      };
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

  async getOrCreate(
    cacheDir: string,
    workId: string,
    width: number,
    sourceAbsolutePath: string,
    source?: ThumbnailSource,
  ): Promise<Thumbnail> {
    // cachedPathの計算自体はキー無関係の純粋な読み取りなのでロック不要。
    const sourceStat = source ?? (await stat(sourceAbsolutePath));
    const sourceKey: ThumbnailSource = { size: sourceStat.size, mtimeMs: sourceStat.mtimeMs };
    const cachedPath = join(cacheDir, cacheFileName(workId, width, sourceKey));

    // admit（check-then-act）だけをcachedPath単位で直列化する。異なるキーは別エントリなので
    // 互いを待たず並行に進む。
    const previousTail = this.admissionTails.get(cachedPath) ?? Promise.resolve();
    const admitted = previousTail.then(() =>
      this.admit(cacheDir, cachedPath, width, sourceAbsolutePath),
    );
    const tail = admitted.then(
      () => {},
      () => {},
    );
    this.admissionTails.set(cachedPath, tail);
    // このキーの末尾がまだ自分のままなら（後続の予約が入っていなければ）掃除してMapの肥大を防ぐ。
    void tail.finally(() => {
      if (this.admissionTails.get(cachedPath) === tail) {
        this.admissionTails.delete(cachedPath);
      }
    });
    return admitted.then(({ result }) => result);
  }
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
