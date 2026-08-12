// ファイルモードからの手動作品登録。メタファイル生成と子作品の登録解除のみ行い、物理ファイルは移動しない。
import { existsSync, renameSync, statSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import type {
  DlsiteRegistrationBody,
  MetaFile,
  Work,
  WorkCreateBody,
  WorkRegisterPreview,
} from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { detectRjCode } from "./dlsite.ts";
import { META_FILE_NAME, MetaParseError, readMetaFile, readMetaFileRaw } from "./meta.ts";
import { metaStagingPath } from "./metaStaging.ts";
import { resolveWithin } from "./paths.ts";
import { WorkRegisterError } from "../../errors.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { Scanner } from "./scanner.ts";

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
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
    const folderMeta = folderMetaPathOf(physicalPath);
    const stagedAtFolder = findStagedMetaPlan(workId, folderMeta);
    if (stagedAtFolder) return stagedAtFolder;
    if (existsSync(folderMeta) && metaFileIdMatches(folderMeta, workId)) {
      return { canonicalPath: folderMeta, stagedPath: metaStagingPath(folderMeta) };
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

function unregisterDescendantWorks(
  query: WorkQueryRepository,
  catalog: CatalogWorkRepository,
  user: UserWorkStateRepository,
  descendants: Array<{ id: string }>,
): void {
  const remaining: string[] = [];
  for (const child of descendants) {
    try {
      if (!unregisterWork(query, catalog, user, child.id)) {
        remaining.push(child.id);
      }
    } catch {
      remaining.push(child.id);
    }
  }
  if (remaining.length > 0) {
    throw new Error(
      `親作品の登録は完了しましたが、子作品の登録解除に失敗しました。残存した子作品ID: ${remaining.join(", ")}`,
    );
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

/** DLsite適用結果のうち、フォーム由来の title/tags を上書きしない部分だけを表す */
interface DlsiteAppliedMeta {
  urls: Work["urls"];
  coverImage?: string | null;
  dlsite: Work["dlsite"];
}

export async function createWorkFromFolder(
  repos: {
    query: WorkQueryRepository;
    catalog: CatalogWorkRepository;
    user: UserWorkStateRepository;
  },
  scanner: Scanner,
  root: string,
  body: WorkCreateBody,
  applyDlsiteCover?: (coverUrl: string, workDir: string) => Promise<string | null>,
): Promise<Work> {
  const { query, catalog, user } = repos;
  const workDir = resolveWithin(root, join(root, body.path));
  if (!workDir || !isDirectory(workDir)) {
    throw new WorkRegisterError(
      "not_configured",
      "指定されたパスは存在しないか、ルート配下ではありません",
    );
  }

  const metaPath = `${workDir}/${META_FILE_NAME}`;
  const dbWork = query.getWorkByPhysicalPathSync(workDir);
  if (dbWork !== null) {
    throw new WorkRegisterError(
      "already_registered",
      "このフォルダーは既に作品として登録されています",
    );
  }

  const descendants = query.listDescendantWorkRefs(workDir);
  if (descendants.length > 0 && !body.mergeDescendantWorks) {
    throw new WorkRegisterError(
      "descendants_require_merge",
      `配下に登録済み作品が${descendants.length}件あります。統合するには mergeDescendantWorks を指定してください`,
      descendants.length,
    );
  }

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

    const metaPatch: {
      title?: string;
      tags?: string[];
      urls?: Work["urls"];
      coverImage?: string | null;
      dlsite?: Work["dlsite"];
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

    const work = await scanner.restoreFolderWork(workDir, metaPatch);
    unregisterDescendantWorks(query, catalog, user, descendants);
    return work;
  }

  const title = body.title;
  // body.tags は workCreateBodySchema の境界で既に正規化済み（NormalizedTag[]）。
  const tags = body.tags;
  let urls: Work["urls"] = [];
  let coverImage: string | null | undefined;
  let dlsite = emptyDlsiteState();

  if (body.dlsite) {
    const applied = await buildMetaFromDlsiteApply(body.dlsite, workDir, applyDlsiteCover);
    urls = applied.urls;
    coverImage = applied.coverImage;
    dlsite = applied.dlsite;
  } else {
    const detectedRjCode = detectRjCode([basename(workDir), title]);
    if (detectedRjCode) dlsite = { ...emptyDlsiteState(), rjCode: detectedRjCode };
  }

  const work = await scanner.registerFolderWork(workDir, {
    title,
    tags,
    urls,
    coverImage,
    dlsite,
  });
  unregisterDescendantWorks(query, catalog, user, descendants);
  return work;
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
      lastAttemptAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      appliedTags: body.applyTags,
    },
  };
}
