// ファイルモードからの手動作品登録。メタファイル生成のみ行い、物理ファイルは移動しない。
import { existsSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type {
  DlsiteRegistrationBody,
  MetaFile,
  Work,
  WorkCreateBody,
  WorkRegisterPreview,
  WorkSourceMutationResult,
} from "@mimimilli/shared";
import { detectRjCode, emptyMetaDlsiteState, isDlsiteUrl } from "@mimimilli/shared";
import { inspectMetaFile } from "./meta.ts";
import { metaStagingPath } from "./metaStaging.ts";
import { identityConflictPathOf, resolveWithin, toPortableRelativePath } from "./paths.ts";
import { CoverSaveError, WorkRegisterError } from "../../errors.ts";
import { assertRegistrationAllowed } from "../../core/workRegistrationGuard.ts";
import { fileRegisterNaming, folderRegisterNaming } from "../../core/workRegisterPreview.ts";
import { removeIdentityConflictPath } from "../../core/identityConflicts.ts";
import { isPathWithin } from "../../lib/path.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { Scanner } from "./scanner.ts";
import type { StagedCover } from "./dlsiteFetch.ts";
import type { ProjectOutcome, RestoreMetaPatch } from "./scanTypes.ts";
import {
  assertNoIdentityConflict,
  inspectOrphanMeta,
  registrationConflictCheck,
  registrationTargetOfPath,
  targetName,
  type RegistrationTarget,
} from "./registrationTarget.ts";
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

function metaFileIdMatches(metaPath: string, workId: string): boolean {
  try {
    return inspectMetaFile(metaPath).declaredId === workId;
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
function resolveMetaDeletionPlan(workId: string, metaPath: string): MetaDeletionPlan | null {
  const staged = findStagedMetaPlan(workId, metaPath);
  if (staged) return staged;
  if (existsSync(metaPath)) {
    return { canonicalPath: metaPath, stagedPath: metaStagingPath(metaPath) };
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
  catalog: CatalogWorkRepository,
  user: UserWorkStateRepository,
  root: string,
  workId: string,
): boolean {
  const target = catalog.getWorkDeleteTarget(workId);
  if (!target) return false;

  const metaPlan = resolveMetaDeletionPlan(workId, target.metaPath);
  if (metaPlan) stageMetaForDeletion(metaPlan);

  // 旧rootを指すmissing作品などmetaPathが現在のroot配下にない場合、identity_conflict診断に
  // このpathは載り得ないので算出をスキップする（root外パスの相対化は例外になる）。
  const conflictPath = isPathWithin(root, target.metaPath)
    ? identityConflictPathOf(root, target.metaPath)
    : null;

  try {
    const deleted = catalog.deleteWorkCatalog(workId);
    if (!deleted) {
      if (metaPlan) restoreStagedMeta(metaPlan);
      return false;
    }
    user.deleteWorkUserState(workId);
    if (isPathWithin(root, target.metaPath)) {
      catalog.removeInvalidMetaFile(toPortableRelativePath(root, target.metaPath));
    }
    if (conflictPath !== null) {
      catalog.replaceIdentityConflicts(
        removeIdentityConflictPath(catalog.listIdentityConflicts(), workId, conflictPath),
      );
    }
    if (metaPlan) deleteStagedMeta(metaPlan);
    return true;
  } catch (error) {
    if (metaPlan) restoreStagedMeta(metaPlan);
    throw error;
  }
}

export function buildWorkRegisterPreview(
  query: WorkQueryRepository,
  target: RegistrationTarget,
  root: string,
): WorkRegisterPreview {
  const name = targetName(target);
  const naming =
    target.placement.kind === "folder" ? folderRegisterNaming(name) : fileRegisterNaming(name);
  const conflict = registrationConflictCheck(query, target, root);
  const orphan =
    query.getWorkByPhysicalPathSync(target.physicalPath) === null
      ? inspectOrphanMetaForPreview(target)
      : null;

  return {
    suggestedTitle: orphan?.meta?.title ?? naming.suggestedTitle,
    tags: orphan?.meta?.tags ?? [],
    detectedRjCode: naming.detectedRjCode,
    descendantWorkCount: conflict.descendantWorkCount,
    alreadyRegistered: conflict.alreadyRegistered,
    orphanedMeta: orphan !== null,
  };
}

// メタ不正・読み取り失敗は preview では隠蔽せず名前へフォールバックする。POST で invalid_meta を返す。
function inspectOrphanMetaForPreview(target: RegistrationTarget): { meta: MetaFile | null } | null {
  if (!existsSync(target.placement.metaPath)) return null;
  try {
    return inspectOrphanMeta(target);
  } catch {
    return { meta: null };
  }
}

/** DLsite適用結果のうち、フォーム由来の title/tags を上書きしない部分だけを表す */
interface DlsiteAppliedMeta {
  urls: Work["urls"];
  cover: StagedCover | null;
  dlsite: MetaFile["dlsite"];
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
  stageDlsiteCover?: (coverUrl: string, workDir: string) => Promise<StagedCover | null>,
): Promise<WorkSourceMutationResult> {
  const { query } = repos;
  const path = resolveWithin(root, join(root, body.path));
  const target = path ? registrationTargetOfPath(path) : null;
  if (!target) {
    throw new WorkRegisterError(
      "invalid_path",
      "指定されたパスは存在しないか、ルート配下ではありません",
    );
  }
  assertRegistrationAllowed(registrationConflictCheck(query, target, root));

  const assetDir = target.placement.mediaRoot;
  const orphan = inspectOrphanMeta(target);
  if (orphan) {
    if (orphan.diagnostic !== null) {
      throw new WorkRegisterError("invalid_meta", "メタファイルが不正なため復元できません");
    }
    const { meta } = orphan;
    assertNoIdentityConflict(query, meta.id, target.physicalPath);

    const metaPatch: RestoreMetaPatch = {};
    if (body.title !== meta.title) metaPatch.title = body.title;
    // body.tags は workCreateBodySchema の境界で既に正規化済み（NormalizedTag[]）。
    metaPatch.tags = body.tags;

    let cover: StagedCover | null = null;
    try {
      if (body.dlsite) {
        const applied = await buildMetaFromDlsiteApply(body.dlsite, assetDir, stageDlsiteCover);
        cover = applied.cover;
        if (body.dlsite.applyUrl) {
          metaPatch.urls = [
            ...meta.urls.filter((entry) => !isDlsiteUrl(entry.url)),
            ...applied.urls,
          ];
        }
        if (cover) metaPatch.coverImage = cover.fileName;
        metaPatch.dlsite = applied.dlsite;
      }
      cover?.commit();
      return mutationResultFromProjectOutcome(
        await scanner.restoreWork(target, metaPatch),
        target.physicalPath,
      );
    } finally {
      cover?.discard();
    }
  }

  const title = body.title;
  let urls: Work["urls"] = [];
  let cover: StagedCover | null = null;
  let dlsite = emptyMetaDlsiteState();

  try {
    if (body.dlsite) {
      const applied = await buildMetaFromDlsiteApply(body.dlsite, assetDir, stageDlsiteCover);
      urls = applied.urls;
      cover = applied.cover;
      dlsite = applied.dlsite;
    } else {
      const detectedRjCode = detectRjCode([targetName(target), title]);
      if (detectedRjCode) dlsite = { ...emptyMetaDlsiteState(), rjCode: detectedRjCode };
    }

    cover?.commit();
    return mutationResultFromProjectOutcome(
      await scanner.registerWork(target, {
        title,
        tags: body.tags,
        urls,
        coverImage: cover?.fileName,
        dlsite,
      }),
      target.physicalPath,
    );
  } finally {
    cover?.discard();
  }
}

async function buildMetaFromDlsiteApply(
  body: DlsiteRegistrationBody,
  workDir: string,
  stageDlsiteCover?: (coverUrl: string, workDir: string) => Promise<StagedCover | null>,
): Promise<DlsiteAppliedMeta> {
  let cover: StagedCover | null = null;
  if (body.applyCover && body.info.coverUrl) {
    if (!stageDlsiteCover) {
      throw new Error("DLsiteカバーの適用に必要な処理が構成されていません");
    }
    cover = await stageDlsiteCover(body.info.coverUrl, workDir);
    if (!cover) {
      throw new CoverSaveError();
    }
  }

  return {
    urls: body.applyUrl && body.info.url ? [{ label: "DLsite", url: body.info.url }] : [],
    cover,
    dlsite: {
      rjCode: body.info.rjCode,
      status: "applied",
      appliedTags: body.applyTags,
    },
  };
}
