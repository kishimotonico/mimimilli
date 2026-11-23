import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useSetAtom } from "jotai";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import type { GroupSortId, SortId } from "@mimimilli/shared";
import { SORT_OPTIONS } from "../../../entities/library/types";
import {
  clearLibraryGroupSortAtom,
  clearLibrarySortAtom,
  reshuffleLibrarySeedAtom,
} from "../../../entities/library/model/navigationActions";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { useSmartFolderEditor } from "../model/useSmartFolderEditor";
import { getGroupSortLabel, groupSortOptions } from "../model/groupValueSort";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { usePopoverDismissal } from "../../../shared/ui/usePopoverDismissal";

function getSortLabel(sortId: SortId): string | undefined {
  return SORT_OPTIONS.find((opt) => opt.id === sortId)?.label;
}

// 結果面が値一覧のときは今の値の並び（8種）、作品一覧のときは今の並び（9種）を、どちらも履歴エントリーの
// 状態（ADR-0041）として変える。今の並びが解決後の既定から外れているときだけ「この並びを既定にする」を出し、
// スマートフォルダーの既定の並び（値一覧なら値の並び）として保存する。
export default function LibrarySortMenu() {
  const nav = useLibraryNavigation();
  if (nav.foldersStatus !== "ready") {
    // 一覧が無い間は既定の並びが分からないので操作させない
    return (
      <div className="mle-sortmenu">
        <IconButton size="sm" icon={I.sort} label="並び替え" title="並び替え" disabled />
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
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const reshuffle = useSetAtom(reshuffleLibrarySeedAtom);
  const clearCurrentSort = useSetAtom(clearLibrarySortAtom);
  const clearCurrentGroupSort = useSetAtom(clearLibraryGroupSortAtom);

  const sort = view.kind === "works" ? view.sort : null;
  const currentSortLabel =
    view.kind === "value-list"
      ? getGroupSortLabel(view.groupSort, view.groupBy)
      : sort && getSortLabel(sort);

  const saveAsDefault = async () => {
    setSavingDefault(true);
    if (view.kind === "value-list") {
      const saved = await editor.saveDefaultGroupSort(view.folder.id, view.groupSort);
      if (saved) clearCurrentGroupSort({ folderId: view.folder.id, groupSort: view.groupSort });
    } else {
      const saved = await editor.saveDefaultSort(view.folder.id, view.sort);
      if (saved) clearCurrentSort({ folderId: view.folder.id, sort: view.sort });
    }
    setSavingDefault(false);
  };

  const buttonTitle = currentSortLabel ? `並び替え: ${currentSortLabel}` : "並び替え";

  const { close: closeSortMenu } = usePopoverDismissal({
    isOpen: sortMenuOpen,
    onClose: () => setSortMenuOpen(false),
    anchorRef: sortRef,
  });

  // role=menu の期待どおり、開いたら現在値（無ければ先頭）へ初期フォーカスする。
  useEffect(() => {
    if (!sortMenuOpen) return;
    const items = sortRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]');
    if (!items || items.length === 0) return;
    const checked = Array.from(items).find((item) => item.getAttribute("aria-checked") === "true");
    (checked ?? items[0])?.focus({ preventScroll: true });
  }, [sortMenuOpen]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]'),
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    items[nextIndex]?.focus({ preventScroll: true });
  };

  const showReshuffle = view.kind === "works" && sort === "random";
  const canSaveAsDefault =
    (view.kind === "works" && view.sortDeviates) ||
    (view.kind === "value-list" && view.groupSortDeviates);

  return (
    <div className="mle-sortmenu" ref={sortRef}>
      <IconButton
        size="sm"
        icon={I.sort}
        label="並び替え"
        title={buttonTitle}
        active={sortMenuOpen}
        aria-haspopup="menu"
        aria-expanded={sortMenuOpen}
        onClick={() => {
          if (sortMenuOpen) closeSortMenu();
          else setSortMenuOpen(true);
        }}
      />
      {showReshuffle && (
        <IconButton
          size="sm"
          icon={I.refresh}
          label="並べ直す"
          title="別の並びを再抽選"
          onClick={() => reshuffle()}
        />
      )}
      {sortMenuOpen && (
        <div
          className="mle-sortmenu__pop"
          role="menu"
          aria-label="並び替え"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          {view.kind === "value-list"
            ? groupSortOptions(view.groupBy).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={view.groupSort === opt.id}
                  className={`mle-sortmenu__item ${view.groupSort === opt.id ? "is-checked" : ""}`}
                  onClick={() => {
                    setGroupSort(opt.id);
                    closeSortMenu();
                  }}
                >
                  <span className="check">
                    {view.groupSort === opt.id && <I.check size={14} />}
                  </span>
                  <span className="label">{opt.label}</span>
                </button>
              ))
            : SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sort === opt.id}
                  className={`mle-sortmenu__item ${sort === opt.id ? "is-checked" : ""}`}
                  onClick={() => {
                    setSort(opt.id);
                    closeSortMenu();
                  }}
                >
                  <span className="check">{sort === opt.id && <I.check size={14} />}</span>
                  <span className="label">{opt.label}</span>
                </button>
              ))}
          {canSaveAsDefault && (
            <button
              type="button"
              role="menuitem"
              className="mle-sortmenu__item"
              disabled={savingDefault}
              onClick={() => {
                void saveAsDefault();
                closeSortMenu();
              }}
            >
              <span className="check" />
              <span className="label">この並びを既定にする</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
