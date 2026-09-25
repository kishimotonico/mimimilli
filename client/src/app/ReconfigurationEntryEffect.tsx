// reconfiguring画面（RootConfigurationScreen）と同じ枝でだけマウントされる。
// Reactはツリーの差し替え（通常UI→reconfiguring画面）をコミットしてからeffectを
// 走らせるため、このマウント時点で通常UIのquery observerは確実に消えている。
// removeReconfigurationAffectedQueriesはここでだけ安全に呼べる（ADR-0029）。
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { removeReconfigurationAffectedQueries } from "./model/resetLibraryForReconfiguration";

export default function ReconfigurationEntryEffect() {
  const queryClient = useQueryClient();
  useEffect(() => {
    removeReconfigurationAffectedQueries(queryClient);
  }, [queryClient]);
  return null;
}
