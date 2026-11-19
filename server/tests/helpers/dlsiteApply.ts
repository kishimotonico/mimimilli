import assert from "node:assert/strict";
import type { DlsiteApplySelection, DlsiteWorkFetchResult } from "@mimimilli/shared";
import type { DataAdapter } from "../../src/adapter/index.ts";

export type FetchedDlsite = Extract<DlsiteWorkFetchResult, { ok: true }>;

export const APPLY_NOTHING: DlsiteApplySelection = {
  title: false,
  cover: false,
  url: false,
  tags: [],
};

/** 作品のRJコードを揃えてから作品単位で取得し、適用に使う版と情報を返す */
export async function fetchDlsiteForWork(
  adapter: DataAdapter,
  workId: string,
  rjCode: string,
  force = false,
): Promise<FetchedDlsite> {
  const snapshot = await adapter.getWorkEditSnapshot(workId);
  assert.ok(snapshot);
  if (snapshot.dlsite.rjCode !== rjCode) {
    await adapter.updateDlsiteState(workId, { sourceRevision: snapshot.sourceRevision, rjCode });
  }
  const result = await adapter.dlsiteFetch(workId, force);
  assert.equal(result.ok, true, result.ok ? undefined : result.message);
  return result as FetchedDlsite;
}

/** 取得済みの版で適用する。sourceRevision は呼び出し時点の最新 */
export async function applyFetchedDlsite(
  adapter: DataAdapter,
  workId: string,
  fetched: Pick<FetchedDlsite, "infoRevision">,
  apply: Partial<DlsiteApplySelection>,
) {
  const snapshot = await adapter.getWorkEditSnapshot(workId);
  assert.ok(snapshot);
  return adapter.dlsiteApply(workId, {
    sourceRevision: snapshot.sourceRevision,
    infoRevision: fetched.infoRevision,
    apply: { ...APPLY_NOTHING, ...apply },
  });
}
