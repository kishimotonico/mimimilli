import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { ALL_SMART_FOLDER_ID } from "@mimimilli/shared";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { setAppModeAtom } from "../../../entities/navigation/model/appRouteStore";
import { workDetailIdAtom } from "../../../entities/work/model/navigationAtoms";
import { workDetailQueryOptions } from "../../../entities/work/workDetailQueryOptions";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { LIBRARY_ROOT_LABEL } from "./LibraryBreadcrumbs";

/** 「ライブラリ / 元のスマートフォルダー名（/ 値） / 作品名」。「ライブラリ」は「すべて」へ、
 *  グループの値があるときのスマートフォルダー名はその値一覧へ、作品名の直前の段は保持している
 *  状態のまま一覧へ戻る。ライブラリ側のパンくずと同じラベルは同じ行き先になる。作品名は末尾のためクリック不可。 */
export default function WorkDetailBreadcrumbs() {
  const workId = useAtomValue(workDetailIdAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const nav = useLibraryNavigation();
  const workQuery = useQuery(workDetailQueryOptions(workId));

  const held = nav.foldersStatus === "ready" ? nav.view : null;
  const heldCrumbs = held?.breadcrumb ?? [];
  const hasHeldGroup = held?.kind === "works" && held.group !== null;
  const path = [LIBRARY_ROOT_LABEL, ...heldCrumbs, workQuery.data?.title ?? ""];

  return (
    <Breadcrumbs
      path={path}
      onNavigate={(index) => {
        if (index === 0) nav.openFolder(ALL_SMART_FOLDER_ID);
        else if (index === 1 && hasHeldGroup) nav.goToSegment(0);
        else if (index < path.length - 1) setAppMode("library");
      }}
    />
  );
}
