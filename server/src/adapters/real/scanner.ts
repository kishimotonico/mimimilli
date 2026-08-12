// ライブラリスキャン。
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type {
  MetaFile,
  NormalizedTag,
  ScanDiagnostic,
  ScanResult,
  UrlEntry,
  Work,
} from "@mimimilli/shared";
import { isRjCodeMissing } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import type { ScanOptions } from "../../adapter/index.ts";
import {
  META_FILE_NAME,
  MetaParseError,
  patchMetaFileCas,
  readMetaSource,
  reassignMetaIdsOnDbCollision,
  writeMetaFile,
} from "./meta.ts";
import type { SeenMetaIds } from "./duplicateMetaIdRepair.ts";
import { excludeDescendantPaths, toPortableRelativePath } from "./paths.ts";
import { isPathWithin } from "../../lib/path.ts";
import { createProgressThrottle } from "./progressThrottle.ts";
import { measureCoverDimensions, type CoverDimensions } from "./thumbnailCache.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { ScanWorkState } from "./workRowMapping.ts";
import { getWorkWithLiveProbe } from "./workRefresh.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import { naturalCompare } from "./naturalCompare.ts";
import { createDraftMetaFile } from "./scanMetaDraft.ts";
import { recoverStagedMetaFiles } from "./scanMetaStagingRecovery.ts";
import {
  buildProbeCache,
  handleMetaParseError,
  prepareMetaEntries,
  prepareSingleMeta,
  registerMetaFile,
} from "./scanRegister.ts";
import { ScanUpsertBatch } from "./scanUpsertBatch.ts";
import type { PreparedMeta } from "./scanTypes.ts";
import {
  findWorkRoot,
  isCoveredByMeta,
  throwIfAborted,
  walk,
  type ScannerAbortHooks,
  type WalkResult,
} from "./scanWalk.ts";

const scanLogger = getCategoryLogger("scan");

const DEFAULT_UPSERT_BATCH_SIZE = 500;

const PROGRESS_MIN_INTERVAL_MS = 200;

function findIdentityConflicts(root: string, metaPaths: string[]): ScanDiagnostic[] {
  const pathsByWorkId = new Map<string, string[]>();
  for (const metaPath of metaPaths) {
    try {
      const value: unknown = JSON.parse(readFileSync(metaPath, "utf-8"));
      if (typeof value !== "object" || value === null || !("id" in value)) continue;
      if (typeof value.id !== "string") continue;
      const paths = pathsByWorkId.get(value.id) ?? [];
      paths.push(toPortableRelativePath(root, dirname(metaPath)));
      pathsByWorkId.set(value.id, paths);
    } catch {
      // 不正JSONは登録フェーズで parse error として扱う。
    }
  }
  return [...pathsByWorkId]
    .filter(([, paths]) => paths.length > 1)
    .sort(([a], [b]) => naturalCompare(a, b))
    .map(([workId, paths]) => ({
      kind: "identity_conflict",
      workId,
      paths: paths.sort(naturalCompare),
    }));
}

export interface WorkPersistence {
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  user: UserWorkStateRepository;
}

export interface ScannerOptions {
  upsertBatchSize?: number;
  measureCover?: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>;
}

export class Scanner {
  private readonly db: Db;
  private readonly query: WorkQueryRepository;
  private readonly catalog: CatalogWorkRepository;
  private readonly user: UserWorkStateRepository;
  private readonly upsertBatchSize: number;
  private readonly measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>;

  constructor(db: Db, repos: WorkPersistence, options?: ScannerOptions) {
    this.db = db;
    this.query = repos.query;
    this.catalog = repos.catalog;
    this.user = repos.user;
    const upsertBatchSize = options?.upsertBatchSize ?? DEFAULT_UPSERT_BATCH_SIZE;
    if (!Number.isInteger(upsertBatchSize) || upsertBatchSize <= 0) {
      throw new RangeError("upsertBatchSize は有限の正整数である必要があります");
    }
    this.upsertBatchSize = upsertBatchSize;
    this.measureCover = options?.measureCover ?? measureCoverDimensions;
  }

  async scan(
    root: string,
    options?: ScanOptions,
    abortHooks?: ScannerAbortHooks,
  ): Promise<ScanResult> {
    root = resolve(root);
    const normalized = options ?? {};
    const full = normalized.full ?? false;
    const emit = normalized.onProgress ?? ((): void => {});
    const signal = normalized.signal;
    const abortToken = abortHooks?.abortToken;
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
      identityConflicts: [],
    };

    const tree = await this.walkPhase(root, emit, signal, abortToken, checkAbort);
    recoverStagedMetaFiles(root, tree, this.catalog);
    checkAbort();
    const seenIds: SeenMetaIds = { work: new Set() };
    const existingWorks = this.query.getScanWorkMap();
    const existingByPhysicalPath = new Map(
      [...existingWorks].map(([id, state]) => [state.physicalPath, { id, state }]),
    );
    result.identityConflicts = findIdentityConflicts(root, tree.metaPaths);

    const batch = new ScanUpsertBatch(
      this.db,
      this.catalog,
      this.user,
      this.upsertBatchSize,
      checkAbort,
    );

    await this.registerPhase(
      root,
      tree,
      full,
      seenIds,
      existingWorks,
      existingByPhysicalPath,
      batch,
      result,
      emit,
      checkAbort,
    );

    await this.generatePhase(
      root,
      tree,
      full,
      seenIds,
      existingWorks,
      batch,
      result,
      emit,
      checkAbort,
    );

    return this.finalizePhase(tree, seenIds, existingWorks, result, emit, abortHooks, checkAbort);
  }

  private async walkPhase(
    root: string,
    emit: NonNullable<ScanOptions["onProgress"]>,
    signal: AbortSignal | undefined,
    abortToken: Int32Array | undefined,
    checkAbort: () => void,
  ): Promise<WalkResult> {
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
    return tree;
  }

  private async registerPhase(
    root: string,
    tree: WalkResult,
    full: boolean,
    seenIds: SeenMetaIds,
    existingWorks: Map<string, ScanWorkState>,
    existingByPhysicalPath: Map<string, { id: string; state: ScanWorkState }>,
    batch: ScanUpsertBatch,
    result: ScanResult,
    emit: NonNullable<ScanOptions["onProgress"]>,
    checkAbort: () => void,
  ): Promise<void> {
    emit({ type: "progress", phase: "registering", processed: 0, total: tree.metaPaths.length });

    const prepared = prepareMetaEntries(
      root,
      tree.metaPaths,
      existingWorks,
      full,
      seenIds,
      checkAbort,
      new Set(result.identityConflicts.map((diagnostic) => diagnostic.workId)),
    );
    const probeCache = buildProbeCache(this.query, prepared, full, checkAbort);

    const registeringThrottle = createProgressThrottle(PROGRESS_MIN_INTERVAL_MS);
    for (let i = 0; i < prepared.length; i++) {
      checkAbort();
      const entry = prepared[i]!;
      try {
        if (entry.kind === "identity_conflict") {
          if (existingWorks.has(entry.workId)) seenIds.work.add(entry.workId);
        } else if (entry.kind === "error") {
          handleMetaParseError(
            this.catalog,
            entry.metaPath,
            entry.error,
            seenIds,
            result,
            existingWorks,
            existingByPhysicalPath,
          );
        } else if (entry.kind === "skip") {
          result.skipped += 1;
        } else {
          const outcome = await registerMetaFile(
            this.db,
            entry,
            seenIds,
            probeCache,
            batch,
            existingWorks,
            result,
            full,
            true,
            this.measureCover,
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
          handleMetaParseError(
            this.catalog,
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
  }

  private async generatePhase(
    root: string,
    tree: WalkResult,
    full: boolean,
    seenIds: SeenMetaIds,
    existingWorks: Map<string, ScanWorkState>,
    batch: ScanUpsertBatch,
    result: ScanResult,
    emit: NonNullable<ScanOptions["onProgress"]>,
    checkAbort: () => void,
  ): Promise<void> {
    const workRoots = new Set<string>();
    for (const audioDir of tree.audioDirs) {
      checkAbort();
      if (isCoveredByMeta(audioDir, root, tree.metaDirs)) continue;
      if (audioDir === root) continue;
      workRoots.add(findWorkRoot(audioDir, root, tree.dirsWithMetaInSubtree, tree.dirIndex));
    }
    const roots = excludeDescendantPaths(workRoots).sort(naturalCompare);

    emit({ type: "progress", phase: "generating", processed: 0, total: roots.length });
    const generated: Array<{ id: string; prepared: PreparedMeta }> = [];
    const generatingThrottle = createProgressThrottle(PROGRESS_MIN_INTERVAL_MS);
    for (let i = 0; i < roots.length; i++) {
      checkAbort();
      const workDir = roots[i]!;
      try {
        const id = this.generateMetaForFolder(workDir);
        generated.push({ id, prepared: prepareSingleMeta(join(workDir, META_FILE_NAME)) });
      } catch (e) {
        scanLogger.warn(`メタファイルの自動生成に失敗: ${workDir}`, {
          path: workDir,
          error: (e as Error).message,
        });
        result.errors += 1;
      }
      const processed = i + 1;
      if (generatingThrottle(processed, roots.length)) {
        emit({ type: "progress", phase: "generating", processed, total: roots.length });
      }
    }

    const generatedProbeCache = buildProbeCache(
      this.query,
      generated.map((entry) => entry.prepared),
      full,
      checkAbort,
    );
    for (const entry of generated) {
      checkAbort();
      try {
        await registerMetaFile(
          this.db,
          entry.prepared,
          seenIds,
          generatedProbeCache,
          batch,
          existingWorks,
          result,
          full,
          false,
          this.measureCover,
          checkAbort,
        );
        result.newlyGenerated += 1;
        result.newWorkIds.push(entry.id);
      } catch (e) {
        if (!(e instanceof MetaParseError)) throw e;
        scanLogger.warn(`メタファイルの自動生成に失敗: ${dirname(entry.prepared.metaPath)}`, {
          path: dirname(entry.prepared.metaPath),
          error: (e as Error).message,
        });
        result.errors += 1;
      }
    }
    checkAbort();
    batch.flush();
  }

  private finalizePhase(
    tree: WalkResult,
    seenIds: SeenMetaIds,
    existingWorks: Map<string, ScanWorkState>,
    result: ScanResult,
    emit: NonNullable<ScanOptions["onProgress"]>,
    abortHooks: ScannerAbortHooks | undefined,
    checkAbort: () => void,
  ): ScanResult {
    checkAbort();
    emit({ type: "progress", phase: "finalizing", processed: 0, total: 1 });
    abortHooks?.beforeFinalize?.();
    checkAbort();

    if (tree.unreadablePaths.length > 0) {
      result.unreadablePaths = tree.unreadablePaths;
      scanLogger.warn("読み取れなかったディレクトリがあります", {
        paths: tree.unreadablePaths,
      });
      for (const [id, state] of existingWorks) {
        if (seenIds.work.has(id)) continue;
        if (tree.unreadablePaths.some((prefix) => isPathWithin(prefix, state.physicalPath))) {
          seenIds.work.add(id);
        }
      }
    }

    this.catalog.replaceIdentityConflicts(result.identityConflicts);

    this.catalog.markMissingExcept([...seenIds.work]);
    result.missing = this.catalog.countByStatus("missing");
    const { summaries, skipped } = this.query.listSummaries();
    logDataIntegritySkips(scanLogger, "scan-finalize", skipped);
    result.rjCodeMissingCount = summaries.filter((work) => isRjCodeMissing(work.dlsite)).length;
    const dataIntegrityWarning = toDataIntegrityWarning(skipped);
    if (dataIntegrityWarning) result.dataIntegrityWarning = dataIntegrityWarning;
    emit({ type: "progress", phase: "finalizing", processed: 1, total: 1 });
    return result;
  }

  async registerFolderWork(
    workDir: string,
    options: {
      title: string;
      tags?: NormalizedTag[];
      urls?: UrlEntry[];
      coverImage?: string | null;
      dlsite?: MetaFile["dlsite"];
    },
  ): Promise<Work> {
    const metaPath = join(workDir, META_FILE_NAME);
    if (existsSync(metaPath)) {
      throw new Error("このフォルダーには既にメタファイルがあります");
    }

    const meta = createDraftMetaFile(workDir, {
      id: crypto.randomUUID(),
      title: options.title,
      tags: options.tags,
      urls: options.urls,
      coverImage: options.coverImage,
      dlsite: options.dlsite,
    });
    writeMetaFile(metaPath, meta);

    const prepared = prepareSingleMeta(metaPath);
    const existingWorks = this.query.getScanWorkMap();
    const batch = new ScanUpsertBatch(
      this.db,
      this.catalog,
      this.user,
      this.upsertBatchSize,
      () => {},
    );
    const scanResult: Pick<ScanResult, "coverErrors"> = { coverErrors: 0 };
    const seenIds: SeenMetaIds = { work: new Set() };
    await registerMetaFile(
      this.db,
      prepared,
      seenIds,
      new Map(),
      batch,
      existingWorks,
      scanResult,
      true,
      false,
      this.measureCover,
    );
    batch.flush();

    const work = await getWorkWithLiveProbe(this.db, this.query, this.catalog, meta.id);
    if (!work) throw new Error("登録した作品の取得に失敗しました");
    return work;
  }

  /** 確定済みsidecarを入力に、対象作品だけをcatalogへ投影する。 */
  async projectMetaFile(metaPath: string, meta: MetaFile): Promise<Work> {
    const prepared = prepareSingleMeta(metaPath, meta);
    const existingWorks = this.query.getScanWorkMap();
    const batch = new ScanUpsertBatch(this.db, this.catalog, this.user, 1, () => {});
    const scanResult: Pick<ScanResult, "coverErrors"> = { coverErrors: 0 };
    const seenIds: SeenMetaIds = { work: new Set(), playlist: new Set(), track: new Set() };
    await registerMetaFile(
      this.db,
      prepared,
      seenIds,
      new Map(),
      batch,
      existingWorks,
      scanResult,
      true,
      false,
      this.measureCover,
    );
    batch.flush();
    const work = await getWorkWithLiveProbe(this.db, this.query, this.catalog, meta.id);
    if (!work) throw new Error("再投影した作品の取得に失敗しました");
    return work;
  }

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

    const metaPatch: typeof patch = {};
    if (patch.title !== undefined) metaPatch.title = patch.title;
    if (patch.tags !== undefined) metaPatch.tags = patch.tags;
    if (patch.urls !== undefined) metaPatch.urls = patch.urls;
    if (patch.coverImage !== undefined) metaPatch.coverImage = patch.coverImage;
    if (patch.dlsite !== undefined) metaPatch.dlsite = patch.dlsite;
    if (Object.keys(metaPatch).length > 0) {
      const source = readMetaSource(metaPath);
      patchMetaFileCas(metaPath, source.sourceRevision, metaPatch);
    }

    const workId = reassignMetaIdsOnDbCollision(metaPath, (id) => {
      const existing = this.query.getScanWorkMap().get(id);
      return existing !== undefined && existing.physicalPath !== workDir;
    });
    const prepared = prepareSingleMeta(metaPath);
    const existingWorks = this.query.getScanWorkMap();
    const batch = new ScanUpsertBatch(
      this.db,
      this.catalog,
      this.user,
      this.upsertBatchSize,
      () => {},
    );
    const scanResult: Pick<ScanResult, "coverErrors"> = { coverErrors: 0 };
    const seenIds: SeenMetaIds = { work: new Set() };
    await registerMetaFile(
      this.db,
      prepared,
      seenIds,
      new Map(),
      batch,
      existingWorks,
      scanResult,
      true,
      false,
      this.measureCover,
    );
    batch.flush();

    const work = await getWorkWithLiveProbe(this.db, this.query, this.catalog, workId);
    if (!work) throw new Error("復元した作品の取得に失敗しました");
    return work;
  }

  private generateMetaForFolder(workDir: string): string {
    const id = crypto.randomUUID();
    const meta = createDraftMetaFile(workDir, {
      id,
      title: basename(workDir),
    });
    writeMetaFile(join(workDir, META_FILE_NAME), meta);
    return id;
  }
}
