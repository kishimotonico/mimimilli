import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { appModeAtom, setAppModeAtom } from "../../../entities/navigation/model/appRouteStore";
import { libraryTotalQueryOptions } from "../../../entities/work/libraryTotalQueryOptions";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { computeCollectionStatsDisplay } from "../model/libraryPresentation";
import { useDataIntegrityCount } from "../model/useDataIntegrityCount";
import { isRefined } from "../model/saveSearch";
import { useOpenSaveDialog } from "../model/useSaveSearch";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import LibrarySidebarPanel, { type SidebarFolders } from "./LibrarySidebarPanel";

/** ライブラリ・作品詳細の左に出るサイドバー1本（ADR-0041）。シェルのスロットへ渡す */
export default function LibrarySidebar() {
  const nav = useLibraryNavigation();
  const openSaveDialog = useOpenSaveDialog(nav.foldersStatus === "ready" ? nav.view : null);
  const mode = useAtomValue(appModeAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const dataIntegrity = useDataIntegrityCount();
  const { tagPrefixes } = useTagPrefixes();
  const totalQuery = useQuery(libraryTotalQueryOptions);
  const stats = computeCollectionStatsDisplay(
    totalQuery.isLoading,
    totalQuery.isError,
    totalQuery.data?.total,
    totalQuery.data?.stats,
  );

  const folders: SidebarFolders =
    nav.foldersStatus === "ready"
      ? { status: "ready", folders: nav.folders }
      : nav.foldersStatus === "error"
        ? { status: "error", onRetry: nav.refetchFolders }
        : { status: "pending" };
  const ready = nav.foldersStatus === "ready" ? nav : null;
  const activeFolderId = ready?.view.folder.id ?? null;

  return (
    <LibrarySidebarPanel
      folders={folders}
      activeFolderId={activeFolderId}
      activeGroup={ready?.view.kind === "works" ? ready.view.group : null}
      dataIntegrity={dataIntegrity}
      tagPrefixes={tagPrefixes}
      stats={stats}
      filtered={ready?.view.kind === "works" && isRefined(ready.view)}
      onSaveSearch={openSaveDialog}
      onOpenFolder={(folderId) => {
        // 作品詳細・再生中から元のスマートフォルダーの行を押したときは、保持している状態のまま戻る
        if (mode !== "library" && folderId === activeFolderId) setAppMode("library");
        else nav.openFolder(folderId);
      }}
      onOpenGroupValue={nav.openGroupValue}
      onAddTag={nav.addTag}
    />
  );
}
