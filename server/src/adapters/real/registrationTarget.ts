// 作品登録の対象。配置形式（ADR-0032）ごとの差をここに閉じ込める。
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  META_FILE_NAME,
  isAudioFileName,
  sidecarMetaFileName,
  workPlacementOf,
} from "@mimimilli/shared";
import type { WorkPlacement } from "@mimimilli/shared";
import type { RegistrationConflictCheck } from "../../core/workRegistrationGuard.ts";
import { restoreIdentityConflictError } from "../../errors.ts";
import { inspectMetaFile, type MetaInspection } from "./meta.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

export interface RegistrationTarget {
  placement: WorkPlacement;
  /** 作品の物理パス。フォルダー形式はフォルダー、単一ファイル形式は音声ファイル */
  physicalPath: string;
}

export function folderTarget(workDir: string): RegistrationTarget {
  return {
    placement: workPlacementOf(join(workDir, META_FILE_NAME)),
    physicalPath: workDir,
  };
}

export function audioFileTarget(audioPath: string): RegistrationTarget {
  return {
    placement: workPlacementOf(join(dirname(audioPath), sidecarMetaFileName(basename(audioPath)))),
    physicalPath: audioPath,
  };
}

/** フォルダーまたは音声ファイルのパスから登録対象を得る。それ以外は null */
export function registrationTargetOfPath(path: string): RegistrationTarget | null {
  try {
    const stat = statSync(path);
    if (stat.isDirectory()) return folderTarget(path);
    if (stat.isFile() && isAudioFileName(basename(path))) return audioFileTarget(path);
  } catch {
    return null;
  }
  return null;
}

export function targetName(target: RegistrationTarget): string {
  return basename(target.physicalPath);
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

/** 登録済み判定と祖先・子孫ガードの入力。フォルダー形式は子孫、単一ファイル形式は祖先フォルダーを見る */
export function registrationConflictCheck(
  query: WorkQueryRepository,
  target: RegistrationTarget,
  root: string,
): RegistrationConflictCheck {
  const registered = query.getWorkByPhysicalPathSync(target.physicalPath) !== null;
  if (target.placement.kind === "folder") {
    return {
      alreadyRegistered: registered,
      descendantWorkCount: query.listDescendantWorkRefs(target.physicalPath).length,
      kind: "folder",
    };
  }
  return {
    alreadyRegistered: registered || ancestorFolderIsRegistered(query, target.physicalPath, root),
    descendantWorkCount: 0,
    kind: "file",
  };
}

/** 登録先に孤立メタがあれば読み込む。不正なメタも診断つきで返す */
export function inspectOrphanMeta(target: RegistrationTarget): MetaInspection | null {
  const { metaPath } = target.placement;
  return existsSync(metaPath) ? inspectMetaFile(metaPath) : null;
}

/** 同じ Work ID が別の場所で登録済み（missing を除く）なら復元できない */
export function assertNoIdentityConflict(
  query: WorkQueryRepository,
  workId: string,
  physicalPath: string,
): void {
  const existing = query.getScanWorkMap().get(workId);
  if (existing && existing.physicalPath !== physicalPath && existing.status !== "missing") {
    throw restoreIdentityConflictError();
  }
}
