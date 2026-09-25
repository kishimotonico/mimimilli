// root再設定（ADR-0029）離脱側の後処理。reconfigurationExitEpochAtomが未処理の値へ
// 進むたびに、旧rootのクエリ破棄・DLsite一括取得のattach判定を行う。readyの時点では
// ロックは必ず解除済みなので、通常UIのobserverが生きていても構わない
// （resetQueries: activeなクエリは自動で再取得される。removeだとその時点で走っている
// fetchごと破棄され、observerが再開せずpendingのまま残ることがある）。
// App.tsxはJotaiのread APIをimportしない方針のため、この専用コンポーネントに分離する。
import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { reconfigurationExitEpochAtom } from "../entities/settings/reconfigurationExitAtom";
import { resetReconfigurationAffectedQueries } from "./model/resetLibraryForReconfiguration";
import { SCAN_QUERY_KEYS } from "../entities/scan/queryKeys";
import { getLastScanResult } from "../features/scan/api";
import { useDlsiteBulkActions } from "../entities/dlsite/useDlsiteBulkActions";

export default function ReconfigurationExitEffect() {
  const queryClient = useQueryClient();
  const dlsiteBulk = useDlsiteBulkActions();
  const epoch = useAtomValue(reconfigurationExitEpochAtom);
  // 処理済みepochをrefで持つ。StrictModeの開発時二重effectでも同じ値なら1回しか
  // 処理しない一方、処理中に新しいepochが積まれても（値が変わるので）取りこぼさない。
  const processedEpochRef = useRef(0);

  useEffect(() => {
    if (epoch === processedEpochRef.current) return;
    processedEpochRef.current = epoch;
    resetReconfigurationAffectedQueries(queryClient);
    void queryClient
      .fetchQuery({ queryKey: SCAN_QUERY_KEYS.last(), queryFn: getLastScanResult })
      .then((last) => {
        if (last && last.result.insertedWorkIds.length > 0) dlsiteBulk.attach();
      })
      .catch(() => {});
  }, [epoch, queryClient, dlsiteBulk]);

  return null;
}
