import { useState } from "react";
import { AnimatePresence } from "motion/react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { getAxisLabel } from "../../../entities/library/axisDefinitions";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { axisOfGroupBy } from "../model/libraryPresentation";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import GroupValuePopover from "./GroupValuePopover";

/** 「スマートフォルダー名 / 値」。先頭はグループ分けの値一覧へ戻り、値は兄弟の値のドロップダウンを開く */
export default function LibraryBreadcrumbs() {
  const nav = useLibraryNavigation();
  const view = nav.foldersStatus === "ready" ? nav.view : null;
  const { tagPrefixes } = useTagPrefixes();
  const [siblingAnchor, setSiblingAnchor] = useState<HTMLElement | null>(null);
  const group = view?.kind === "works" ? view.group : null;
  const groupBy = view?.kind === "works" ? view.groupBy : null;

  return (
    <>
      <Breadcrumbs
        path={view?.breadcrumb ?? []}
        onNavigate={(index, anchor) => {
          if (index === 0) nav.goToSegment(0);
          else if (group !== null) setSiblingAnchor(anchor);
        }}
      />
      <AnimatePresence>
        {view && siblingAnchor && group !== null && groupBy !== null && (
          <GroupValuePopover
            key="siblings"
            folderId={view.folder.id}
            axis={axisOfGroupBy(groupBy)}
            axisLabel={getAxisLabel(axisOfGroupBy(groupBy), tagPrefixes)}
            anchorEl={siblingAnchor}
            selectedValue={group}
            onSelectValue={nav.selectGroupValue}
            onClose={() => setSiblingAnchor(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
