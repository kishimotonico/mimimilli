import { join } from "node:path";
import type { Work } from "@mimimilli/shared";
import type { WorkRepo } from "../../src/adapters/real/workRepo.ts";

/** フォルダー形式作品のテスト用メタパス（physicalPath 直下の .meta.json） */
export function folderMetaPath(physicalPath: string): string {
  return join(physicalPath, ".meta.json");
}

export function upsertTestWork(repo: WorkRepo, work: Work, metaPath?: string): void {
  repo.upsertWork(work, { metaPath: metaPath ?? folderMetaPath(work.physicalPath) });
}
