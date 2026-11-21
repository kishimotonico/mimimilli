import { useQuery } from "@tanstack/react-query";
import { scanDiagnosticsQueryOptions } from "../../../entities/scan/queryOptions";
import { buildNeedsAttentionRows, type NeedsAttentionRow } from "./needsAttention";

export interface NeedsAttentionRowsState {
  /** 診断を読めるまでは undefined */
  rows: NeedsAttentionRow[] | undefined;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

/** 診断はFilesでの解決や登録解除を随時反映する必要があるため、スキャン時点のスナップショットではなく
 *  常に最新を購読する。作品変更後のキャッシュ更新が同じキーを無効化する。 */
export function useNeedsAttentionRows(): NeedsAttentionRowsState {
  const query = useQuery({ ...scanDiagnosticsQueryOptions, select: buildNeedsAttentionRows });
  return {
    rows: query.data,
    loading: query.isPending,
    error: query.isError && query.data === undefined,
    retry: () => void query.refetch(),
  };
}
