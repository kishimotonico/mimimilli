import { join } from "node:path";
import { resolveRegularFileWithin } from "./paths.ts";
import { thumbnailCacheNames } from "./thumbnailCache.ts";
import type { ListSummariesResult } from "./workRowMapping.ts";

export type CoverSnapshotGapReason =
  | "work-load-failed"
  | "cover-unmeasured"
  | "cover-path-unresolved";

export interface CoverSnapshotGap {
  workId: string;
  reason: CoverSnapshotGapReason;
}

export interface CoverSnapshot {
  workCount: number;
  validNames: Set<string>;
  gaps: CoverSnapshotGap[];
}

export function isCoverSnapshotComplete(snapshot: CoverSnapshot): boolean {
  return snapshot.workCount > 0 && snapshot.gaps.length === 0;
}

export function countCoverSnapshotGapsByReason(
  gaps: CoverSnapshotGap[],
): Partial<Record<CoverSnapshotGapReason, number>> {
  const counts: Partial<Record<CoverSnapshotGapReason, number>> = {};
  for (const gap of gaps) {
    counts[gap.reason] = (counts[gap.reason] ?? 0) + 1;
  }
  return counts;
}

export async function buildCoverSnapshot(
  result: ListSummariesResult,
  options?: { throwIfCancelled?: () => void },
): Promise<CoverSnapshot> {
  const checkpoint = options?.throwIfCancelled ?? (() => {});
  const gaps: CoverSnapshotGap[] = [];
  const validNames = new Set<string>();

  for (const skip of result.skipped) {
    gaps.push({ workId: skip.workId, reason: "work-load-failed" });
  }
  for (const workId of result.unmeasuredCovers) {
    gaps.push({ workId, reason: "cover-unmeasured" });
  }

  checkpoint();
  for (const work of result.summaries) {
    checkpoint();
    if (!work.cover) continue;
    const placement = result.placements.get(work.id);
    if (!placement) throw new Error(`作品の配置がありません: ${work.id}`);
    const { mediaRoot } = placement;
    const file = resolveRegularFileWithin(mediaRoot, join(mediaRoot, work.cover.image));
    if (!file) {
      gaps.push({ workId: work.id, reason: "cover-path-unresolved" });
      continue;
    }
    for (const name of thumbnailCacheNames(work.id, file)) {
      validNames.add(name);
    }
    checkpoint();
  }

  return {
    workCount: result.summaries.length,
    validNames,
    gaps,
  };
}
