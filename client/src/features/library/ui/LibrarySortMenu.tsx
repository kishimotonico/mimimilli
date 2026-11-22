import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { libraryRouteAtom } from "../../../entities/library/model/navigationAtoms";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SortId } from "@mimimilli/shared";
import { SORT_OPTIONS } from "../../../entities/library/types";
import { axisValueSortAtom } from "../model/atoms";
import {
  clearLibrarySortAtom,
  reshuffleLibrarySeedAtom,
} from "../../../entities/library/model/navigationActions";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import {
  AXIS_VALUE_SORT_OPTIONS,
  selectAxisValueSortKey,
  type AxisValueSortKey,
} from "../model/axisValueSort";
import { updateSmartFolder } from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useToast } from "../../../shared/ui/useToast";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { usePopoverDismissal } from "../../../shared/ui/usePopoverDismissal";

function getSortLabel(sortId: SortId): string | undefined {
  return SORT_OPTIONS.find((opt) => opt.id === sortId)?.label;
}

function getAxisValueSortLabel(key: AxisValueSortKey): string {
  return AXIS_VALUE_SORT_OPTIONS.find((opt) => opt.id === key)?.label ?? key;
}

// ADR-0012 帰結: ソートは UI が単一系・state が二重。結果面が値一覧のときは
// axisValueSortAtom（名前/件数/総時間）、作品一覧のときは今の並び（履歴エントリーの状態。
// ADR-0041）を接続先として切り替える。今の並びが解決後の既定から外れているときだけ
// 「この並びを既定にする」を出し、スマートフォルダーの既定の並びとして保存する。
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
  return <ReadySortMenu view={nav.view} setSort={nav.setSort} />;
}

function ReadySortMenu({
  view,
  setSort,
}: {
  view: ResolvedLibraryView;
  setSort: (sort: SortId) => void;
}) {
  const routeFolderId = useAtomValue(libraryRouteAtom).folderId;
  const queryClient = useQueryClient();
  const [axisValueSort, setAxisValueSort] = useAtom(axisValueSortAtom);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const reshuffle = useSetAtom(reshuffleLibrarySeedAtom);
  const clearCurrentSort = useSetAtom(clearLibrarySortAtom);

  const isValueListPane = view.kind === "value-list";
  const disabled = view.kind === "broken";
  const sort = view.sort;
  const currentSortLabel = isValueListPane
    ? getAxisValueSortLabel(axisValueSort.key)
    : getSortLabel(sort);

  const toast = useToast();
  const saveAsDefault = useMutation({
    mutationFn: (saved: { folderId: string; routeFolderId: string; sort: SortId }) => {
      if (view.kind === "broken") throw new Error("読めないスマートフォルダーは保存できません");
      const { folder } = view;
      return updateSmartFolder(saved.folderId, {
        name: folder.name,
        condition: view.condition,
        sort: saved.sort,
        groupBy: folder.groupBy,
      });
    },
    onSuccess: async (_result, saved) => {
      await queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.all() });
      clearCurrentSort({ folderId: saved.routeFolderId, sort: saved.sort });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "並びを既定にできませんでした")),
  });

  const buttonTitle = currentSortLabel ? `並び替え: ${currentSortLabel}` : "並び替え";

  const { close: closeSortMenu } = usePopoverDismissal({
    isOpen: sortMenuOpen && !disabled,
    onClose: () => setSortMenuOpen(false),
    anchorRef: sortRef,
  });

  useEffect(() => {
    if (disabled && sortMenuOpen) closeSortMenu();
  }, [disabled, sortMenuOpen, closeSortMenu]);

  // role=menu の期待どおり、開いたら現在値（無ければ先頭）へ初期フォーカスする。
  useEffect(() => {
    if (!sortMenuOpen || disabled) return;
    const items = sortRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]');
    if (!items || items.length === 0) return;
    const checked = Array.from(items).find((item) => item.getAttribute("aria-checked") === "true");
    (checked ?? items[0])?.focus({ preventScroll: true });
  }, [sortMenuOpen, disabled]);

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
  const canSaveAsDefault = view.kind === "works" && view.sortDeviates;

  return (
    <div className="mle-sortmenu" ref={sortRef}>
      <IconButton
        size="sm"
        icon={I.sort}
        label="並び替え"
        title={buttonTitle}
        active={sortMenuOpen}
        disabled={disabled}
        aria-haspopup={disabled ? undefined : "menu"}
        aria-expanded={disabled ? undefined : sortMenuOpen}
        onClick={() => {
          if (!disabled) {
            if (sortMenuOpen) closeSortMenu();
            else setSortMenuOpen(true);
          }
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
      {sortMenuOpen && !disabled && (
        <div
          className="mle-sortmenu__pop"
          role="menu"
          aria-label="並び替え"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          {isValueListPane
            ? AXIS_VALUE_SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={axisValueSort.key === opt.id}
                  className={`mle-sortmenu__item ${axisValueSort.key === opt.id ? "is-checked" : ""}`}
                  onClick={() => {
                    setAxisValueSort(selectAxisValueSortKey(axisValueSort, opt.id));
                    closeSortMenu();
                  }}
                >
                  <span className="check">
                    {axisValueSort.key === opt.id && <I.check size={14} />}
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
              disabled={saveAsDefault.isPending}
              onClick={() => {
                saveAsDefault.mutate({ folderId: view.folder.id, routeFolderId, sort });
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
