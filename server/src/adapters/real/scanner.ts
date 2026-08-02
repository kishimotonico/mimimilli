// ライブラリスキャン。
//
// フロー（要件 v4 §8 / HANDOFF.md）:
//   1. 全作品を「行方不明」にマーク
//   2. ルート以下を走査し、メタファイル（mimimilli.json / *.mimimilli.json）を登録
//      - ID で突合し、移動・リネームに追従（DB の既存情報を保持）
//      - 同一 UUID の重複は後に検出された方を再採番してメタファイルへ書き戻す
//      - 参照先音声の欠損は status "error" + errorMessage
//      - 再生時間は music-metadata でプローブし SQLite にキャッシュ
//   3. メタファイルのない音声フォルダーへ mimimilli.json を自動生成（下書き）
//   4. missing のまま残った作品 = 物理パス消失
//
// Rust 版からの意図的な変更:
//   - 作品ルート判定: Rust 版は「ルート直下の子」まで一律に昇格していたが、
//     「親に画像がある（カバー同梱の典型構成）/ 親が単一サブフォルダーのラッパー」の
//     場合のみ昇格する保守的なヒューリスティックへ変更（ジャンル分けフォルダーを
//     1作品に誤認しない）。自動生成はあくまで下書きで、ユーザー修正を前提とする
//   - シンボリックリンクのディレクトリは辿らない（循環防止）
import { existsSync, readdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import type {
  Cover,
  MetaFile,
  Playlist,
  ResolvedPlaylist,
  ScanResult,
  Track,
  UrlEntry,
  Work,
} from "@mimimilli/shared";
import {
  coverFieldsFromColumns,
  emptyDlsiteState,
  isRjCodeMissing,
  isInvalidTrackStart,
  resolveTrackDuration,
  toTrackDurationFields,
} from "@mimimilli/shared";
import type { Db } from "./db.ts";
import type { ScanOptions } from "../../adapter.ts";
import { detectRjCode } from "./dlsite.ts";
import { computeFingerprint, computeRawFingerprint } from "./fingerprint.ts";
import {
  isMetaFileName,
  META_FILE_NAME,
  MetaParseError,
  patchMetaFile,
  readMetaFile,
  readMetaFileRaw,
  writeMetaFile,
} from "./meta.ts";
import { migrateMetaIds } from "./metaIdMigration.ts";
import { excludeDescendantPaths, isPathWithin, toPortableRelativePath } from "./paths.ts";
import { probeDurationSec, type ProbeCacheEntry } from "./probe.ts";
import { createProgressThrottle } from "./progressThrottle.ts";
import { measureCoverDimensions, type CoverDimensions } from "./thumbnailCache.ts";
import type { CoverColumns, ScanWorkState, WorkRepo } from "./workRepo.ts";

const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "aac", "wav", "ogg", "flac", "webm", "opus"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp"]);

function extOf(name: string): string {
  return extname(name).slice(1).toLowerCase();
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "ja", { numeric: true, sensitivity: "base" });
}

/** walk 時に収集するディレクトリの直下情報（findWorkRoot の readdirSync 代替） */
interface DirEntryInfo {
  subdirCount: number;
  hasImage: boolean;
}

interface WalkResult {
  metaPaths: string[];
  /** メタファイル（いずれかの形式）が直接存在するディレクトリ */
  metaDirs: Set<string>;
  /** 音声ファイルが直接存在するディレクトリ */
  audioDirs: Set<string>;
  /** readdir に失敗したサブツリーのディレクトリパス（ルート失敗は例外） */
  unreadablePaths: string[];
  /** 走査済みディレクトリの直下サブフォルダー数・画像有無 */
  dirIndex: Map<string, DirEntryInfo>;
  /** 自身または配下にメタディレクトリがあるパス（findWorkRoot の swallowsMeta 判定用） */
  dirsWithMetaInSubtree: Set<string>;
}

/** ルートフォルダーの readdir 失敗。スキャン全体をエラー終了させ missing 更新を防ぐ。 */
export class ScanRootUnreadableError extends Error {
  constructor(root: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`ルートフォルダーを読み取れません: ${root}: ${detail}`);
    this.name = "ScanRootUnreadableError";
  }
}

/** walking フェーズの進捗を emit する間隔（ディレクトリ数）。頻繁すぎる emit を避けつつ、
 *  大規模ライブラリでも SSE の heartbeat・接続処理がイベントループを取り戻せる粒度にする */
const WALK_PROGRESS_INTERVAL = 50;

/** registering / generating フェーズの progress emit 間隔（ミリ秒）。件数ベースにすると
 *  1件あたりの処理時間の分散が大きく、遅い区間で進捗表示が長時間固まって見えるため時間ベースにする */
const PROGRESS_MIN_INTERVAL_MS = 200;

/**
 * ディレクトリ木を非同期に走査する。fs/promises の readdir は都度 I/O を挟むため、
 * 大規模ライブラリでも SSE 接続や heartbeat の処理がイベントループに割り込める
 * （readdirSync の同期ループは処理完了までイベントループを完全に塞いでしまう）。
 */
export class ScanCancelledError extends Error {
  constructor() {
    super("スキャンはキャンセルされました");
  }
}

function throwIfAborted(signal?: AbortSignal, abortToken?: Int32Array): void {
  if (signal?.aborted || (abortToken && Atomics.load(abortToken, 0) !== 0))
    throw new ScanCancelledError();
}

export async function walk(
  root: string,
  onDirVisited?: (visited: number) => void,
  signal?: AbortSignal,
  abortToken?: Int32Array,
): Promise<WalkResult> {
  const result: WalkResult = {
    metaPaths: [],
    metaDirs: new Set(),
    audioDirs: new Set(),
    unreadablePaths: [],
    dirIndex: new Map(),
    dirsWithMetaInSubtree: new Set(),
  };
  const stack = [root];
  let visited = 0;
  while (stack.length > 0) {
    throwIfAborted(signal, abortToken);
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (dir === root) throw new ScanRootUnreadableError(root, e);
      console.warn(`ディレクトリを読めません: ${dir}: ${(e as Error).message}`);
      result.unreadablePaths.push(dir);
      continue;
    }
    let subdirCount = 0;
    let hasImage = false;
    for (const entry of entries) {
      throwIfAborted(signal, abortToken);
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        subdirCount += 1;
        stack.push(full);
      } else if (entry.isFile()) {
        if (isMetaFileName(entry.name)) {
          result.metaPaths.push(full);
          result.metaDirs.add(dir);
          markDirsWithMetaInSubtree(dir, root, result.dirsWithMetaInSubtree);
        } else if (AUDIO_EXTENSIONS.has(extOf(entry.name))) {
          result.audioDirs.add(dir);
        } else if (IMAGE_EXTENSIONS.has(extOf(entry.name))) {
          hasImage = true;
        }
      }
      // シンボリックリンクは辿らない（循環防止）
    }
    result.dirIndex.set(dir, { subdirCount, hasImage });
    visited += 1;
    if (visited % WALK_PROGRESS_INTERVAL === 0) {
      onDirVisited?.(visited);
    }
  }
  result.metaPaths.sort(naturalCompare);
  return result;
}

/** メタディレクトリからルートまでの祖先を dirsWithMetaInSubtree に登録する */
function markDirsWithMetaInSubtree(
  metaDir: string,
  root: string,
  dirsWithMetaInSubtree: Set<string>,
): void {
  let cur = metaDir;
  while (isPathWithin(root, cur)) {
    dirsWithMetaInSubtree.add(cur);
    if (cur === root) break;
    cur = dirname(cur);
  }
}

/** dir またはルートまでの祖先にメタファイルがあるか */
function isCoveredByMeta(dir: string, root: string, metaDirs: Set<string>): boolean {
  let cur = dir;
  while (isPathWithin(root, cur)) {
    if (metaDirs.has(cur)) return true;
    if (cur === root) break;
    cur = dirname(cur);
  }
  return false;
}

/** 音声ディレクトリから作品ルートを推定する（保守的に昇格。walk インデックス参照）。
 *  walk 時点のディレクトリスナップショットで判定する（walk 後の FS 変更は反映しない）。 */
export function findWorkRoot(
  audioDir: string,
  root: string,
  dirsWithMetaInSubtree: Set<string>,
  dirIndex: Map<string, DirEntryInfo>,
): string {
  let cur = audioDir;
  while (true) {
    const parent = dirname(cur);
    if (cur === root || parent === cur || !isPathWithin(root, parent) || parent === root) break;

    // 親の下に既存メタ作品があるなら昇格しない（登録済み作品を飲み込まない）
    if (dirsWithMetaInSubtree.has(parent)) break;

    const info = dirIndex.get(parent);
    if (!info) break;

    // カバー画像同梱の典型構成（RJxxxx/cover.jpg + mp3/…）か、単一サブフォルダーのラッパーのみ昇格
    if (info.hasImage || info.subdirCount === 1) {
      cur = parent;
    } else {
      break;
    }
  }
  return cur;
}

function findCoverImage(dir: string): string | null {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn(`ディレクトリを読めません: ${dir}: ${(e as Error).message}`);
    return null;
  }
  const images = entries
    .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(extOf(e.name)))
    .map((e) => e.name)
    .sort(naturalCompare);
  const preferred = images.find((n) => {
    const lower = n.toLowerCase();
    return lower.includes("cover") || lower.includes("jacket");
  });
  return preferred ?? images[0] ?? null;
}

function collectAudioRecursive(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch (e) {
      console.warn(`ディレクトリを読めません: ${cur}: ${(e as Error).message}`);
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && AUDIO_EXTENSIONS.has(extOf(e.name))) out.push(full);
    }
  }
  return out;
}

/** 自動生成のトラック構築: 直下の音声を優先、無ければ最多の直下サブフォルダー（要件 v4 §3.5） */
function buildDefaultTracks(workDir: string): Track[] {
  const entries = readdirSync(workDir, { withFileTypes: true });
  const directAudio = entries
    .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(extOf(e.name)))
    .map((e) => join(workDir, e.name));

  let files: string[];
  if (directAudio.length > 0) {
    files = directAudio;
  } else {
    const bySubdir = entries
      .filter((e) => e.isDirectory())
      .map((e) => collectAudioRecursive(join(workDir, e.name)));
    bySubdir.sort((a, b) => b.length - a.length);
    files = bySubdir[0] ?? [];
  }

  files.sort(naturalCompare);
  return files.map((f) => ({
    id: crypto.randomUUID(),
    title: basename(f, extname(f)),
    file: toPortableRelativePath(workDir, f),
  }));
}

function defaultPlaylistOf(meta: MetaFile): Playlist | null {
  if (meta.playlists.length === 0) return null;
  if (meta.defaultPlaylistId) {
    return meta.playlists.find((p) => p.id === meta.defaultPlaylistId)!;
  }
  return meta.playlists[0]!;
}

const DEFAULT_UPSERT_BATCH_SIZE = 500;

interface UpsertItem {
  work: Work;
  fingerprint: string;
  cover: CoverColumns;
  metaPath: string;
}

/** upsertWork の呼び出しを一定件数ごとに user・catalog 各DBのトランザクションでまとめる（TASK-75, TASK-159）。
 *  user を先にコミットしてから catalog を書く（ADR-0008）。2DBは別ファイルのため集合としては原子的ではない。 */
class UpsertBatch {
  private queue: UpsertItem[] = [];
  private readonly db: Db;
  private readonly repo: WorkRepo;
  private readonly limit: number;
  private readonly checkAbort: () => void;

  constructor(db: Db, repo: WorkRepo, limit: number, checkAbort: () => void = () => {}) {
    this.db = db;
    this.repo = repo;
    this.limit = limit;
    this.checkAbort = checkAbort;
  }

  add(work: Work, fingerprint: string, cover: CoverColumns, metaPath: string): void {
    this.queue.push({ work, fingerprint, cover, metaPath });
    if (this.queue.length >= this.limit) {
      this.checkAbort();
      this.flush();
    }
  }

  flush(): void {
    this.checkAbort();
    if (this.queue.length === 0) return;
    const items = this.queue;
    this.db.userTransaction(() => {
      for (const item of items) {
        this.checkAbort();
        this.repo.upsertWorkUserState(item.work);
      }
    });
    this.checkAbort();
    this.db.transaction(() => {
      for (const item of items) {
        this.checkAbort();
        this.repo.upsertWorkCatalog(item.work, {
          metaPath: item.metaPath,
          fingerprint: item.fingerprint,
          cover: item.cover,
        });
      }
    });
    this.queue = [];
  }
}

interface PreparedMeta {
  kind: "ok";
  metaPath: string;
  meta: MetaFile;
  fingerprint: string;
  cachedFingerprint: string | undefined;
  /** DB上の前回スキャン時の status。error は fingerprint スキップの対象外（TASK-95）。 */
  cachedStatus: Work["status"] | undefined;
  /** カバー欠損判定（DBの寸法充足状況）。false ならfingerprint一致でも再処理が必要。 */
  coverSatisfied: boolean;
}

interface PreparedError {
  kind: "error";
  metaPath: string;
  error: MetaParseError;
}

interface PreparedSkip {
  kind: "skip";
  metaPath: string;
  id: string;
}

type PreparedEntry = PreparedMeta | PreparedError | PreparedSkip;

/** fingerprint 一致かつカバー充足のとき増分スキャンでスキップできるか（TASK-95）。 */
function canSkipIncremental(
  full: boolean,
  cachedFingerprint: string | undefined,
  fingerprint: string,
  coverSatisfied: boolean,
  cachedStatus: Work["status"] | undefined,
): boolean {
  if (full) return false;
  if (cachedStatus === "error") return false;
  return cachedFingerprint === fingerprint && coverSatisfied;
}

export interface ScannerOptions {
  /** upsertWork をバッチ化する件数上限。テスト用に変更可 */
  upsertBatchSize?: number;
  /** カバー寸法の計測関数。省略時は Sharp 実装。テスト用に差し替え可 */
  measureCover?: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>;
}

export class Scanner {
  private readonly db: Db;
  private readonly repo: WorkRepo;
  private readonly dataRoot: string;
  private readonly upsertBatchSize: number;
  private readonly measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>;

  constructor(db: Db, repo: WorkRepo, dataRoot: string, options?: ScannerOptions) {
    this.db = db;
    this.repo = repo;
    this.dataRoot = dataRoot;
    const upsertBatchSize = options?.upsertBatchSize ?? DEFAULT_UPSERT_BATCH_SIZE;
    if (!Number.isInteger(upsertBatchSize) || upsertBatchSize <= 0) {
      throw new RangeError("upsertBatchSize は有限の正整数である必要があります");
    }
    this.upsertBatchSize = upsertBatchSize;
    this.measureCover = options?.measureCover ?? measureCoverDimensions;
  }

  async scan(root: string, options?: ScanOptions): Promise<ScanResult> {
    root = resolve(root);
    const normalized = options ?? {};
    const full = normalized.full ?? false;
    const emit = normalized.onProgress ?? ((): void => {});
    const signal = normalized.signal;
    const abortToken = normalized.abortToken;
    const checkAbort = () => throwIfAborted(signal, abortToken);
    checkAbort();
    const result: ScanResult = {
      registered: 0,
      newlyGenerated: 0,
      errors: 0,
      missing: 0,
      newWorkIds: [],
      rjCodeMissingCount: 0,
      skipped: 0,
      coverErrors: 0,
    };

    // walking フェーズ: ディレクトリ走査自体は件数が事前に分からないため不定（total=0）で通知する
    emit({ type: "progress", phase: "walking", processed: 0, total: 0 });
    const tree = await walk(
      root,
      (visited) => {
        checkAbort();
        emit({ type: "progress", phase: "walking", processed: visited, total: 0 });
      },
      signal,
      abortToken,
    );
    checkAbort();
    const migration = migrateMetaIds({
      root,
      metaPaths: tree.metaPaths,
      dataRoot: this.dataRoot,
      throwIfCancelled: checkAbort,
    });
    if (migration.externallyModified.length > 0) {
      console.warn(
        `Playlist/Track ID移行: 外部編集を検出したため上書きしませんでした: ${migration.externallyModified.join(", ")}`,
      );
    }
    // 変更のない作品のPlaylist/Track関係は再生位置の解決にも使う。全削除してから
    // スキップすると関係だけ失われるため、変更作品のupsert時だけ置き換える。
    const seenIds = new Set<string>();
    const existingWorks = this.repo.getScanWorkMap();
    const existingByPhysicalPath = new Map(
      [...existingWorks].map(([id, state]) => [state.physicalPath, { id, state }]),
    );

    // 1. 既存メタファイルの登録
    emit({ type: "progress", phase: "registering", processed: 0, total: tree.metaPaths.length });

    // 1-a. メタを読み込み、fingerprint を計算する前処理パス。
    //      この時点では DB 書き込みやプローブは行わない。重複検出は後段の registerMetaFile で行う。
    const prepared = this.prepareMetaEntries(tree.metaPaths, existingWorks, full, checkAbort);

    // 1-b. fingerprint が不一致の作品だけのトラックパスを収集し、probe cache を一括取得する。
    //      これによりトラックごとの個別 SELECT が発生しなくなる（TASK-75）。
    const probeCache = this.buildProbeCache(prepared, full, checkAbort);

    // 1-c. 実際の登録処理。fingerprint 一致作品はスキップし、それ以外は probe cache を使って処理する。
    const batch = new UpsertBatch(this.db, this.repo, this.upsertBatchSize, checkAbort);
    const registeringThrottle = createProgressThrottle(PROGRESS_MIN_INTERVAL_MS);
    for (let i = 0; i < prepared.length; i++) {
      checkAbort();
      const entry = prepared[i]!;
      try {
        if (entry.kind === "error") {
          this.handleMetaParseError(
            entry.metaPath,
            entry.error,
            seenIds,
            result,
            existingWorks,
            existingByPhysicalPath,
          );
        } else if (entry.kind === "skip") {
          if (seenIds.has(entry.id)) {
            throw new MetaParseError(
              entry.metaPath,
              `Work IDが重複しています: ${entry.id}`,
              entry.id,
            );
          }
          seenIds.add(entry.id);
          result.skipped += 1;
        } else {
          const outcome = await this.registerMetaFile(
            entry,
            seenIds,
            probeCache,
            batch,
            existingWorks,
            result,
            full,
            checkAbort,
          );
          if (outcome === "skipped") {
            result.skipped += 1;
          } else {
            result.registered += 1;
          }
        }
      } catch (e) {
        if (e instanceof MetaParseError) {
          this.handleMetaParseError(
            entry.metaPath,
            e,
            seenIds,
            result,
            existingWorks,
            existingByPhysicalPath,
          );
        } else {
          throw e;
        }
      }
      const processed = i + 1;
      if (registeringThrottle(processed, tree.metaPaths.length)) {
        emit({ type: "progress", phase: "registering", processed, total: tree.metaPaths.length });
      }
    }
    checkAbort();
    batch.flush();

    // 2. メタファイルのない音声フォルダーへ自動生成（下書き）
    const workRoots = new Set<string>();
    for (const audioDir of tree.audioDirs) {
      checkAbort();
      if (isCoveredByMeta(audioDir, root, tree.metaDirs)) continue;
      // ルート直下に直接置かれた音声（単一ファイル形式）は自動生成の対象外（要件 v4 §3.5）
      if (audioDir === root) continue;
      workRoots.add(findWorkRoot(audioDir, root, tree.dirsWithMetaInSubtree, tree.dirIndex));
    }
    // 祖先が同時に検出された場合は祖先側に統合する（深さ昇順+採用済み祖先Setで線形化。TASK-62）
    const roots = excludeDescendantPaths(workRoots).sort(naturalCompare);

    emit({ type: "progress", phase: "generating", processed: 0, total: roots.length });
    const generated: Array<{ id: string; prepared: PreparedMeta }> = [];
    const generatingThrottle = createProgressThrottle(PROGRESS_MIN_INTERVAL_MS);
    for (let i = 0; i < roots.length; i++) {
      checkAbort();
      const workDir = roots[i]!;
      try {
        const id = this.generateMetaForFolder(workDir);
        generated.push({ id, prepared: this.prepareSingleMeta(join(workDir, META_FILE_NAME)) });
      } catch (e) {
        console.warn(`メタファイルの自動生成に失敗: ${workDir}: ${(e as Error).message}`);
        result.errors += 1;
      }
      const processed = i + 1;
      if (generatingThrottle(processed, roots.length)) {
        emit({ type: "progress", phase: "generating", processed, total: roots.length });
      }
    }
    // 自動生成分もまとめてcacheを読む。cache hit時を含め、track単位のSELECTを発生させない。
    const generatedProbeCache = this.buildProbeCache(
      generated.map((entry) => entry.prepared),
      full,
      checkAbort,
    );
    for (const entry of generated) {
      checkAbort();
      try {
        await this.registerMetaFile(
          entry.prepared,
          seenIds,
          generatedProbeCache,
          batch,
          existingWorks,
          result,
          full,
          checkAbort,
        );
        result.newlyGenerated += 1;
        result.newWorkIds.push(entry.id);
      } catch (e) {
        if (!(e instanceof MetaParseError)) throw e;
        console.warn(
          `メタファイルの自動生成に失敗: ${dirname(entry.prepared.metaPath)}: ${(e as Error).message}`,
        );
        result.errors += 1;
      }
    }
    checkAbort();
    batch.flush();

    checkAbort();
    emit({ type: "progress", phase: "finalizing", processed: 0, total: 1 });
    normalized.beforeFinalize?.();
    checkAbort();
    if (tree.unreadablePaths.length > 0) {
      result.unreadablePaths = tree.unreadablePaths;
      console.warn(`読み取れなかったディレクトリ: ${tree.unreadablePaths.join(", ")}`);
      for (const [id, state] of existingWorks) {
        if (seenIds.has(id)) continue;
        if (tree.unreadablePaths.some((prefix) => isPathWithin(prefix, state.physicalPath))) {
          seenIds.add(id);
        }
      }
    }
    this.repo.markMissingExcept([...seenIds]);
    result.missing = this.repo.countByStatus("missing");
    result.rjCodeMissingCount = this.repo
      .listSummaries()
      .filter((work) => isRjCodeMissing(work.dlsite)).length;
    emit({ type: "progress", phase: "finalizing", processed: 1, total: 1 });
    return result;
  }

  /** メタファイルを前処理する。エラーは収集して後段で処理し、正常なものは fingerprint 付きで返す。 */
  private prepareMetaEntries(
    metaPaths: string[],
    existingWorks: Map<string, ScanWorkState>,
    full: boolean,
    checkAbort: () => void = () => {},
  ): PreparedEntry[] {
    const prepared: PreparedEntry[] = [];

    for (const metaPath of metaPaths) {
      checkAbort();
      try {
        const raw = readMetaFileRaw(metaPath);
        const rawFingerprint = computeRawFingerprint(metaPath, raw);
        if (rawFingerprint) {
          const state = existingWorks.get(rawFingerprint.id);
          // カバー欠損を早期skipより前に判定する。skip許可は「メタ無カバー&DB無カバー」
          // または「メタ有カバー&DB両正寸法」のみ。それ以外はカバー再計測のため再登録する。
          const coverSatisfied =
            rawFingerprint.coverImage === null
              ? state?.cover.image == null
              : state?.cover.dimensions != null;
          if (
            canSkipIncremental(
              full,
              state?.fingerprint ?? undefined,
              rawFingerprint.fingerprint,
              coverSatisfied,
              state?.status,
            )
          ) {
            prepared.push({ kind: "skip", metaPath, id: rawFingerprint.id });
            continue;
          }
        }

        // fingerprint不一致時だけ厳密なスキーマ検証を行う。これにより、機械的な
        // createdAt等を除く完全未変更作品ではZodの全件検証を避けられる。
        const meta = readMetaFile(metaPath);
        const fingerprint = computeFingerprint(metaPath, meta);
        const state = existingWorks.get(meta.id);
        const cachedFingerprint = state?.fingerprint ?? undefined;
        const coverSatisfied =
          meta.coverImage === null ? state?.cover.image == null : state?.cover.dimensions != null;
        prepared.push({
          kind: "ok",
          metaPath,
          meta,
          fingerprint,
          cachedFingerprint,
          cachedStatus: state?.status,
          coverSatisfied,
        });
      } catch (e) {
        if (e instanceof MetaParseError) {
          prepared.push({ kind: "error", metaPath, error: e });
        } else {
          throw e;
        }
      }
    }

    return prepared;
  }

  /** 自動生成後の1件だけを前処理する */
  private prepareSingleMeta(metaPath: string): PreparedMeta {
    const meta = readMetaFile(metaPath);
    const fingerprint = computeFingerprint(metaPath, meta);
    return {
      kind: "ok",
      metaPath,
      meta,
      fingerprint,
      cachedFingerprint: undefined,
      cachedStatus: undefined,
      // 自動生成直後のメタにはまだDB行が無く、coverSatisfiedの意味を持たない
      // （cachedFingerprintがundefinedのため下のcachedFingerprint===fingerprint判定で必ずfalseになる）
      coverSatisfied: false,
    };
  }

  /** fingerprint が不一致の作品のトラックパスから probe cache を一括取得する */
  private buildProbeCache(
    prepared: PreparedEntry[],
    full: boolean,
    checkAbort: () => void = () => {},
  ): Map<string, ProbeCacheEntry> {
    if (full) return new Map();
    const trackPaths: string[] = [];
    for (const entry of prepared) {
      checkAbort();
      if (entry.kind !== "ok") continue;
      if (
        canSkipIncremental(
          full,
          entry.cachedFingerprint,
          entry.fingerprint,
          entry.coverSatisfied,
          entry.cachedStatus,
        )
      )
        continue;
      // error 作品は再評価時に cache を使わず再 probe する（TASK-95）。
      if (entry.cachedStatus === "error") continue;
      const workDir = dirname(entry.metaPath);
      // 詳細DTOは全playlistを返すため、デフォルト以外も含め全playlistのトラックをprobeする。
      // end指定済みトラックもstart/endのファイル長超過チェックにファイル長が要るためprobe対象に含める。
      for (const playlist of entry.meta.playlists) {
        for (const track of playlist.tracks) {
          checkAbort();
          trackPaths.push(join(workDir, track.file));
        }
      }
    }
    return this.repo.fetchProbeCache(trackPaths);
  }

  private handleMetaParseError(
    metaPath: string,
    error: MetaParseError,
    seenIds: Set<string>,
    result: ScanResult,
    existingWorks: Map<string, ScanWorkState>,
    existingByPhysicalPath: Map<string, { id: string; state: ScanWorkState }>,
  ): void {
    console.warn(error.message);
    const workDir = dirname(metaPath);
    const existingById =
      error.candidateId && !seenIds.has(error.candidateId)
        ? existingWorks.get(error.candidateId)
          ? { id: error.candidateId, state: existingWorks.get(error.candidateId)! }
          : null
        : null;
    const existing = existingById ?? existingByPhysicalPath.get(workDir) ?? null;
    if (existing) {
      this.repo.markWorkError(existing.id, workDir, metaPath, error.message);
      seenIds.add(existing.id);
    }
    result.errors += 1;
  }

  /** メタファイル1件を DB に登録する（ID 突合・欠損検出・duration プローブ込み） */
  private async registerMetaFile(
    prepared: PreparedMeta,
    seenIds: Set<string>,
    probeCache: Map<string, ProbeCacheEntry>,
    batch: UpsertBatch,
    existingWorks: Map<string, ScanWorkState>,
    result: ScanResult,
    full: boolean,
    checkAbort: () => void = () => {},
  ): Promise<"skipped" | string> {
    const { metaPath, meta, fingerprint, cachedFingerprint, cachedStatus, coverSatisfied } =
      prepared;
    const workDir = dirname(metaPath);
    const id = meta.id;

    // 同一スキャン内での重複検出（migrateMetaIds 後のセーフティネット）
    if (seenIds.has(id)) {
      throw new MetaParseError(metaPath, `Work IDが重複しています: ${id}`, id);
    }
    seenIds.add(id);

    // fingerprint 一致かつカバー寸法も充足済みなら完全未変更として、プローブ・upsertWork を省略する
    if (canSkipIncremental(full, cachedFingerprint, fingerprint, coverSatisfied, cachedStatus)) {
      return "skipped";
    }

    const probeCacheForWork =
      full || cachedStatus === "error" ? new Map<string, ProbeCacheEntry>() : probeCache;

    // 参照先ファイルの欠損チェック
    const playlist = defaultPlaylistOf(meta);
    const missingFiles = (playlist?.tracks ?? []).filter((t) => !existsSync(join(workDir, t.file)));

    // 全playlistのトラックについて解決済みdurationSecを求める（DTO・total・resume検証で共有する式）。
    // startがファイル全体長以上（データ不正、区間長が0以下になる）のトラックはresolveTrackDurationSecが
    // nullを返すためDTO契約は破らないが、可視化のため作品をerror状態にするべく別途収集する。
    // end超過はコンテナメタデータとデコード実測値の数十msのズレで健全なデータでも起こりうるため判定しない。
    // end指定トラックもstart超過チェックにファイル長が要るため（同一ファイルはfileDurationCacheで1回に集約）probeする。
    const invalidStartTracks: Array<{ file: string; title: string }> = [];
    const fileProbeCache = new Map<string, Awaited<ReturnType<typeof probeDurationSec>>>();
    const resolvedPlaylists: ResolvedPlaylist[] = [];
    for (const p of meta.playlists) {
      const tracks = [];
      for (const track of p.tracks) {
        checkAbort();
        let probe;
        if (fileProbeCache.has(track.file)) {
          probe = fileProbeCache.get(track.file)!;
        } else {
          probe = await probeDurationSec(
            this.db.catalog,
            join(workDir, track.file),
            probeCacheForWork,
          );
          checkAbort();
          fileProbeCache.set(track.file, probe);
        }
        if (probe.kind === "resolved" && isInvalidTrackStart(track, probe.durationSec)) {
          invalidStartTracks.push({ file: track.file, title: track.title });
        }
        tracks.push({ ...track, ...toTrackDurationFields(resolveTrackDuration(track, probe)) });
      }
      resolvedPlaylists.push({ id: p.id, name: p.name, tracks });
    }

    const errorMessage =
      missingFiles.length > 0
        ? `参照先ファイルが見つかりません: ${missingFiles.map((t) => t.file).join(", ")}`
        : invalidStartTracks.length > 0
          ? `トラックの開始位置がファイル長を超えています: ${invalidStartTracks
              .map((t) => `${t.title}(${t.file})`)
              .join(", ")}`
          : null;

    // 再生時間（デフォルトプレイリストの合計）。未解決（null）トラックを1件でも含む場合は
    // 合計自体も未知として null にする（部分和を完全な総時間として保存しない）。
    const defaultResolved =
      resolvedPlaylists.find((p) => p.id === meta.defaultPlaylistId) ?? resolvedPlaylists[0];
    const defaultTracks = defaultResolved?.tracks ?? [];
    const totalDurationSec = defaultTracks.some((track) => track.durationSec === null)
      ? null
      : defaultTracks.reduce((sum, track) => sum + track.durationSec!, 0);

    // 既存作品の DB 固有情報を保持（移動追従時も含む）
    const existing = existingWorks.get(id);
    const detectedRjCode = meta.dlsite.rjCode ?? detectRjCode([basename(workDir), meta.title]);
    let dlsite = meta.dlsite;
    if (detectedRjCode !== meta.dlsite.rjCode) {
      checkAbort();
      dlsite = { ...meta.dlsite, rjCode: detectedRjCode };
      patchMetaFile(metaPath, { dlsite });
      checkAbort();
    }
    // カバー寸法を計測する（DBトランザクション外。成功した寸法だけを1回のupsertへ渡す）。
    // 画像はあるが計測できない場合は寸法NULLで記録し、coverErrorsを数えて次回スキャンで再試行する。
    const cover: CoverColumns = { image: meta.coverImage, dimensions: null };
    if (meta.coverImage) {
      checkAbort();
      const dimensions = await this.measureCover(join(workDir, meta.coverImage));
      checkAbort();
      if (dimensions) cover.dimensions = dimensions;
      else result.coverErrors += 1;
    }
    const workCover: Cover =
      cover.image !== null && cover.dimensions !== null
        ? { image: cover.image, dimensions: cover.dimensions }
        : null;
    const { coverKind, coverImage } = coverFieldsFromColumns(
      cover.image,
      cover.dimensions?.width ?? null,
      cover.dimensions?.height ?? null,
    );

    // メタへの書き戻し（RJコード等）があった場合、保存する fingerprint は書き戻し後の内容に合わせる
    const finalFingerprint = computeFingerprint(metaPath, { ...meta, dlsite });
    const work: Work = {
      id,
      title: meta.title,
      cover: workCover,
      coverKind,
      coverImage,
      defaultPlaylistId: meta.defaultPlaylistId,
      createdAt: meta.createdAt ?? null,
      status: errorMessage ? "error" : "ok",
      physicalPath: workDir,
      totalDurationSec,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      errorMessage,
      urls: meta.urls,
      tags: meta.tags,
      playlists: resolvedPlaylists,
      bookmarked: existing?.bookmarked ?? false,
      lastPlayedAt: existing?.lastPlayedAt ?? null,
      resume: existing?.resume ?? null,
      dlsite,
    };
    checkAbort();
    batch.add(work, finalFingerprint, cover, metaPath);
    return id;
  }

  /** 手動登録: 指定フォルダーへ mimimilli.json を生成し DB に登録する */
  async registerFolderWork(
    workDir: string,
    options: {
      title: string;
      tags?: string[];
      urls?: UrlEntry[];
      coverImage?: string | null;
      dlsite?: MetaFile["dlsite"];
    },
  ): Promise<Work> {
    const metaPath = join(workDir, META_FILE_NAME);
    if (existsSync(metaPath)) {
      throw new Error("このフォルダーには既にメタファイルがあります");
    }

    const tracks = buildDefaultTracks(workDir);
    const playlistId = tracks.length > 0 ? crypto.randomUUID() : null;
    const meta: MetaFile = {
      id: crypto.randomUUID(),
      title: options.title,
      urls: options.urls ?? [],
      tags: options.tags ?? [],
      coverImage: options.coverImage !== undefined ? options.coverImage : findCoverImage(workDir),
      playlists: playlistId ? [{ id: playlistId, name: "default", tracks }] : [],
      defaultPlaylistId: playlistId,
      createdAt: new Date().toISOString(),
      dlsite: options.dlsite ?? emptyDlsiteState(),
    };
    writeMetaFile(metaPath, meta);

    const prepared = this.prepareSingleMeta(metaPath);
    const existingWorks = this.repo.getScanWorkMap();
    const batch = new UpsertBatch(this.db, this.repo, this.upsertBatchSize, () => {});
    const scanResult: Pick<ScanResult, "coverErrors"> = { coverErrors: 0 };
    const seenIds = new Set<string>();
    await this.registerMetaFile(
      prepared,
      seenIds,
      new Map(),
      batch,
      existingWorks,
      scanResult as ScanResult,
      true,
    );
    batch.flush();

    const work = await this.repo.getWork(meta.id);
    if (!work) throw new Error("登録した作品の取得に失敗しました");
    return work;
  }

  /** 孤立メタの復元: 既存 mimimilli.json を保持し DB へ再登録する */
  async restoreFolderWork(
    workDir: string,
    patch: {
      title?: string;
      tags?: string[];
      urls?: UrlEntry[];
      coverImage?: string | null;
      dlsite?: MetaFile["dlsite"];
    },
  ): Promise<Work> {
    const metaPath = join(workDir, META_FILE_NAME);
    if (!existsSync(metaPath)) {
      throw new Error("復元対象のメタファイルがありません");
    }

    const metaBefore = readMetaFile(metaPath);
    const metaId = metaBefore.id;

    const metaPatch: typeof patch = {};
    if (patch.title !== undefined) metaPatch.title = patch.title;
    if (patch.tags !== undefined) metaPatch.tags = patch.tags;
    if (patch.urls !== undefined) metaPatch.urls = patch.urls;
    if (patch.coverImage !== undefined) metaPatch.coverImage = patch.coverImage;
    if (patch.dlsite !== undefined) metaPatch.dlsite = patch.dlsite;
    if (Object.keys(metaPatch).length > 0) {
      patchMetaFile(metaPath, metaPatch);
    }

    const prepared = this.prepareSingleMeta(metaPath);
    const existingWorks = this.repo.getScanWorkMap();
    const batch = new UpsertBatch(this.db, this.repo, this.upsertBatchSize, () => {});
    const scanResult: Pick<ScanResult, "coverErrors"> = { coverErrors: 0 };
    const seenIds = new Set<string>();
    await this.registerMetaFile(
      prepared,
      seenIds,
      new Map(),
      batch,
      existingWorks,
      scanResult as ScanResult,
      true,
    );
    batch.flush();

    const work = await this.repo.getWork(metaId);
    if (!work) throw new Error("復元した作品の取得に失敗しました");
    return work;
  }

  /** 音声フォルダーへメタファイルを自動生成する（要件 v4 §3.5。あくまで下書き） */
  private generateMetaForFolder(workDir: string): string {
    const id = crypto.randomUUID();
    const tracks = buildDefaultTracks(workDir);
    const playlistId = tracks.length > 0 ? crypto.randomUUID() : null;
    const meta: MetaFile = {
      id,
      title: basename(workDir),
      urls: [],
      tags: [],
      coverImage: findCoverImage(workDir),
      playlists: playlistId ? [{ id: playlistId, name: "default", tracks }] : [],
      defaultPlaylistId: playlistId,
      createdAt: new Date().toISOString(),
      dlsite: emptyDlsiteState(),
    };
    writeMetaFile(join(workDir, META_FILE_NAME), meta);
    return id;
  }
}
