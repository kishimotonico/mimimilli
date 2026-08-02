// ファイルモードからの手動作品登録。メタファイル生成と子作品の登録解除のみ行い、物理ファイルは移動しない。
import { existsSync, statSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import type {
  DlsiteApplyBody,
  MetaFile,
  Work,
  WorkCreateBody,
  WorkRegisterPreview,
} from "@mimimilli/shared";
import { emptyDlsiteState, normalizeTags } from "@mimimilli/shared";
import { detectRjCode } from "./dlsite.ts";
import { META_FILE_NAME, MetaParseError, readMetaFile, readMetaFileRaw } from "./meta.ts";
import { resolveWithin } from "./paths.ts";
import type { Scanner } from "./scanner.ts";
import type { WorkRepo } from "./workRepo.ts";

export class WorkRegisterError extends Error {
  readonly code:
    | "already_registered"
    | "descendants_require_merge"
    | "not_configured"
    | "invalid_meta";
  readonly descendantCount?: number;

  constructor(
    code: "already_registered" | "descendants_require_merge" | "not_configured" | "invalid_meta",
    message: string,
    descendantCount?: number,
  ) {
    super(message);
    this.name = "WorkRegisterError";
    this.code = code;
    this.descendantCount = descendantCount;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function deleteMetaFileOnly(metaPath: string): void {
  if (existsSync(metaPath)) unlinkSync(metaPath);
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

/** 登録解除時に削除するメタファイルパスを解決する。 */
function resolveMetaPathToDelete(
  workId: string,
  recordedMetaPath: string,
  physicalPath: string,
): string | null {
  if (existsSync(recordedMetaPath)) {
    return recordedMetaPath;
  }

  const folderMeta = folderMetaPathOf(physicalPath);
  if (existsSync(folderMeta) && metaFileIdMatches(folderMeta, workId)) {
    return folderMeta;
  }

  return null;
}

export function unregisterWork(repo: WorkRepo, workId: string): boolean {
  const target = repo.getWorkDeleteTarget(workId);
  if (!target) return false;

  const mediaRoot = repo.getMediaRoot(workId);
  if (mediaRoot) {
    const metaPathToDelete = resolveMetaPathToDelete(
      workId,
      target.metaPath,
      mediaRoot.physicalPath,
    );
    if (metaPathToDelete) deleteMetaFileOnly(metaPathToDelete);
  } else {
    deleteMetaFileOnly(target.metaPath);
  }

  return repo.deleteWork(workId) !== null;
}

function unregisterDescendantWorks(repo: WorkRepo, descendants: Array<{ id: string }>): void {
  const remaining: string[] = [];
  for (const child of descendants) {
    try {
      if (!unregisterWork(repo, child.id)) {
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

export function buildWorkRegisterPreview(repo: WorkRepo, workDir: string): WorkRegisterPreview {
  const folderName = basename(workDir);
  const descendants = repo.listDescendantWorkRefs(workDir);
  const metaPath = `${workDir}/${META_FILE_NAME}`;
  const dbWork = repo.getWorkByPhysicalPathSync(workDir);
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
  repo: WorkRepo,
  scanner: Scanner,
  root: string,
  body: WorkCreateBody,
  applyDlsiteCover?: (coverUrl: string, workDir: string) => Promise<string | null>,
): Promise<Work> {
  const workDir = resolveWithin(root, body.path);
  if (!workDir || !isDirectory(workDir)) {
    throw new WorkRegisterError(
      "not_configured",
      "指定されたパスは存在しないか、ルート配下ではありません",
    );
  }

  const metaPath = `${workDir}/${META_FILE_NAME}`;
  const dbWork = repo.getWorkByPhysicalPathSync(workDir);
  if (dbWork !== null) {
    throw new WorkRegisterError(
      "already_registered",
      "このフォルダーは既に作品として登録されています",
    );
  }

  const descendants = repo.listDescendantWorkRefs(workDir);
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
    metaPatch.tags = normalizeTags(body.tags);

    if (body.dlsite) {
      const applied = await buildMetaFromDlsiteApply(body.dlsite, workDir, applyDlsiteCover);
      metaPatch.urls = applied.urls;
      if (applied.coverImage !== undefined) metaPatch.coverImage = applied.coverImage;
      metaPatch.dlsite = applied.dlsite;
    }

    const work = await scanner.restoreFolderWork(workDir, metaPatch);
    unregisterDescendantWorks(repo, descendants);
    return work;
  }

  const title = body.title;
  const tags = normalizeTags(body.tags);
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
  unregisterDescendantWorks(repo, descendants);
  return work;
}

async function buildMetaFromDlsiteApply(
  body: DlsiteApplyBody,
  workDir: string,
  applyDlsiteCover?: (coverUrl: string, workDir: string) => Promise<string | null>,
): Promise<DlsiteAppliedMeta> {
  const applyTags = normalizeTags(body.applyTags);
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
    urls: body.info.url ? [{ label: "DLsite", url: body.info.url }] : [],
    coverImage,
    dlsite: {
      rjCode: body.info.rjCode,
      status: "applied",
      lastAttemptAt: new Date().toISOString(),
      error: null,
      errorKind: null,
      appliedTags: applyTags,
    },
  };
}
