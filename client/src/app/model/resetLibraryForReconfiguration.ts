// root再設定に入った時点で、旧rootに紐づくキャッシュを丸ごと破棄する（ADR-0029）。
// 2段階に分ける必要があるのは、開始成功の直後はまだ通常UI（Library等）がアンマウント
// される前で、そこでremoveQueriesすると生きたobserverが即座に再フェッチしてロック中の
// APIへ409を飛ばしてしまうため。
// 1. markReconfigurationAffectedQueriesStale: 開始成功直後に呼ぶ。refetchType:"none"で
//    即時フェッチを起こさずstale化だけする（フィクスチャの高速完了レースへの備え）
// 2. removeReconfigurationAffectedQueries: 画面がreconfiguring表示に切り替わり、
//    通常UIのobserverが消えた後に呼ぶ。invalidateではなくremoveなので、復帰時は古いデータの
//    一瞬の表示（stale-while-revalidate）を挟まず必ず新規取得になる
import type { QueryClient } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../entities/tag/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../entities/file-system/queryKeys";

// entities/scan/queryKeys.ts の全キー（last/candidates/candidateExclusions/diagnostics）は
// すべて["scan", ...]配下なので、ルートの["scan"]だけで丸ごと対象にできる
// （個別に列挙すると新規キー追加時に破棄漏れが起きる）。
const SCAN_QUERY_KEYS_ROOT = ["scan"] as const;

function reconfigurationAffectedQueryKeys(): readonly (readonly unknown[])[] {
  return [
    WORK_QUERY_KEYS.all(),
    WORK_QUERY_KEYS.allDetails(),
    WORK_QUERY_KEYS.allFacets(),
    WORK_QUERY_KEYS.dlsiteNotifications(),
    SMART_FOLDER_QUERY_KEYS.all(),
    SMART_FOLDER_QUERY_KEYS.allWorks(),
    TAG_QUERY_KEYS.all(),
    TAG_QUERY_KEYS.prefixes(),
    SCAN_QUERY_KEYS_ROOT,
    FILE_SYSTEM_QUERY_KEYS.all(),
  ];
}

export function markReconfigurationAffectedQueriesStale(queryClient: QueryClient): void {
  for (const queryKey of reconfigurationAffectedQueryKeys()) {
    void queryClient.invalidateQueries({ queryKey, refetchType: "none" });
  }
}

export function removeReconfigurationAffectedQueries(queryClient: QueryClient): void {
  for (const queryKey of reconfigurationAffectedQueryKeys()) {
    queryClient.removeQueries({ queryKey });
  }
}
