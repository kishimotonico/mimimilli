// ファイルモードからの手動作品登録。メタファイル生成と子作品の登録解除のみ行い、物理ファイルは移動しない。
import { existsSync, statSync, unlinkSync } from "node:fs";
import { basename } from "node:path";
import type { DlsiteApplyBody, Work, WorkCreateBody, WorkRegisterPreview } from "@mimimilli/shared";
import { emptyDlsiteState, normalizeTags } from "@mimimilli/shared";
import { detectRjCode } from "./dlsite.ts";
import { META_FILE_NAME } from "./meta.ts";
import { resolveWithin } from "./paths.ts";
import type { Scanner } from "./scanner.ts";
import type { WorkRepo } from "./workRepo.ts";

export class WorkRegisterError extends Error {
  readonly code: "already_registered" | "descendants_require_merge" | "not_configured";
  readonly descendantCount?: number;

  constructor(
    code: "already_registered" | "descendants_require_merge" | "not_configured",
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

export function unregisterWork(repo: WorkRepo, workId: string): boolean {
  const target = repo.getWorkDeleteTarget(workId);
  if (!target) return false;
  deleteMetaFileOnly(target.metaPath);
  return repo.deleteWork(workId) !== null;
}

export function buildWorkRegisterPreview(repo: WorkRepo, workDir: string): WorkRegisterPreview {
  const folderName = basename(workDir);
  const descendants = repo.listDescendantWorkRefs(workDir);
  return {
    suggestedTitle: folderName,
    detectedRjCode: detectRjCode([folderName]),
    descendantWorkCount: descendants.length,
    alreadyRegistered: repo.getWorkByPhysicalPathSync(workDir) !== null,
  };
}

export interface RegisterFolderMetaInput {
  title: string;
  tags: string[];
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

  if (existsSync(`${workDir}/${META_FILE_NAME}`) || repo.getWorkByPhysicalPathSync(workDir)) {
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

  let title = body.title;
  let tags: string[] = [];
  let urls: Work["urls"] = [];
  let coverImage: string | null | undefined;
  let dlsite = emptyDlsiteState();

  if (body.dlsite) {
    const applied = await buildMetaFromDlsiteApply(
      body.dlsite,
      workDir,
      body.title,
      applyDlsiteCover,
    );
    title = applied.title;
    tags = applied.tags;
    urls = applied.urls;
    coverImage = applied.coverImage;
    dlsite = applied.dlsite;
  } else {
    const detectedRjCode = detectRjCode([basename(workDir), title]);
    if (detectedRjCode) dlsite = { ...emptyDlsiteState(), rjCode: detectedRjCode };
  }

  for (const child of descendants) {
    if (!unregisterWork(repo, child.id)) {
      throw new Error(`子作品の登録解除に失敗しました: ${child.id}`);
    }
  }

  return scanner.registerFolderWork(workDir, {
    title,
    tags,
    urls,
    coverImage,
    dlsite,
  });
}

async function buildMetaFromDlsiteApply(
  body: DlsiteApplyBody,
  workDir: string,
  fallbackTitle: string,
  applyDlsiteCover?: (coverUrl: string, workDir: string) => Promise<string | null>,
): Promise<RegisterFolderMetaInput & { dlsite: Work["dlsite"] }> {
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
    title: body.applyTitle && body.info.title ? body.info.title : fallbackTitle,
    tags: applyTags,
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
