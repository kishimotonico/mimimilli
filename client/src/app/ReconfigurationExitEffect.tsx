// root再設定（ADR-0029）離脱側の後処理。reconfigurationExitPendingAtomがtrueのまま
// readyへ到達したら、旧rootのクエリ破棄（reconfiguring画面が一度も描画されず
// ReconfigurationEntryEffectが呼ばれなかった場合の備え。既に破棄済みならremoveは
// 無害）・DLsite一括取得のattach判定を行いクリアする。readyの時点ではロックは
// 必ず解除済みなので、ここでのremoveQueriesは生きたobserverの再フェッチを止める
// 必要が無い。App.tsxはJotaiのread APIをimportしない方針のため、この専用
// コンポーネントに分離する。
import { useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { reconfigurationExitPendingAtom } from "../entities/settings/reconfigurationExitAtom";
import { removeReconfigurationAffectedQueries } from "./model/resetLibraryForReconfiguration";
import { SCAN_QUERY_KEYS } from "../entities/scan/queryKeys";
import { getLastScanResult } from "../features/scan/api";
import { useDlsiteBulkActions } from "../entities/dlsite/useDlsiteBulkActions";

export default function ReconfigurationExitEffect() {
  const queryClient = useQueryClient();
  const dlsiteBulk = useDlsiteBulkActions();
  const [pending, setPending] = useAtom(reconfigurationExitPendingAtom);
  // StrictModeの開発時二重effect対策。マウントごとに1回だけ実行する
  // （pendingはこの1回のマウント中は非同期にしか変わらないため、closureの
  // 値だけでは二重呼び出しを防げない）。
  const handledRef = useRef(false);

  useEffect(() => {
    if (!pending || handledRef.current) return;
    handledRef.current = true;
    setPending(false);
    removeReconfigurationAffectedQueries(queryClient);
    void queryClient
      .fetchQuery({ queryKey: SCAN_QUERY_KEYS.last(), queryFn: getLastScanResult })
      .then((last) => {
        if (last && last.result.insertedWorkIds.length > 0) dlsiteBulk.attach();
      })
      .catch(() => {});
  }, [pending, setPending, queryClient, dlsiteBulk]);

  return null;
}
