import { useId, useState } from "react";
import { ALL_SMART_FOLDER_ID } from "@mimimilli/shared";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { getGroupByLabel } from "../../../entities/library/smartFolderDefinitions";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import GroupValuePopover from "./GroupValuePopover";

export const LIBRARY_ROOT_LABEL = "ライブラリ";

/** 「ライブラリ / スマートフォルダー名（/ 値）」。「ライブラリ」は「すべて」へ、スマートフォルダー名は
 *  グループ分けの値一覧へ戻り、値は兄弟の値のドロップダウンを開く */
export default function LibraryBreadcrumbs() {
  const nav = useLibraryNavigation();
  const view = nav.foldersStatus === "ready" ? nav.view : null;
  const { tagPrefixes } = useTagPrefixes();
  const [siblingOpen, setSiblingOpen] = useState(false);
  const triggerId = useId();
  const group = view?.kind === "works" ? view.group : null;
  const groupBy = view?.kind === "works" ? view.groupBy : null;
  const groupSort = view?.kind === "works" ? view.groupSort : null;
  const canOpen = group !== null && groupBy !== null && groupSort !== null;
  if (siblingOpen && !canOpen) setSiblingOpen(false);

  return (
    <>
      <Breadcrumbs
        path={[LIBRARY_ROOT_LABEL, ...(view?.breadcrumb ?? [])]}
        lastSegmentId={triggerId}
        onNavigate={(index) => {
          if (index === 0) nav.openFolder(ALL_SMART_FOLDER_ID);
          else if (index === 1) nav.backToValueList();
          else if (group !== null) setSiblingOpen((current) => !current);
        }}
      />
      {view && (
        <GroupValuePopover
          placement="below"
          open={canOpen && siblingOpen}
          triggerId={triggerId}
          list={
            groupBy !== null && groupSort !== null
              ? {
                  scope: { folderId: view.folder.id, tags: view.selectedTags, q: view.q },
                  groupBy,
                  groupSort,
                  groupByLabel: getGroupByLabel(groupBy, tagPrefixes),
                  selectedValue: group,
                  onSelectValue: nav.selectGroupValue,
                }
              : null
          }
          onClose={() => setSiblingOpen(false)}
        />
      )}
    </>
  );
}
