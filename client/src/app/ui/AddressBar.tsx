import { useAtom, useAtomValue } from "jotai";
import { appModeAtom } from "../../features/navigation/model/navigationAtoms";
import { libraryViewModeAtom } from "../../features/library/model/atoms";
import LibraryGridControls from "../../features/library/ui/LibraryGridControls";
import LibraryBreadcrumbs from "../../features/library/ui/LibraryBreadcrumbs";
import LibrarySortMenu from "../../features/library/ui/LibrarySortMenu";
import FilesBreadcrumbs from "../../features/files/ui/FilesBreadcrumbs";
import NavigationHistoryButtons from "./NavigationHistoryButtons";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";

export default function AddressBar() {
  const mode = useAtomValue(appModeAtom);
  const [libraryViewMode, setLibraryViewMode] = useAtom(libraryViewModeAtom);
  const viewMode = mode === "library" ? libraryViewMode : "column";
  const availableViewModes: readonly ("column" | "list" | "grid")[] =
    mode === "library" ? ["list", "grid"] : ["column"];

  return (
    <div className="mle-addr is-lib">
      <NavigationHistoryButtons />

      {mode === "library" ? <LibraryBreadcrumbs /> : <FilesBreadcrumbs />}

      {mode === "library" && <LibraryGridControls />}

      <div className="inline-flex items-center gap-[1px] rounded-2 bg-paper-2 p-[2px]">
        <IconButton
          size="sm"
          icon={I.gridS}
          label="カラム"
          active={viewMode === "column"}
          disabled={!availableViewModes.includes("column")}
        />
        <IconButton
          size="sm"
          icon={I.list}
          label="リスト"
          active={viewMode === "list"}
          onClick={() => setLibraryViewMode("list")}
          disabled={!availableViewModes.includes("list")}
        />
        <IconButton
          size="sm"
          icon={I.grid}
          label="グリッド"
          active={viewMode === "grid"}
          onClick={() => setLibraryViewMode("grid")}
          disabled={!availableViewModes.includes("grid")}
        />
      </div>

      {mode === "library" && <LibrarySortMenu />}
      <IconButton size="sm" icon={I.more} label="その他" />
    </div>
  );
}
