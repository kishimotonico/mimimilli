// ライブラリスキャン。
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type {
  IdentityConflict,
  MetaFile,
  MissingWork,
  ScanCandidateFolder,
  ScanDiagnostics,
  ScanResult,
} from "@mimimilli/shared";
import { errorMessage, detectRjCode, workspacePath, type WorkspacePath } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import type { ScanExecutionResult, ScanOptions } from "../../adapter/index.ts";
import { descendantsRegisteredError } from "../../errors.ts";
import {
  MetaParseError,
  inspectMetaFile,
  type MetaInspection,
  patchMetaFileCas,
  readMetaSource,
  writeMetaFile,
} from "./meta.ts";
import type { SeenMetaIds } from "./duplicateMetaIdRepair.ts";
import { excludeDescendantPaths, identityConflictPathOf, toPortableRelativePath } from "./paths.ts";
import { isPathWithin } from "../../lib/path.ts";
import { createProgressThrottle } from "./progressThrottle.ts";
import { measureCoverDimensions, type CoverDimensions } from "./thumbnailCache.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { classifyWorkChanges } from "../../core/workChanges.ts";
import type { ScanWorkState } from "./workRowMapping.ts";
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
  type RegisteredWork,
  type RegisterMetaFileOptions,
} from "./scanRegister.ts";
import type {
  PreparedEntry,
  PreparedMeta,
  ProjectOutcome,
  RegisterWorkOptions,
  RestoreMetaPatch,
} from "./scanTypes.ts";
import {
  assertNoIdentityConflict,
  targetName,
  type RegistrationTarget,
} from "./registrationTarget.ts";
import type { ProbeCacheEntry } from "./probe.ts";
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
import { computeSourceRevision } from "./fingerprint.ts";

const scanLogger = getCategoryLogger("scan");

const PROGRESS_MIN_INTERVAL_MS = 200;

function currentSourceRevision(metaPath: string): string | null {
  try {
    return computeSourceRevision(readFileSync(metaPath));
  } catch {
    return null;
  }
}

function emptyRegisterTracking(): Pick<ScanResult, "coverErrors"> {
  return { coverErrors: 0 };
}

function trackRegisteredWork(
  result: Pick<ScanResult, "insertedWorkIds" | "updatedWorks">,
  registered: RegisteredWork,
  root: string,
): void {
  const { workId, previous, current } = registered;
  if (!previous) {
    result.insertedWorkIds.push(workId);
    return;
  }
  const changes = classifyWorkChanges(previous, current, root);
  if (changes.length > 0) result.updatedWorks.push({ workId, changes });
}

function inspectMetaFiles(
  metaPaths: string[],
  checkAbort: () => void,
): Map<string, MetaInspection> {
  const inspections = new Map<string, MetaInspection>();
  for (const metaPath of metaPaths) {
    checkAbort();
    inspections.set(metaPath, inspectMetaFile(metaPath));
  }
  return inspections;
}

function findIdentityConflicts(
  root: string,
  inspections: ReadonlyMap<string, MetaInspection>,
): IdentityConflict[] {
  const pathsByWorkId = new Map<string, WorkspacePath[]>();
  for (const [metaPath, { declaredId }] of inspections) {
    if (declaredId === null) continue;
    const paths = pathsByWorkId.get(declaredId) ?? [];
    paths.push(identityConflictPathOf(root, metaPath));
    pathsByWorkId.set(declaredId, paths);
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
  /** 単体の登録・投影で、診断の相対パスを現在のrootに解決するために使う */
  resolveRoot?: () => string;
}

export class Scanner {
  private readonly db: Db;
  private readonly query: WorkQueryRepository;
  private readonly catalog: CatalogWorkRepository;
  private readonly user: UserWorkStateRepository;
  private readonly measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>;
  private readonly dlsiteCache: DlsiteCache | null;
  private readonly resolveRoot: (() => string) | null;

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
    this.resolveRoot = options?.resolveRoot ?? null;
  }

  async scan(
    root: string,
    options?: ScanOptions,
    abortHooks?: ScannerAbortHooks,
  ): Promise<ScanExecutionResult> {
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
      startedWithEmptyCatalog: false,
      missingWorks: [],
      updatedWorks: [],
      unreadablePaths: [],
      errors: 0,
      missing: 0,
      skipped: 0,
      coverErrors: 0,
    };
    const diagnostics: ScanDiagnostics = { identityConflicts: [], invalidMetaFiles: [] };

    const existingWorks = this.query.getScanWorkMap();
    result.startedWithEmptyCatalog = existingWorks.size === 0;
    const tree = await this.walkPhase(root, emit, signal, abortToken, checkAbort);
    recoverStagedMetaFiles(root, tree, this.catalog);
    checkAbort();
    const seenIds: SeenMetaIds = { work: new Set() };
    const existingByMetaPath = new Map(
      [...existingWorks].map(([id, state]) => [state.metaPath, { id, state }]),
    );

    const batch = new ScanUpsertBatch(this.db, this.catalog, this.user, checkAbort);

    await this.registerPhase(
      root,
      tree,
      full,
      seenIds,
      existingWorks,
      existingByMetaPath,
      batch,
      result,
      diagnostics,
      emit,
      checkAbort,
    );

    const candidatePool = this.collectCandidates(root, tree, { filterExclusions: false });
    await this.generatePhase(root, this.collectCandidates(root, tree), emit, checkAbort);

    return {
      result: this.finalizePhase(
        root,
        tree,
        seenIds,
        existingWorks,
        batch,
        result,
        diagnostics,
        emit,
        abortHooks,
        checkAbort,
      ),
      candidatePool,
    };
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

  private prepareEntries(
    root: string,
    tree: WalkResult,
    existingWorks: Map<string, ScanWorkState>,
    full: boolean,
    diagnostics: ScanDiagnostics,
    checkAbort: () => void,
  ): PreparedEntry[] {
    const inspections = inspectMetaFiles(tree.metaPaths, checkAbort);
    diagnostics.identityConflicts = findIdentityConflicts(root, inspections);
    return prepareMetaEntries(
      inspections,
      existingWorks,
      full,
      checkAbort,
      new Set(diagnostics.identityConflicts.map((diagnostic) => diagnostic.workId)),
    );
  }

  private async registerPhase(
    root: string,
    tree: WalkResult,
    full: boolean,
    seenIds: SeenMetaIds,
    existingWorks: Map<string, ScanWorkState>,
    existingByMetaPath: Map<string, { id: string; state: ScanWorkState }>,
    batch: ScanUpsertBatch,
    result: ScanResult,
    diagnostics: ScanDiagnostics,
    emit: NonNullable<ScanOptions["onProgress"]>,
    checkAbort: () => void,
  ): Promise<void> {
    emit({ type: "progress", phase: "registering", processed: 0, total: tree.metaPaths.length });

    const prepared = this.prepareEntries(root, tree, existingWorks, full, diagnostics, checkAbort);
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
            existingByMetaPath,
            root,
            diagnostics.identityConflicts,
          );
          diagnostics.invalidMetaFiles.push({
            path: workspacePath(toPortableRelativePath(root, entry.metaPath)),
            message: entry.error.message,
          });
        } else if (entry.kind === "skip") {
          seenIds.work.add(entry.id);
          result.skipped += 1;
        } else {
          const outcome = await this.invokeRegisterMetaFile({
            prepared: entry,
            seenIds,
            probeCache,
            batch,
            existingWorks,
            result,
            options: { full, idsAlreadyRegistered: false },
            checkAbort,
          });
          if (outcome === "skipped") {
            result.skipped += 1;
          } else {
            result.registered += 1;
            trackRegisteredWork(result, outcome, root);
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
            existingByMetaPath,
            root,
            diagnostics.identityConflicts,
          );
          diagnostics.invalidMetaFiles.push({
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
    candidates: ScanCandidateFolder[],
    emit: NonNullable<ScanOptions["onProgress"]>,
    checkAbort: () => void,
  ): Promise<void> {
    const roots = candidates.map((candidate) => resolve(root, candidate.path));

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
  ): ScanCandidateFolder[] {
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
          detectedRjCode: detectRjCode([folderName]),
        };
      });
    if (options?.filterExclusions === false) return candidates;
    return candidates.filter((candidate) => !excluded.has(candidate.path));
  }

  private finalizePhase(
    root: string,
    tree: WalkResult,
    seenIds: SeenMetaIds,
    existingWorks: Map<string, ScanWorkState>,
    batch: ScanUpsertBatch,
    result: ScanResult,
    diagnostics: ScanDiagnostics,
    emit: NonNullable<ScanOptions["onProgress"]>,
    abortHooks: ScannerAbortHooks | undefined,
    checkAbort: () => void,
  ): ScanResult {
    checkAbort();
    emit({ type: "progress", phase: "finalizing", processed: 0, total: 1 });
    abortHooks?.beforeFinalize?.();
    checkAbort();

    if (tree.unreadablePaths.length > 0) {
      result.unreadablePaths = tree.unreadablePaths.map((dir) =>
        workspacePath(toPortableRelativePath(root, dir)),
      );
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
    // 走査前にcatalogにあった作品のうち今回見つからなかったものだけを missing にする。
    // 走査中に登録された作品は existingWorks に無いので missing にならない
    const missingIds: string[] = [];
    const missingWorks: MissingWork[] = [];
    for (const [workId, state] of existingWorks) {
      if (seenIds.work.has(workId)) continue;
      missingIds.push(workId);
      if (state.status === "missing") continue;
      // root外の作品は相対pathで示せないので、画面に出す行方不明の対象にしない
      if (!isPathWithin(root, state.physicalPath)) continue;
      missingWorks.push({
        workId,
        title: state.title,
        previousPath: workspacePath(toPortableRelativePath(root, state.physicalPath)),
      });
    }
    batch.publishScanGeneration({
      seenIds: [...seenIds.work],
      unverifiedIds: [...unverifiedIds],
      missingIds,
      identityConflicts: diagnostics.identityConflicts,
      invalidMetaFiles: diagnostics.invalidMetaFiles,
    });
    result.missingWorks = missingWorks;
    result.missing = this.catalog.countByStatus("missing");
    const { skipped } = this.query.listSummaries();
    logDataIntegritySkips(scanLogger, "scan-finalize", skipped);
    const dataIntegrityWarning = toDataIntegrityWarning(skipped);
    if (dataIntegrityWarning) result.dataIntegrityWarning = dataIntegrityWarning;
    emit({ type: "progress", phase: "finalizing", processed: 1, total: 1 });
    return result;
  }

  private async invokeRegisterMetaFile(params: {
    prepared: PreparedMeta;
    seenIds: SeenMetaIds;
    probeCache: Map<string, ProbeCacheEntry>;
    batch: ScanUpsertBatch;
    existingWorks: Map<string, ScanWorkState>;
    result: Pick<ScanResult, "coverErrors">;
    options: RegisterMetaFileOptions;
    checkAbort?: () => void;
  }): Promise<"skipped" | RegisteredWork> {
    return registerMetaFile(
      this.db,
      params.prepared,
      params.seenIds,
      params.probeCache,
      params.batch,
      params.existingWorks,
      params.result,
      params.options,
      this.measureCover,
      params.checkAbort,
      this.dlsiteCache,
    );
  }

  /** 書き込み済みのメタを対象作品だけcatalogへ投影する。失敗してもメタは残る */
  async projectPrepared(prepared: PreparedMeta): Promise<ProjectOutcome> {
    return (await this.projectPreparedBatch([prepared]))[0]!;
  }

  /**
   * 複数のメタを1回の公開で投影する。async の前処理をすべて済ませてから、同じトランザクションで公開する。
   * missingWorkIds は同じトランザクションで missing にする。結果は prepared と同じ順
   */
  async projectPreparedBatch(
    prepared: readonly PreparedMeta[],
    missingWorkIds: string[] = [],
  ): Promise<ProjectOutcome[]> {
    const snapshotOf = (entry: PreparedMeta) => ({
      meta: entry.meta,
      bytes: entry.bytes,
      sourceRevision: entry.revisions.sourceRevision,
    });
    try {
      const existingWorks = this.query.getScanWorkMap();
      const batch = new ScanUpsertBatch(this.db, this.catalog, this.user, () => {});
      const scanResult = emptyRegisterTracking();
      const seenIds: SeenMetaIds = { work: new Set() };
      for (const entry of prepared) {
        await this.invokeRegisterMetaFile({
          prepared: entry,
          seenIds,
          probeCache: new Map(),
          batch,
          existingWorks,
          result: scanResult,
          options: { full: true, idsAlreadyRegistered: false },
        });
      }
      const changedIds = new Set(batch.publishWork(missingWorkIds));
      return prepared.map((entry): ProjectOutcome => {
        if (changedIds.has(entry.meta.id)) {
          return {
            status: "unpublished",
            reason: "source_changed",
            snapshot: snapshotOf(entry),
            currentSourceRevision: currentSourceRevision(entry.metaPath),
          };
        }
        if (this.resolveRoot) {
          this.catalog.removeInvalidMetaFile(
            toPortableRelativePath(this.resolveRoot(), entry.metaPath),
          );
        }
        return { status: "published", snapshot: snapshotOf(entry) };
      });
    } catch (error) {
      scanLogger.error("作品の一覧反映に失敗しました", {
        workIds: prepared.map((entry) => entry.meta.id),
        error: errorMessage(error),
      });
      return prepared.map((entry) => ({
        status: "unpublished",
        reason: "error",
        snapshot: snapshotOf(entry),
      }));
    }
  }

  private assertNoRegisteredDescendants(workDir: string): void {
    const descendants = this.query.listDescendantWorkRefs(workDir);
    if (descendants.length > 0) throw descendantsRegisteredError(descendants.length);
  }

  private snapshotForRestore(
    target: RegistrationTarget,
    patch: RestoreMetaPatch,
  ): { meta: MetaFile; bytes: Buffer; sourceRevision: string } {
    const { metaPath } = target.placement;
    if (!existsSync(metaPath)) {
      throw new Error("復元対象のメタファイルがありません");
    }
    const source = readMetaSource(metaPath);
    assertNoIdentityConflict(this.query, source.meta.id, target.physicalPath);
    const metaPatch: RestoreMetaPatch = {};
    if (patch.title !== undefined) metaPatch.title = patch.title;
    if (patch.tags !== undefined) metaPatch.tags = patch.tags;
    if (patch.urls !== undefined) metaPatch.urls = patch.urls;
    if (patch.coverImage !== undefined) metaPatch.coverImage = patch.coverImage;
    if (patch.dlsite !== undefined) metaPatch.dlsite = patch.dlsite;
    if (Object.keys(metaPatch).length > 0) {
      return patchMetaFileCas(metaPath, source.sourceRevision, metaPatch);
    }
    return source;
  }

  private draftMetaFor(
    target: RegistrationTarget,
    fields: Omit<Parameters<typeof createDraftMetaFile>[1], "id">,
  ): MetaFile {
    const { mediaRoot } = target.placement;
    if (target.placement.kind === "folder") {
      return createDraftMetaFile(mediaRoot, { ...fields, id: crypto.randomUUID() });
    }
    const audioName = targetName(target);
    return createDraftMetaFile(mediaRoot, {
      ...fields,
      id: crypto.randomUUID(),
      coverImage: fields.coverImage ?? null,
      tracks: [
        { id: crypto.randomUUID(), title: audioName.replace(/\.[^.]+$/, ""), file: audioName },
      ],
    });
  }

  /** 新しい作品のメタを書く。投影は projectPrepared で行う */
  writeNewWorkMeta(target: RegistrationTarget, options: RegisterWorkOptions): PreparedMeta {
    if (target.placement.kind === "folder") this.assertNoRegisteredDescendants(target.physicalPath);
    const { metaPath } = target.placement;
    if (existsSync(metaPath)) {
      throw new Error(
        target.placement.kind === "folder"
          ? "このフォルダーには既にメタファイルがあります"
          : "このファイルには既にメタファイルがあります",
      );
    }

    const meta = this.draftMetaFor(target, {
      title: options.title,
      tags: options.tags,
      urls: options.urls,
      coverImage: options.coverImage,
      dlsite: options.dlsite,
    });
    const snapshot = writeMetaFile(metaPath, meta);
    return prepareSingleMeta(metaPath, snapshot);
  }

  /** 孤立メタを復元用に更新する。投影は projectPrepared で行う */
  writeRestoredWorkMeta(target: RegistrationTarget, patch: RestoreMetaPatch): PreparedMeta {
    if (target.placement.kind === "folder") this.assertNoRegisteredDescendants(target.physicalPath);
    const { metaPath } = target.placement;
    const snapshot = this.snapshotForRestore(target, patch);
    return prepareSingleMeta(metaPath, snapshot);
  }
}
