// ライブラリスキャン。
//
// フロー（要件 v4 §8 / HANDOFF.md）:
//   1. 全作品を「行方不明」にマーク
//   2. ルート以下を走査し、メタファイル（.meta.json / *.meta.json）を登録
//      - ID で突合し、移動・リネームに追従（DB の既存情報を保持）
//      - 同一 UUID の重複は後に検出された方を再採番してメタファイルへ書き戻す
//      - 参照先音声の欠損は status "error" + errorMessage
//      - 再生時間は music-metadata でプローブし SQLite にキャッシュ
//   3. メタファイルのない音声フォルダーへ .meta.json を自動生成（下書き）
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
import { basename, dirname, extname, join } from "node:path";
import type {
  Cover,
  MetaFile,
  Playlist,
  ResolvedPlaylist,
  ScanProgressEvent,
  ScanResult,
  Track,
  Work,
} from "@mimimilli/shared";
import { emptyDlsiteState, isRjCodeMissing, resolveTrackDurationSec } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import type { ScanOptions } from "../../adapter.ts";
import { detectRjCode } from "./dlsite.ts";
import { computeFingerprint, computeRawFingerprint } from "./fingerprint.ts";
import {
  isMetaFileName,
  MetaParseError,
  patchMetaFile,
  readMetaFile,
  readMetaFileRaw,
  writeMetaFile,
} from "./meta.ts";
import { migrateMetaIds } from "./metaIdMigration.ts";
import { excludeDescendantPaths, isPathWithin, toPortableRelativePath } from "./paths.ts";
import { probeDurationSec, type ProbeCacheEntry } from "./probe.ts";
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

interface WalkResult {
  metaPaths: string[];
  /** メタファイル（いずれかの形式）が直接存在するディレクトリ */
  metaDirs: Set<string>;
  /** 音声ファイルが直接存在するディレクトリ */
  audioDirs: Set<string>;
}

/** walking フェーズの進捗を emit する間隔（ディレクトリ数）。頻繁すぎる emit を避けつつ、
 *  大規模ライブラリでも SSE の heartbeat・接続処理がイベントループを取り戻せる粒度にする */
const WALK_PROGRESS_INTERVAL = 50;

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

async function walk(
  root: string,
  onDirVisited?: (visited: number) => void,
  signal?: AbortSignal,
  abortToken?: Int32Array,
): Promise<WalkResult> {
  const result: WalkResult = { metaPaths: [], metaDirs: new Set(), audioDirs: new Set() };
  const stack = [root];
  let visited = 0;
  while (stack.length > 0) {
    throwIfAborted(signal, abortToken);
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (e) {
      console.warn(`ディレクトリを読めません: ${dir}: ${(e as Error).message}`);
      continue;
    }
    for (const entry of entries) {
      throwIfAborted(signal, abortToken);
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        if (isMetaFileName(entry.name)) {
          result.metaPaths.push(full);
          result.metaDirs.add(dir);
        } else if (AUDIO_EXTENSIONS.has(extOf(entry.name))) {
          result.audioDirs.add(dir);
        }
      }
      // シンボリックリンクは辿らない（循環防止）
    }
    visited += 1;
    if (visited % WALK_PROGRESS_INTERVAL === 0) {
      onDirVisited?.(visited);
    }
  }
  result.metaPaths.sort(naturalCompare);
  return result;
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

/** 音声ディレクトリから作品ルートを推定する（保守的に昇格） */
function findWorkRoot(audioDir: string, root: string, metaDirs: Set<string>): string {
  let cur = audioDir;
  while (true) {
    const parent = dirname(cur);
    if (cur === root || parent === cur || !isPathWithin(root, parent) || parent === root) break;

    // 親の下に既存メタ作品があるなら昇格しない（登録済み作品を飲み込まない）
    let swallowsMeta = false;
    for (const metaDir of metaDirs) {
      if (isPathWithin(parent, metaDir)) {
        swallowsMeta = true;
        break;
      }
    }
    if (swallowsMeta) break;

    let entries;
    try {
      entries = readdirSync(parent, { withFileTypes: true });
    } catch {
      break;
    }
    const subdirCount = entries.filter((e) => e.isDirectory()).length;
    const hasImage = entries.some((e) => e.isFile() && IMAGE_EXTENSIONS.has(extOf(e.name)));

    // カバー画像同梱の典型構成（RJxxxx/cover.jpg + mp3/…）か、単一サブフォルダーのラッパーのみ昇格
    if (hasImage || subdirCount === 1) {
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
  } catch {
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
    } catch {
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
}

/** upsertWork の呼び出しを一定件数ごとに catalog トランザクションでまとめる（TASK-75）。
 *  バッチ途中で失敗すればトランザクションがロールバックされ、不整合な status を残さない。 */
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

  add(work: Work, fingerprint: string, cover: CoverColumns): void {
    this.queue.push({ work, fingerprint, cover });
    if (this.queue.length >= this.limit) {
      this.checkAbort();
      this.flush();
    }
  }

  flush(): void {
    this.checkAbort();
    if (this.queue.length === 0) return;
    const items = this.queue;
    this.db.transaction(() => {
      for (const item of items) {
        this.checkAbort();
        this.repo.upsertWork(item.work, { fingerprint: item.fingerprint, cover: item.cover });
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

  async scan(
    root: string,
    options?: ScanOptions | ((event: ScanProgressEvent) => void),
  ): Promise<ScanResult> {
    const normalized = typeof options === "function" ? { onProgress: options } : (options ?? {});
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
    const prepared = this.prepareMetaEntries(tree.metaPaths, existingWorks, checkAbort);

    // 1-b. fingerprint が不一致の作品だけのトラックパスを収集し、probe cache を一括取得する。
    //      これによりトラックごとの個別 SELECT が発生しなくなる（TASK-75）。
    const probeCache = this.buildProbeCache(prepared, checkAbort);

    // 1-c. 実際の登録処理。fingerprint 一致作品はスキップし、それ以外は probe cache を使って処理する。
    const batch = new UpsertBatch(this.db, this.repo, this.upsertBatchSize, checkAbort);
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
      emit({
        type: "progress",
        phase: "registering",
        processed: i + 1,
        total: tree.metaPaths.length,
      });
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
      workRoots.add(findWorkRoot(audioDir, root, tree.metaDirs));
    }
    // 祖先が同時に検出された場合は祖先側に統合する（深さ昇順+採用済み祖先Setで線形化。TASK-62）
    const roots = excludeDescendantPaths(workRoots).sort(naturalCompare);

    emit({ type: "progress", phase: "generating", processed: 0, total: roots.length });
    const generated: Array<{ id: string; prepared: PreparedMeta }> = [];
    for (let i = 0; i < roots.length; i++) {
      checkAbort();
      const workDir = roots[i]!;
      try {
        const id = this.generateMetaForFolder(workDir);
        generated.push({ id, prepared: this.prepareSingleMeta(join(workDir, ".meta.json")) });
      } catch (e) {
        console.warn(`メタファイルの自動生成に失敗: ${workDir}: ${(e as Error).message}`);
        result.errors += 1;
      }
      emit({ type: "progress", phase: "generating", processed: i + 1, total: roots.length });
    }
    // 自動生成分もまとめてcacheを読む。cache hit時を含め、track単位のSELECTを発生させない。
    const generatedProbeCache = this.buildProbeCache(
      generated.map((entry) => entry.prepared),
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
          const fingerprintMatch = state?.fingerprint === rawFingerprint.fingerprint;
          // カバー欠損を早期skipより前に判定する。skip許可は「メタ無カバー&DB無カバー」
          // または「メタ有カバー&DB両正寸法」のみ。それ以外はカバー再計測のため再登録する。
          const coverSatisfied =
            rawFingerprint.coverImage === null
              ? state?.cover.image == null
              : state?.cover.dimensions != null;
          if (fingerprintMatch && coverSatisfied) {
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
      // 自動生成直後のメタにはまだDB行が無く、coverSatisfiedの意味を持たない
      // （cachedFingerprintがundefinedのため下のcachedFingerprint===fingerprint判定で必ずfalseになる）
      coverSatisfied: false,
    };
  }

  /** fingerprint が不一致の作品のトラックパスから probe cache を一括取得する */
  private buildProbeCache(
    prepared: PreparedEntry[],
    checkAbort: () => void = () => {},
  ): Map<string, ProbeCacheEntry> {
    const trackPaths: string[] = [];
    for (const entry of prepared) {
      checkAbort();
      if (entry.kind !== "ok") continue;
      if (entry.cachedFingerprint === entry.fingerprint) continue; // スキップ対象
      const workDir = dirname(entry.metaPath);
      // 詳細DTOは全playlistを返すため、デフォルト以外も含め全playlistのトラックをprobeする。
      // end指定済みトラックはファイル全体長が不要なためprobe対象から外す。
      for (const playlist of entry.meta.playlists) {
        for (const track of playlist.tracks) {
          checkAbort();
          if (track.end !== undefined) continue;
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
      this.repo.markWorkError(existing.id, workDir, error.message);
      seenIds.add(existing.id);
    }
    result.errors += 1;
  }

  /** メタファイル1件を DB に登録する（ID 突合・欠損検出・duration プローブ込み） */
  private async registerMetaFile(
    prepared: PreparedMeta,
    seenIds: Set<string>,
    probeCache: Map<string, ProbeCacheEntry> | undefined,
    batch: UpsertBatch,
    existingWorks: Map<string, ScanWorkState>,
    result: ScanResult,
    checkAbort: () => void = () => {},
  ): Promise<"skipped" | string> {
    const { metaPath, meta, fingerprint, cachedFingerprint, coverSatisfied } = prepared;
    const workDir = dirname(metaPath);
    const id = meta.id;

    // 同一スキャン内での重複検出（migrateMetaIds 後のセーフティネット）
    if (seenIds.has(id)) {
      throw new MetaParseError(metaPath, `Work IDが重複しています: ${id}`, id);
    }
    seenIds.add(id);

    // fingerprint 一致かつカバー寸法も充足済みなら完全未変更として、プローブ・upsertWork を省略する
    if (cachedFingerprint === fingerprint && coverSatisfied) {
      return "skipped";
    }

    // 参照先ファイルの欠損チェック
    const playlist = defaultPlaylistOf(meta);
    const missingFiles = (playlist?.tracks ?? []).filter((t) => !existsSync(join(workDir, t.file)));

    // 全playlistのトラックについて解決済みdurationSecを求める（DTO・total・resume検証で共有する式）。
    // startがファイル全体長以上（データ不正）のトラックはresolveTrackDurationSecがnullを返すため
    // DTO契約は破らないが、可視化のため作品をerror状態にするべく別途収集する。
    const invalidStartTracks: Array<{ file: string; title: string }> = [];
    const resolvedPlaylists: ResolvedPlaylist[] = [];
    for (const p of meta.playlists) {
      const tracks = [];
      for (const track of p.tracks) {
        checkAbort();
        let fileDurationSec: number | null = null;
        if (track.end === undefined) {
          fileDurationSec = await probeDurationSec(
            this.db.catalog,
            join(workDir, track.file),
            probeCache,
          );
          checkAbort();
          if (fileDurationSec !== null && fileDurationSec - (track.start ?? 0) <= 0) {
            invalidStartTracks.push({ file: track.file, title: track.title });
          }
        }
        tracks.push({ ...track, durationSec: resolveTrackDurationSec(track, fileDurationSec) });
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

    // メタへの書き戻し（RJコード等）があった場合、保存する fingerprint は書き戻し後の内容に合わせる
    const finalFingerprint = computeFingerprint(metaPath, { ...meta, dlsite });
    const work: Work = {
      id,
      title: meta.title,
      cover: workCover,
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
    batch.add(work, finalFingerprint, cover);
    return id;
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
    writeMetaFile(join(workDir, ".meta.json"), meta);
    return id;
  }
}
