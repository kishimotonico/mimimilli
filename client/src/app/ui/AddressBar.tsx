import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { appModeAtom, setAppModeAtom } from "../../entities/navigation/model/appRouteStore";
import { libraryViewModeAtom } from "../../features/library/model/atoms";
import LibraryGridControls from "../../features/library/ui/LibraryGridControls";
import LibraryBreadcrumbs from "../../features/library/ui/LibraryBreadcrumbs";
import WorkDetailBreadcrumbs from "../../features/library/ui/WorkDetailBreadcrumbs";
import LibrarySortMenu from "../../features/library/ui/LibrarySortMenu";
import FilesBreadcrumbs from "../../features/files/ui/FilesBreadcrumbs";
import FilesAddressBarMenu from "../../features/files/ui/FilesAddressBarMenu";
import NavigationHistoryButtons from "./NavigationHistoryButtons";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";
import ToolButton from "../../shared/ui/ToolButton";
import SidebarToggleButton from "../../features/library/ui/SidebarToggleButton";

export default function AddressBar() {
  const mode = useAtomValue(appModeAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const [libraryViewMode, setLibraryViewMode] = useAtom(libraryViewModeAtom);
  const availableViewModes: readonly ("column" | "list" | "grid")[] =
    mode === "library" ? ["list", "grid"] : ["column"];

  // list/grid の決定は libraryViewModeAtom のみに依存する（ADR-0012 §3）。
  const showGrid = libraryViewMode === "grid";

  return (
    <div className="mle-addr is-lib">
      {mode === "files" ? (
        <ToolButton icon={I.chevL} compact onClick={() => setAppMode("library")}>
          ライブラリへ戻る
        </ToolButton>
      ) : (
        <SidebarToggleButton />
      )}
      <span className="mle-addr__sep" aria-hidden="true" />
      <NavigationHistoryButtons />

      {mode === "library" && <LibraryBreadcrumbs />}
      {mode === "files" && <FilesBreadcrumbs />}
      {mode === "workDetail" && <WorkDetailBreadcrumbs />}

      {mode === "library" && <LibraryGridControls />}

      {mode !== "workDetail" && (
        <div className="ml-2 inline-flex items-center gap-[1px] rounded-2 bg-paper-2 p-[2px]">
          <IconButton
            size="sm"
            icon={I.gridS}
            label="カラム"
            active={mode !== "library"}
            disabled={!availableViewModes.includes("column")}
          />
          <IconButton
            size="sm"
            icon={I.list}
            label="リスト"
            active={mode === "library" && !showGrid}
            onClick={() => setLibraryViewMode("list")}
            disabled={!availableViewModes.includes("list")}
            title={mode !== "library" ? "ファイルモードはカラム表示のみ" : undefined}
          />
          <IconButton
            size="sm"
            icon={I.grid}
            label="グリッド"
            active={mode === "library" && showGrid}
            onClick={() => setLibraryViewMode("grid")}
            disabled={!availableViewModes.includes("grid")}
            title={mode !== "library" ? "ファイルモードはカラム表示のみ" : undefined}
          />
        </div>
      )}

      {mode === "library" && <LibrarySortMenu />}
      {mode === "files" ? (
        <FilesAddressBarMenu />
      ) : (
        <IconButton size="sm" icon={I.more} label="その他" disabled title="近日実装" />
      )}
    </div>
  );
}
