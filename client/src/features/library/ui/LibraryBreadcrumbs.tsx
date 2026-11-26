import { useId, useRef, useState } from "react";
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
  const [siblingAnchor, setSiblingAnchor] = useState<HTMLElement | null>(null);
  const triggerId = useId();
  const crumbsRef = useRef<HTMLElement | null>(null);
  const group = view?.kind === "works" ? view.group : null;
  const groupBy = view?.kind === "works" ? view.groupBy : null;
  const groupSort = view?.kind === "works" ? view.groupSort : null;

  return (
    <>
      <Breadcrumbs
        path={[LIBRARY_ROOT_LABEL, ...(view?.breadcrumb ?? [])]}
        onNavigate={(index, anchor) => {
          if (index === 0) nav.openFolder(ALL_SMART_FOLDER_ID);
          else if (index === 1) nav.backToValueList();
          else if (group !== null) {
            anchor.id = triggerId;
            crumbsRef.current = anchor.closest(".mle-crumbs");
            setSiblingAnchor((current) => (current === anchor ? null : anchor));
          }
        }}
      />
      {view && (
        <GroupValuePopover
          placement="below"
          open={siblingAnchor !== null}
          triggerId={triggerId}
          anchorEl={siblingAnchor}
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
          onClose={() =>
            setSiblingAnchor((current) => (current === siblingAnchor ? null : current))
          }
          onReturnTargetLost={() => {
            const valueButton = crumbsRef.current?.querySelector<HTMLButtonElement>(
              "button.mle-crumbs__seg.is-last",
            );
            if (valueButton) {
              valueButton.id = triggerId;
              valueButton.focus({ preventScroll: true });
            }
          }}
        />
      )}
    </>
  );
}
