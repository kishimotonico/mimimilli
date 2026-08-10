import { existsSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { readMetaFileRaw } from "./meta.ts";
import { canonicalMetaPathFromStaging } from "./metaStaging.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { naturalCompare } from "./naturalCompare.ts";
import { markDirsWithMetaInSubtree, type WalkResult } from "./scanWalk.ts";

const scanLogger = getCategoryLogger("scan");

function readStagedMetaWorkId(stagedPath: string): string | null {
  try {
    const raw = readMetaFileRaw(stagedPath);
    if (typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string") {
      return raw.id;
    }
  } catch {
    return null;
  }
  return null;
}

function addCanonicalMetaToWalkResult(root: string, tree: WalkResult, canonicalPath: string): void {
  const dir = dirname(canonicalPath);
  tree.metaPaths.push(canonicalPath);
  tree.metaPaths.sort(naturalCompare);
  tree.metaDirs.add(dir);
  markDirsWithMetaInSubtree(dir, root, tree.dirsWithMetaInSubtree);
}

export function recoverStagedMetaFiles(
  root: string,
  tree: WalkResult,
  catalog: CatalogWorkRepository,
): void {
  for (const stagedPath of tree.stagedMetaPaths) {
    const workId = readStagedMetaWorkId(stagedPath);
    if (!workId) {
      scanLogger.warn("退避メタのIDを読み取れませんでした", { path: stagedPath });
      continue;
    }

    try {
      const canonicalPath = canonicalMetaPathFromStaging(stagedPath);
      const canonicalExists = existsSync(canonicalPath);
      const stagedExists = existsSync(stagedPath);

      if (canonicalExists && stagedExists) {
        unlinkSync(stagedPath);
        scanLogger.warn("退避メタを削除しました（正本と併存）", {
          stagedPath,
          canonicalPath,
          workId,
        });
        continue;
      }

      if (!canonicalExists && catalog.workExists(workId)) {
        renameSync(stagedPath, canonicalPath);
        addCanonicalMetaToWalkResult(root, tree, canonicalPath);
        scanLogger.warn("退避メタを正本へ復元しました", {
          stagedPath,
          canonicalPath,
          workId,
        });
        continue;
      }

      if (!canonicalExists && stagedExists) {
        unlinkSync(stagedPath);
        scanLogger.warn("退避メタを削除しました（登録解除済み）", { stagedPath, workId });
      }
    } catch (error) {
      scanLogger.warn("退避メタの回収に失敗しました", {
        path: stagedPath,
        error: (error as Error).message,
      });
    }
  }
}
