// ファイルモードからの手動作品登録。メタファイル生成のみ行い、物理ファイルは移動しない。
import { existsSync, renameSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  DlsiteRegistrationBody,
  MetaFile,
  Work,
  WorkCreateBody,
  WorkRegisterPreview,
  WorkSourceMutationResult,
} from "@mimimilli/shared";
import {
  detectRjCode,
  emptyMetaDlsiteState,
  isAudioFileName,
  isAudioWorkPath,
  sidecarMetaFileName,
} from "@mimimilli/shared";
import { META_FILE_NAME, MetaParseError, readMetaFile, readMetaFileRaw } from "./meta.ts";
import { metaStagingPath } from "./metaStaging.ts";
import { resolveWithin } from "./paths.ts";
import { restoreIdentityConflictError, WorkRegisterError } from "../../errors.ts";
import { assertRegistrationAllowed } from "../../core/workRegistrationGuard.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { Scanner } from "./scanner.ts";
import type { ProjectOutcome } from "./scanTypes.ts";
import { mutationResultFromOutcome, toEditSnapshot } from "./workEditSource.ts";

function mutationResultFromProjectOutcome(
  outcome: ProjectOutcome,
  physicalPath: string,
): WorkSourceMutationResult {
  return mutationResultFromOutcome(
    toEditSnapshot(
      {
        bytes: outcome.snapshot.bytes,
        meta: outcome.snapshot.meta,
        sourceRevision: outcome.snapshot.sourceRevision,
      },
      physicalPath,
    ),
    outcome,
  );
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function sidecarPathForAudio(audioPath: string): string {
  return join(dirname(audioPath), sidecarMetaFileName(basename(audioPath)));
}

function ancestorFolderIsRegistered(
  query: WorkQueryRepository,
  audioPath: string,
  root: string,
): boolean {
  let current = dirname(audioPath);
  while (true) {
    if (query.getWorkByPhysicalPathSync(current) !== null) return true;
    if (current === root) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return false;
}

export class MetaUnregisterError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MetaUnregisterError";
  }
}

interface MetaDeletionPlan {
  canonicalPath: string;
  stagedPath: string;
}

function folderMetaPathOf(physicalPath: string): string {
  return join(physicalPath, META_FILE_NAME);
}

function metaFileIdMatches(metaPath: string, workId: string): boolean {
  try {
    const raw = readMetaFileRaw(metaPath);
    return (
      typeof raw === "object" &&
      raw !== null &&
      "id" in raw &&
      typeof raw.id === "string" &&
      raw.id === workId
    );
  } catch {
    return false;
  }
}

function findStagedMetaPlan(workId: string, canonicalPath: string): MetaDeletionPlan | null {
  const stagedPath = metaStagingPath(canonicalPath);
  if (existsSync(stagedPath) && metaFileIdMatches(stagedPath, workId)) {
    return { canonicalPath, stagedPath };
  }
  return null;
}

/** 登録解除時に退避・削除するメタファイルパスを解決する。 */
function resolveMetaDeletionPlan(
  workId: string,
  recordedMetaPath: string,
  physicalPath?: string,
): MetaDeletionPlan | null {
  const stagedAtRecorded = findStagedMetaPlan(workId, recordedMetaPath);
  if (stagedAtRecorded) return stagedAtRecorded;
  if (existsSync(recordedMetaPath)) {
    return {
      canonicalPath: recordedMetaPath,
      stagedPath: metaStagingPath(recordedMetaPath),
    };
  }

  if (physicalPath) {
    const canonicalPath = isAudioWorkPath(physicalPath)
      ? sidecarPathForAudio(physicalPath)
      : folderMetaPathOf(physicalPath);
    const stagedAtFallback = findStagedMetaPlan(workId, canonicalPath);
    if (stagedAtFallback) return stagedAtFallback;
    if (existsSync(canonicalPath) && metaFileIdMatches(canonicalPath, workId)) {
      return { canonicalPath, stagedPath: metaStagingPath(canonicalPath) };
    }
  }

  return null;
}

function stageMetaForDeletion(plan: MetaDeletionPlan): void {
  if (existsSync(plan.stagedPath)) {
    if (existsSync(plan.canonicalPath)) {
      throw new MetaUnregisterError(
        `メタの退避状態が矛盾しています: 正本と退避が同時に存在します (${plan.canonicalPath})`,
      );
    }
    return;
  }
  if (!existsSync(plan.canonicalPath)) return;
  renameSync(plan.canonicalPath, plan.stagedPath);
}

function restoreStagedMeta(plan: MetaDeletionPlan): void {
  if (!existsSync(plan.stagedPath)) return;
  if (existsSync(plan.canonicalPath)) {
    throw new MetaUnregisterError(
      `退避したメタを復元できません: 正本パスが既に存在します (${plan.canonicalPath})`,
    );
  }
  try {
    renameSync(plan.stagedPath, plan.canonicalPath);
  } catch (error) {
    throw new MetaUnregisterError(
      `退避したメタを復元できません: ${plan.stagedPath} → ${plan.canonicalPath}`,
      { cause: error },
    );
  }
}

function deleteStagedMeta(plan: MetaDeletionPlan): void {
  if (existsSync(plan.stagedPath)) unlinkSync(plan.stagedPath);
}

export function unregisterWork(
  query: WorkQueryRepository,
  catalog: CatalogWorkRepository,
  user: UserWorkStateRepository,
  workId: string,
): boolean {
  const target = catalog.getWorkDeleteTarget(workId);
  if (!target) return false;

  const mediaRoot = query.getMediaRoot(workId);
  const metaPlan = resolveMetaDeletionPlan(workId, target.metaPath, mediaRoot?.physicalPath);
  if (metaPlan) stageMetaForDeletion(metaPlan);

  try {
    const deleted = catalog.deleteWorkCatalog(workId);
    if (!deleted) {
      if (metaPlan) restoreStagedMeta(metaPlan);
      return false;
    }
    user.deleteWorkUserState(workId);
    if (metaPlan) deleteStagedMeta(metaPlan);
    return true;
  } catch (error) {
    if (metaPlan) restoreStagedMeta(metaPlan);
    throw error;
  }
}

export function buildWorkRegisterPreview(
  query: WorkQueryRepository,
  workDir: string,
): WorkRegisterPreview {
  const folderName = basename(workDir);
  const descendants = query.listDescendantWorkRefs(workDir);
  const metaPath = `${workDir}/${META_FILE_NAME}`;
  const dbWork = query.getWorkByPhysicalPathSync(workDir);
  const orphanedMeta = existsSync(metaPath) && dbWork === null;

  let suggestedTitle = folderName;
  let tags: string[] = [];
  if (orphanedMeta) {
    try {
      const meta = readMetaFile(metaPath);
      suggestedTitle = meta.title;
      tags = meta.tags;
    } catch {
      // メタ不正は preview では隠蔽せずフォルダ名へフォールバック。POST で invalid_meta を返す。
    }
  }

  return {
    suggestedTitle,
    tags,
    detectedRjCode: detectRjCode([folderName]),
    descendantWorkCount: descendants.length,
    alreadyRegistered: dbWork !== null,
    orphanedMeta,
  };
}

export function buildFileWorkRegisterPreview(
  query: WorkQueryRepository,
  audioPath: string,
  root: string,
): WorkRegisterPreview {
  const fileName = basename(audioPath);
  const stem = fileName.replace(/\.[^.]+$/, "");
  const metaPath = sidecarPathForAudio(audioPath);
  const dbWork = query.getWorkByPhysicalPathSync(audioPath);
  const orphanedMeta = existsSync(metaPath) && dbWork === null;

  let suggestedTitle = stem;
  let tags: string[] = [];
  if (orphanedMeta) {
    try {
      const meta = readMetaFile(metaPath);
      suggestedTitle = meta.title;
      tags = meta.tags;
    } catch {
      // メタ不正は preview では隠蔽せずファイル名へフォールバック。POST で invalid_meta を返す。
    }
  }

  return {
    suggestedTitle,
    tags,
    detectedRjCode: detectRjCode([fileName, stem]),
    descendantWorkCount: 0,
    alreadyRegistered: dbWork !== null || ancestorFolderIsRegistered(query, audioPath, root),
    orphanedMeta,
  };
}

/** DLsite適用結果のうち、フォーム由来の title/tags を上書きしない部分だけを表す */
interface DlsiteAppliedMeta {
  urls: Work["urls"];
  coverImage?: string | null;
  dlsite: MetaFile["dlsite"];
}

export async function createWorkFromFolder(
  repos: {
    db: Db;
    query: WorkQueryRepository;
    catalog: CatalogWorkRepository;
    user: UserWorkStateRepository;
  },
  scanner: Scanner,
  root: string,
  body: WorkCreateBody,
  applyDlsiteCover?: (coverUrl: string, workDir: string) => Promise<string | null>,
): Promise<WorkSourceMutationResult> {
  const { query } = repos;
  const workDir = resolveWithin(root, join(root, body.path));
  if (!workDir || !isDirectory(workDir)) {
    throw new WorkRegisterError(
      "not_configured",
      "指定されたパスは存在しないか、ルート配下ではありません",
    );
  }

  const metaPath = `${workDir}/${META_FILE_NAME}`;
  const dbWork = query.getWorkByPhysicalPathSync(workDir);
  const descendants = query.listDescendantWorkRefs(workDir);
  assertRegistrationAllowed({
    alreadyRegistered: dbWork !== null,
    descendantWorkCount: descendants.length,
    kind: "folder",
  });

  const orphanedMeta = existsSync(metaPath);
  if (orphanedMeta) {
    let meta: MetaFile;
    try {
      meta = readMetaFile(metaPath);
    } catch (error) {
      if (error instanceof MetaParseError) {
        throw new WorkRegisterError("invalid_meta", "メタファイルが不正なため復元できません");
      }
      throw error;
    }

    const existing = query.getScanWorkMap().get(meta.id);
    if (existing && existing.physicalPath !== workDir && existing.status !== "missing") {
      throw restoreIdentityConflictError();
    }

    const metaPatch: {
      title?: string;
      tags?: string[];
      urls?: Work["urls"];
      coverImage?: string | null;
      dlsite?: MetaFile["dlsite"];
    } = {};

    if (body.title !== meta.title) metaPatch.title = body.title;
    // body.tags は workCreateBodySchema の境界で既に正規化済み（NormalizedTag[]）。
    metaPatch.tags = body.tags;

    if (body.dlsite) {
      const applied = await buildMetaFromDlsiteApply(body.dlsite, workDir, applyDlsiteCover);
      if (body.dlsite.applyUrl) {
        metaPatch.urls = [
          ...meta.urls.filter((entry) => !entry.url.includes("dlsite.com")),
          ...applied.urls,
        ];
      }
      if (applied.coverImage !== undefined) metaPatch.coverImage = applied.coverImage;
      metaPatch.dlsite = applied.dlsite;
    }

    return mutationResultFromProjectOutcome(
      await scanner.restoreFolderWork(workDir, metaPatch),
      workDir,
    );
  }

  const title = body.title;
  // body.tags は workCreateBodySchema の境界で既に正規化済み（NormalizedTag[]）。
  const tags = body.tags;
  let urls: Work["urls"] = [];
  let coverImage: string | null | undefined;
  let dlsite = emptyMetaDlsiteState();

  if (body.dlsite) {
    const applied = await buildMetaFromDlsiteApply(body.dlsite, workDir, applyDlsiteCover);
    urls = applied.urls;
    coverImage = applied.coverImage;
    dlsite = applied.dlsite;
  } else {
    const detectedRjCode = detectRjCode([basename(workDir), title]);
    if (detectedRjCode) dlsite = { ...emptyMetaDlsiteState(), rjCode: detectedRjCode };
  }

  return mutationResultFromProjectOutcome(
    await scanner.registerFolderWork(workDir, {
      title,
      tags,
      urls,
      coverImage,
      dlsite,
    }),
    workDir,
  );
}

export async function createWorkFromPath(
  repos: {
    db: Db;
    query: WorkQueryRepository;
    catalog: CatalogWorkRepository;
    user: UserWorkStateRepository;
  },
  scanner: Scanner,
  root: string,
  body: WorkCreateBody,
  applyDlsiteCover?: (coverUrl: string, workDir: string) => Promise<string | null>,
): Promise<WorkSourceMutationResult> {
  const target = resolveWithin(root, join(root, body.path));
  if (!target) {
    throw new WorkRegisterError(
      "not_configured",
      "指定されたパスは存在しないか、ルート配下ではありません",
    );
  }
  if (isDirectory(target)) {
    return createWorkFromFolder(repos, scanner, root, body, applyDlsiteCover);
  }
  if (isFile(target) && isAudioFileName(basename(target))) {
    return createWorkFromAudioFile(repos, scanner, root, target, body, applyDlsiteCover);
  }
  throw new WorkRegisterError(
    "not_configured",
    "指定されたパスは存在しないか、ルート配下ではありません",
  );
}

async function createWorkFromAudioFile(
  repos: {
    db: Db;
    query: WorkQueryRepository;
    catalog: CatalogWorkRepository;
    user: UserWorkStateRepository;
  },
  scanner: Scanner,
  root: string,
  audioPath: string,
  body: WorkCreateBody,
  applyDlsiteCover?: (coverUrl: string, workDir: string) => Promise<string | null>,
): Promise<WorkSourceMutationResult> {
  const { query } = repos;
  const dbWork = query.getWorkByPhysicalPathSync(audioPath);
  assertRegistrationAllowed({
    alreadyRegistered: dbWork !== null || ancestorFolderIsRegistered(query, audioPath, root),
    descendantWorkCount: 0,
    kind: "file",
  });

  const metaPath = sidecarPathForAudio(audioPath);
  const parentDir = dirname(audioPath);
  const orphanedMeta = existsSync(metaPath);
  if (orphanedMeta) {
    let meta: MetaFile;
    try {
      meta = readMetaFile(metaPath);
    } catch (error) {
      if (error instanceof MetaParseError) {
        throw new WorkRegisterError("invalid_meta", "メタファイルが不正なため復元できません");
      }
      throw error;
    }

    const existing = query.getScanWorkMap().get(meta.id);
    if (existing && existing.physicalPath !== audioPath && existing.status !== "missing") {
      throw restoreIdentityConflictError();
    }

    const metaPatch: {
      title?: string;
      tags?: string[];
      urls?: Work["urls"];
      coverImage?: string | null;
      dlsite?: MetaFile["dlsite"];
    } = {};

    if (body.title !== meta.title) metaPatch.title = body.title;
    metaPatch.tags = body.tags;

    if (body.dlsite) {
      const applied = await buildMetaFromDlsiteApply(body.dlsite, parentDir, applyDlsiteCover);
      if (body.dlsite.applyUrl) {
        metaPatch.urls = [
          ...meta.urls.filter((entry) => !entry.url.includes("dlsite.com")),
          ...applied.urls,
        ];
      }
      if (applied.coverImage !== undefined) metaPatch.coverImage = applied.coverImage;
      metaPatch.dlsite = applied.dlsite;
    }

    return mutationResultFromProjectOutcome(
      await scanner.restoreSidecarWork(audioPath, metaPatch),
      audioPath,
    );
  }

  const title = body.title;
  const tags = body.tags;
  let urls: Work["urls"] = [];
  let coverImage: string | null | undefined;
  let dlsite = emptyMetaDlsiteState();

  if (body.dlsite) {
    const applied = await buildMetaFromDlsiteApply(body.dlsite, parentDir, applyDlsiteCover);
    urls = applied.urls;
    coverImage = applied.coverImage;
    dlsite = applied.dlsite;
  } else {
    const detectedRjCode = detectRjCode([basename(audioPath), title]);
    if (detectedRjCode) dlsite = { ...emptyMetaDlsiteState(), rjCode: detectedRjCode };
  }

  return mutationResultFromProjectOutcome(
    await scanner.registerFileWork(audioPath, {
      title,
      tags,
      urls,
      coverImage,
      dlsite,
    }),
    audioPath,
  );
}

async function buildMetaFromDlsiteApply(
  body: DlsiteRegistrationBody,
  workDir: string,
  applyDlsiteCover?: (coverUrl: string, workDir: string) => Promise<string | null>,
): Promise<DlsiteAppliedMeta> {
  let coverImage: string | null | undefined;
  if (body.applyCover && body.info.coverUrl) {
    if (!applyDlsiteCover) {
      throw new Error("DLsiteカバーの適用に必要な処理が構成されていません");
    }
    coverImage = await applyDlsiteCover(body.info.coverUrl, workDir);
    if (!coverImage) {
      throw new Error("DLsiteカバーの保存に失敗しました");
    }
  }

  return {
    urls: body.applyUrl && body.info.url ? [{ label: "DLsite", url: body.info.url }] : [],
    coverImage,
    dlsite: {
      rjCode: body.info.rjCode,
      status: "applied",
      appliedTags: body.applyTags,
    },
  };
}
