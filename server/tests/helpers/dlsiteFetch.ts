import { hasRjCode } from "@mimimilli/shared";
import type { DataAdapter } from "../../src/adapter/index.ts";
import { listWorks } from "./workList.ts";

export interface WorkFetchCounts {
  fetched: number;
  failed: number;
  skipped: number;
}

/**
 * テストのセットアップ用。RJコードを持つ作品（applied・skipped を除く）が使うproduct codeを
 * 重複なく取得し、作品数で集計する。workIds省略時は全作品。
 */
export async function fetchDlsiteOfWorks(
  adapter: DataAdapter,
  workIds?: string[],
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<WorkFetchCounts> {
  const works = workIds
    ? (await Promise.all(workIds.map((id) => adapter.getWork(id)))).filter(
        (work): work is NonNullable<typeof work> => work !== null && work !== undefined,
      )
    : (await listWorks(adapter, { sort: "id-asc", limit: 500 })).items;
  const counts: WorkFetchCounts = { fetched: 0, failed: 0, skipped: 0 };
  const outcomes = new Map<string, string>();
  for (const work of works) {
    if (
      !hasRjCode(work.dlsite) ||
      work.dlsite.status === "skipped" ||
      work.dlsite.status === "applied"
    ) {
      counts.skipped += 1;
      continue;
    }
    const code = work.dlsite.rjCode;
    let outcome = outcomes.get(code);
    if (!outcome) {
      outcome = (
        await adapter.fetchDlsiteProduct(code, {
          force: options.force ?? false,
          signal: options.signal,
        })
      ).state;
      outcomes.set(code, outcome);
    }
    if (outcome === "fetched" || outcome === "cover_missing") counts.fetched += 1;
    else counts.failed += 1;
  }
  return counts;
}
