// root再設定に入った時点で、旧rootに紐づくキャッシュを丸ごと破棄する（ADR-0029）。
// markReconfigurationAffectedQueriesStale（202直後、refetchType:"none"でstale化のみ）と
// removeReconfigurationAffectedQueries（通常UIのobserverが確実に消えた後にだけ呼ぶ、
// 実際の破棄）の2つに分かれているのは、生きたobserverがある間にremoveすると即座に
// 再フェッチしてロック中APIへ409を飛ばすため（呼び出し側はApp.ReconfigurationEntryEffect・
// ReconfigurationExitEffect参照）。
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
