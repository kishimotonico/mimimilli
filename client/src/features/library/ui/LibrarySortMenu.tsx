import { useState } from "react";
import { Menu } from "@ark-ui/react/menu";
import { useSetAtom } from "jotai";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import type { GroupSortId, SortId } from "@mimimilli/shared";
import { SORT_OPTIONS } from "../../../entities/library/types";
import { reshuffleLibrarySeedAtom } from "../../../entities/library/model/navigationActions";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { useSmartFolderEditor } from "../model/useSmartFolderEditor";
import { getGroupSortLabel, groupSortOptions } from "../model/groupValueSort";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../../shared/ui/menu/MotionMenu";
import { MenuCheckColumn, MenuCheckSpacer } from "../../../shared/ui/menu/MenuCheckColumn";
import {
  MENU_GUTTER,
  MENU_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
  menuItemClass,
} from "../../../shared/ui/menu/menuStyles";

function getSortLabel(sortId: SortId): string | undefined {
  return SORT_OPTIONS.find((opt) => opt.id === sortId)?.label;
}

// 結果面が値一覧のときは今の値の並び（8種）、作品一覧のときは今の並び（9種）を、どちらも履歴エントリーの
// 状態（ADR-0041）として変える。今の並びが解決後の既定から外れているときだけ「このソートを既定にする」を出し、
// スマートフォルダーの既定の並び（値一覧なら値の並び）として保存する。
export default function LibrarySortMenu() {
  const nav = useLibraryNavigation();
  if (nav.foldersStatus !== "ready") {
    // 一覧が無い間は既定の並びが分からないので操作させない
    return (
      <div className="flex items-center">
        <IconButton size="sm" icon={I.sort} label="ソート" title="ソート" disabled />
      </div>
    );
  }
  return <ReadySortMenu view={nav.view} setSort={nav.setSort} setGroupSort={nav.setGroupSort} />;
}

function ReadySortMenu({
  view,
  setSort,
  setGroupSort,
}: {
  view: ResolvedLibraryView;
  setSort: (sort: SortId) => void;
  setGroupSort: (groupSort: GroupSortId) => void;
}) {
  const editor = useSmartFolderEditor();
  const [savingDefault, setSavingDefault] = useState(false);
  const reshuffle = useSetAtom(reshuffleLibrarySeedAtom);

  const sort = view.kind === "works" ? view.sort : null;
  const currentSortLabel =
    view.kind === "value-list"
      ? getGroupSortLabel(view.groupSort, view.groupBy)
      : sort && getSortLabel(sort);

  const saveAsDefault = async () => {
    setSavingDefault(true);
    if (view.kind === "value-list") {
      await editor.patch(
        view.folder.id,
        { groupSort: view.groupSort },
        { failureMessage: "ソートを既定にできませんでした" },
      );
    } else {
      await editor.patch(
        view.folder.id,
        { sort: view.sort },
        { failureMessage: "ソートを既定にできませんでした" },
      );
    }
    setSavingDefault(false);
  };

  const buttonTitle = currentSortLabel ? `ソート: ${currentSortLabel}` : "ソート";

  const options =
    view.kind === "value-list"
      ? groupSortOptions(view.groupBy).map((opt) => ({ id: opt.id as string, label: opt.label }))
      : SORT_OPTIONS.map((opt) => ({ id: opt.id as string, label: opt.label }));
  const currentValue = view.kind === "value-list" ? view.groupSort : sort;
  const menu = useMotionMenu({
    positioning: { placement: "bottom-end", gutter: MENU_GUTTER },
    initialHighlight: currentValue,
  });
  const selectOption = (id: string) => {
    if (view.kind === "value-list") setGroupSort(id as GroupSortId);
    else setSort(id as SortId);
  };

  const showReshuffle = view.kind === "works" && sort === "random";
  const canSaveAsDefault =
    (view.kind === "works" && view.sortDeviates) ||
    (view.kind === "value-list" && view.groupSortDeviates);

  return (
    <div className="flex items-center">
      <MotionMenuRoot handle={menu}>
        <Menu.Trigger asChild {...menu.triggerProps}>
          <IconButton
            size="sm"
            icon={I.sort}
            label="ソート"
            title={buttonTitle}
            active={menu.menu.api.open}
          />
        </Menu.Trigger>
        {showReshuffle && (
          <IconButton
            size="sm"
            icon={I.refresh}
            label="並べ直す"
            title="別の順に並べ直す"
            onClick={() => reshuffle()}
          />
        )}
        <MenuPopup origin="top right" aria-label="ソート">
          <Menu.RadioItemGroup
            value={currentValue ?? undefined}
            onValueChange={({ value }) => selectOption(value)}
          >
            {options.map((opt) => (
              <Menu.RadioItem key={opt.id} value={opt.id} className={menuItemClass()}>
                <MenuCheckColumn />
                <span className={MENU_LABEL_CLASS}>{opt.label}</span>
              </Menu.RadioItem>
            ))}
          </Menu.RadioItemGroup>
          {canSaveAsDefault && (
            <>
              <Menu.Separator className={MENU_SEPARATOR_CLASS} />
              <Menu.Item
                value="save-default"
                disabled={savingDefault}
                onSelect={() => void saveAsDefault()}
                className={menuItemClass()}
              >
                <MenuCheckSpacer />
                <span className={MENU_LABEL_CLASS}>このソートを既定にする</span>
              </Menu.Item>
            </>
          )}
        </MenuPopup>
      </MotionMenuRoot>
    </div>
  );
}
