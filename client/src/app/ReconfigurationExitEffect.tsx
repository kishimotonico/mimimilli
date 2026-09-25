// root再設定（ADR-0029）離脱側の後処理。reconfigurationExitPendingAtomがtrueのまま
// readyへ到達したらDLsite一括取得のattach判定を行いクリアする。
// App.tsxはJotaiのread APIをimportしない方針のため、この専用コンポーネントに分離する。
import { useEffect } from "react";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { reconfigurationExitPendingAtom } from "../entities/settings/reconfigurationExitAtom";
import { SCAN_QUERY_KEYS } from "../entities/scan/queryKeys";
import { getLastScanResult } from "../features/scan/api";
import { useDlsiteBulkActions } from "../entities/dlsite/useDlsiteBulkActions";

export default function ReconfigurationExitEffect() {
  const queryClient = useQueryClient();
  const dlsiteBulk = useDlsiteBulkActions();
  const [pending, setPending] = useAtom(reconfigurationExitPendingAtom);

  useEffect(() => {
    if (!pending) return;
    setPending(false);
    void queryClient
      .fetchQuery({ queryKey: SCAN_QUERY_KEYS.last(), queryFn: getLastScanResult })
      .then((last) => {
        if (last && last.result.insertedWorkIds.length > 0) dlsiteBulk.attach();
      })
      .catch(() => {});
  }, [pending, setPending, queryClient, dlsiteBulk]);

  return null;
}
