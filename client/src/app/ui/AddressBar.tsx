import { useAtom, useAtomValue } from "jotai";
import { appModeAtom } from "../../features/navigation/model/navigationAtoms";
import {
  activeAxisAtom,
  drillValueAtom,
  libraryViewModeAtom,
} from "../../features/library/model/atoms";
import { isFacetAxis } from "../../features/library/model/axisDefinitions";
import { computeWorksListVisibility } from "../../features/library/model/libraryPresentation";
import LibraryGridControls from "../../features/library/ui/LibraryGridControls";
import LibraryBreadcrumbs from "../../features/library/ui/LibraryBreadcrumbs";
import LibrarySortMenu from "../../features/library/ui/LibrarySortMenu";
import FilesBreadcrumbs from "../../features/files/ui/FilesBreadcrumbs";
import NavigationHistoryButtons from "./NavigationHistoryButtons";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";

export default function AddressBar() {
  const mode = useAtomValue(appModeAtom);
  const activeAxis = useAtomValue(activeAxisAtom);
  const drillValue = useAtomValue(drillValueAtom);
  const [libraryViewMode, setLibraryViewMode] = useAtom(libraryViewModeAtom);
  const availableViewModes: readonly ("column" | "list" | "grid")[] =
    mode === "library" ? ["list", "grid"] : ["column"];

  // ドリル済みファセット軸は viewMode にかかわらず常に全幅グリッドへ合流する
  // （libraryPresentation.ts）。ボタンの active 表示もその実態（showGrid）に
  // 合わせ、リストボタンは押しても何も変わらないため disabled にする。
  const { showGrid } = computeWorksListVisibility(activeAxis, drillValue, libraryViewMode);
  const isDrilledFacet = isFacetAxis(activeAxis) && drillValue !== null;

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
          active={mode !== "library"}
          disabled={!availableViewModes.includes("column")}
        />
        <IconButton
          size="sm"
          icon={I.list}
          label="リスト"
          active={mode === "library" && !showGrid}
          onClick={() => setLibraryViewMode("list")}
          disabled={!availableViewModes.includes("list") || isDrilledFacet}
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

      {mode === "library" && <LibrarySortMenu />}
      <IconButton size="sm" icon={I.more} label="その他" disabled title="近日実装" />
    </div>
  );
}
