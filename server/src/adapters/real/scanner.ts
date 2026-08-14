// ライブラリスキャン。
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type {
  MetaFile,
  NormalizedTag,
  ScanCandidate,
  ScanCandidatesRegisterResponse,
  ScanDiagnostic,
  ScanResult,
  UrlEntry,
  Work,
} from "@mimimilli/shared";
import { emptyDlsiteState, isRjCodeMissing, workspacePath } from "@mimimilli/shared";
import type { ScanCandidateRegisterItem } from "@mimimilli/shared";
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
import {
  findWorkRoot,
  isCoveredByMeta,
  throwIfAborted,
  walk,
  type ScannerAbortHooks,
  type WalkResult,
} from "./scanWalk.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { detectRjCode } from "./dlsite.ts";

const scanLogger = getCategoryLogger("scan");

const PROGRESS_MIN_INTERVAL_MS = 200;

function emptyRegisterTracking(): Pick<
  ScanResult,
  "coverErrors" | "insertedWorkIds" | "updatedWorkIds"
> {
  return { coverErrors: 0, insertedWorkIds: [], updatedWorkIds: [] };
}

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
  dlsiteCache?: DlsiteCache | null;
}

export class Scanner {
  private readonly db: Db;
  private readonly query: WorkQueryRepository;
  private readonly catalog: CatalogWorkRepository;
  private readonly user: UserWorkStateRepository;
  private readonly measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>;
  private readonly dlsiteCache: DlsiteCache | null;
  private lastCandidatePool: ScanCandidate[] = [];

  constructor(db: Db, repos: WorkPersistence, options?: ScannerOptions) {
    this.db = db;
    this.query = repos.query;
    this.catalog = repos.catalog;
    this.user = repos.user;
    if (
      options?.upsertBatchSize !== undefined &&
      (!Number.isInteger(options.upsertBatchSize) || options.upsertBatchSize <= 0)
    ) {
      throw new RangeError("upsertBatchSize は有限の正整数である必要があります");
    }
    this.measureCover = options?.measureCover ?? measureCoverDimensions;
    this.dlsiteCache = options?.dlsiteCache ?? null;
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
      insertedWorkIds: [],
      updatedWorkIds: [],
      errors: 0,
      missing: 0,
      rjCodeMissingCount: 0,
      skipped: 0,
      coverErrors: 0,
      identityConflicts: [],
      invalidMetaFiles: [],
      candidates: [],
      candidatePool: [],
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

    const batch = new ScanUpsertBatch(this.db, this.catalog, this.user, checkAbort);

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

    this.lastCandidatePool = this.collectCandidates(root, tree, { filterExclusions: false });
    result.candidatePool = this.lastCandidatePool;
    result.candidates = this.collectCandidates(root, tree);

    await this.generatePhase(root, result, emit, checkAbort);

    return this.finalizePhase(
      tree,
      seenIds,
      existingWorks,
      batch,
      result,
      emit,
      abortHooks,
      checkAbort,
    );
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
            batch,
            entry.metaPath,
            entry.error,
            seenIds,
            result,
            existingWorks,
            existingByPhysicalPath,
          );
          result.invalidMetaFiles.push({
            path: workspacePath(toPortableRelativePath(root, entry.metaPath)),
            message: entry.error.message,
          });
        } else if (entry.kind === "skip") {
          seenIds.work.add(entry.id);
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
            false,
            this.measureCover,
            checkAbort,
            this.dlsiteCache,
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
            batch,
            entry.metaPath,
            e,
            seenIds,
            result,
            existingWorks,
            existingByPhysicalPath,
          );
          result.invalidMetaFiles.push({
            path: workspacePath(toPortableRelativePath(root, entry.metaPath)),
            message: e.message,
          });
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
  }

  private async generatePhase(
    root: string,
    result: ScanResult,
    emit: NonNullable<ScanOptions["onProgress"]>,
    checkAbort: () => void,
  ): Promise<void> {
    const roots = result.candidates.map((candidate) => resolve(root, candidate.path));

    emit({ type: "progress", phase: "generating", processed: 0, total: roots.length });
    const generatingThrottle = createProgressThrottle(PROGRESS_MIN_INTERVAL_MS);
    for (let i = 0; i < roots.length; i++) {
      checkAbort();
      const processed = i + 1;
      if (generatingThrottle(processed, roots.length)) {
        emit({ type: "progress", phase: "generating", processed, total: roots.length });
      }
    }

    checkAbort();
  }

  private collectCandidates(
    root: string,
    tree: WalkResult,
    options?: { filterExclusions?: boolean },
  ): ScanCandidate[] {
    const workRoots = new Set<string>();
    for (const audioDir of tree.audioDirs) {
      if (isCoveredByMeta(audioDir, root, tree.metaDirs) || audioDir === root) continue;
      workRoots.add(findWorkRoot(audioDir, root, tree.dirsWithMetaInSubtree, tree.dirIndex));
    }
    const excluded = new Set(this.user.listScanCandidateExclusions());
    const candidates = excludeDescendantPaths(workRoots)
      .sort(naturalCompare)
      .map((workDir) => {
        const breakdown = new Map<string, number>();
        for (const [audioDir, entries] of tree.audioBreakdownByDir) {
          if (!isPathWithin(workDir, audioDir)) continue;
          for (const [extension, count] of entries) {
            breakdown.set(extension, (breakdown.get(extension) ?? 0) + count);
          }
        }
        const folderName = basename(workDir);
        return {
          path: workspacePath(toPortableRelativePath(root, workDir)),
          inferredTitle: folderName,
          audioFileCount: [...breakdown.values()].reduce((total, count) => total + count, 0),
          audioBreakdown: [...breakdown]
            .sort(([a], [b]) => naturalCompare(a, b))
            .map(([extension, count]) => ({ extension, count })),
          rjCode: detectRjCode([folderName]),
        };
      });
    if (options?.filterExclusions === false) return candidates;
    return candidates.filter((candidate) => !excluded.has(candidate.path));
  }

  async listCandidates(_root: string): Promise<ScanCandidate[]> {
    const excluded = new Set(this.user.listScanCandidateExclusions());
    return this.lastCandidatePool.filter((candidate) => !excluded.has(candidate.path));
  }

  seedCandidatePool(candidates: ScanCandidate[]): void {
    this.lastCandidatePool = candidates;
  }

  async registerCandidates(
    root: string,
    items: ScanCandidateRegisterItem[],
    onRegistered: (workId: string) => void = () => {},
  ): Promise<ScanCandidatesRegisterResponse> {
    const candidates = await this.listCandidates(root);
    const byPath = new Map<string, ScanCandidate>(
      candidates.map((candidate) => [candidate.path, candidate]),
    );
    const selected = items.map((item) => ({ item, candidate: byPath.get(item.path) }));
    if (selected.some((entry) => entry.candidate === undefined)) {
      throw new Error("候補が更新されています。再スキャンして選び直してください");
    }
    const registered: ScanCandidatesRegisterResponse["registered"] = [];
    const failures: ScanCandidatesRegisterResponse["failures"] = [];
    for (const { item, candidate } of selected) {
      const current = candidate!;
      try {
        const work = await this.registerFolderWork(resolve(root, current.path), {
          title: current.inferredTitle,
          rjCode: item.rjCode,
        });
        registered.push({ path: current.path, workId: work.id });
        onRegistered(work.id);
      } catch (error) {
        failures.push({
          path: current.path,
          message: error instanceof Error ? error.message : "候補の登録に失敗しました",
        });
      }
    }
    const registeredPaths = new Set(registered.map((entry) => entry.path));
    this.lastCandidatePool = this.lastCandidatePool.filter(
      (candidate) => !registeredPaths.has(candidate.path),
    );
    return { registered, failures };
  }

  async excludeCandidates(root: string, paths: string[]): Promise<void> {
    const candidates = await this.listCandidates(root);
    const currentPaths = new Set(candidates.map((candidate) => candidate.path));
    if (paths.some((path) => !currentPaths.has(path as ScanCandidate["path"]))) {
      throw new Error("候補が更新されています。再スキャンして選び直してください");
    }
    this.user.excludeScanCandidates(paths);
  }

  listExcludedCandidates(): string[] {
    return this.user.listScanCandidateExclusions();
  }

  restoreExcludedCandidates(paths: string[]): void {
    this.user.restoreScanCandidateExclusions(paths);
  }

  private finalizePhase(
    tree: WalkResult,
    seenIds: SeenMetaIds,
    existingWorks: Map<string, ScanWorkState>,
    batch: ScanUpsertBatch,
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

    const unverifiedIds = new Set<string>();
    const changedIds = batch.discardChangedSources();
    for (const id of changedIds) {
      seenIds.work.add(id);
      unverifiedIds.add(id);
    }
    if (tree.unreadablePaths.length > 0) {
      for (const [id, state] of existingWorks) {
        if (tree.unreadablePaths.some((prefix) => isPathWithin(prefix, state.physicalPath))) {
          unverifiedIds.add(id);
        }
      }
    }
    batch.publishScanGeneration({
      seenIds: [...seenIds.work],
      unverifiedIds: [...unverifiedIds],
      diagnostics: result.identityConflicts,
    });
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
      rjCode?: string;
    },
  ): Promise<Work> {
    const metaPath = join(workDir, META_FILE_NAME);
    if (existsSync(metaPath)) {
      throw new Error("このフォルダーには既にメタファイルがあります");
    }

    let dlsite = options.dlsite;
    if (dlsite === undefined) {
      if (options.rjCode === undefined) {
        const detected = detectRjCode([basename(workDir), options.title]);
        dlsite = detected ? { ...emptyDlsiteState(), rjCode: detected } : emptyDlsiteState();
      } else if (options.rjCode === "") {
        dlsite = { ...emptyDlsiteState(), rjCode: "" };
      } else {
        dlsite = { ...emptyDlsiteState(), rjCode: options.rjCode };
      }
    }

    const meta = createDraftMetaFile(workDir, {
      id: crypto.randomUUID(),
      title: options.title,
      tags: options.tags,
      urls: options.urls,
      coverImage: options.coverImage,
      dlsite,
    });
    writeMetaFile(metaPath, meta);

    const prepared = prepareSingleMeta(metaPath);
    const existingWorks = this.query.getScanWorkMap();
    const batch = new ScanUpsertBatch(this.db, this.catalog, this.user, () => {});
    const scanResult = emptyRegisterTracking();
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
      undefined,
      this.dlsiteCache,
    );
    batch.publishWork();

    const work = await getWorkWithLiveProbe(this.db, this.query, this.catalog, meta.id);
    if (!work) throw new Error("登録した作品の取得に失敗しました");
    return work;
  }

  /** 確定済みmimimilli.jsonを入力に、対象作品だけをcatalogへ投影する。 */
  async projectMetaFile(metaPath: string, meta: MetaFile): Promise<Work> {
    const prepared = prepareSingleMeta(metaPath, meta);
    const existingWorks = this.query.getScanWorkMap();
    const batch = new ScanUpsertBatch(this.db, this.catalog, this.user, () => {});
    const scanResult = emptyRegisterTracking();
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
      undefined,
      this.dlsiteCache,
    );
    batch.publishWork();
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
    const batch = new ScanUpsertBatch(this.db, this.catalog, this.user, () => {});
    const scanResult = emptyRegisterTracking();
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
      undefined,
      this.dlsiteCache,
    );
    batch.publishWork();

    const work = await getWorkWithLiveProbe(this.db, this.query, this.catalog, workId);
    if (!work) throw new Error("復元した作品の取得に失敗しました");
    return work;
  }
}
