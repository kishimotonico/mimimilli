import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { setAppModeAtom } from "../../../shared/model/appModeAtoms";
import { workDetailIdAtom } from "../../../entities/work/model/navigationAtoms";
import { getWork } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

/** 全画面作品詳細のパンくず。「ライブラリ」クリックでライブラリ（右ペイン状態は
 *  保持済み）へ、作品名セグメントは末尾のためクリック不可。 */
export default function WorkDetailBreadcrumbs() {
  const workId = useAtomValue(workDetailIdAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const workQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.detail(workId ?? ""),
    queryFn: () => getWork(workId!),
    enabled: workId !== null,
  });

  const path = ["ライブラリ", workQuery.data?.title ?? ""];

  return (
    <Breadcrumbs
      path={path}
      onNavigate={(index) => {
        if (index === 0) setAppMode("library");
      }}
    />
  );
}
