import { createPortal } from "react-dom";
import { useIsPresent } from "motion/react";
import type { GroupBy, GroupSortId, GroupValueItem } from "@mimimilli/shared";
import { useAnchoredPopover } from "../../../shared/ui/useAnchoredPopover";
import type { HoverGroupPanelHandlers } from "../../../shared/lib/useHoverGroupCoordinator";
import type { GroupValueScope } from "../model/useGroupValuesQuery";
import GroupValuePopoverPanel, { GROUP_VALUE_PLACEMENTS } from "./GroupValuePopoverPanel";

// アンカーの横または下にグループの値の一覧を出す。サイドバーの列は overflow でクリップされるため、
// document.body へポータルして位置決めを useAnchoredPopover に任せる。
// right: サイドバーのグループ分けの行のクイックオーバーレイ（ADR-0012 §7・ADR-0041）。サイドバーは
// 画面左端に固定なので、右に余白が無いケースは実質発生せず、左右の反転フォールバックは設けない。
// below: パンくずの値から開く、同じグループ分けの兄弟の値のドロップダウン。
//
// 呼び出し側は AnimatePresence の子としてマウントする。退出アニメーション中もこのインスタンスは
// マウントされ続けるため、groupBy / anchorEl は凍結した最後の props のまま渡り、クエリも
// 常に有効な groupBy で購読され続ける。

interface GroupValuePopoverProps {
  placement: keyof typeof GROUP_VALUE_PLACEMENTS;
  /** 値と件数を数える母集団 */
  scope: GroupValueScope;
  groupBy: GroupBy;
  groupByLabel: string;
  /** そのフォルダーの保存済みの値の並び。開いている間だけ列見出しで変えられる */
  groupSort: GroupSortId;
  anchorEl: HTMLElement | null;
  /** 選択中の値（チェック表示） */
  selectedValue: string | null;
  /** 値を選ぶ。選んだあと一覧は閉じる */
  onSelectValue: (value: string) => void;
  /** 行の＋ボタン。渡したときだけ出る */
  onAddValue?: (value: string) => void;
  onClose: () => void;
  /** ホバーで開くときの、一覧自体へのホバー・フォーカスの扱い */
  panelHandlers?: HoverGroupPanelHandlers;
  onPanelElChange?: (el: HTMLElement | null) => void;
}

export default function GroupValuePopover({
  placement,
  scope,
  groupBy,
  groupByLabel,
  groupSort,
  anchorEl,
  selectedValue,
  onSelectValue,
  onAddValue,
  onClose,
  panelHandlers,
  onPanelElChange,
}: GroupValuePopoverProps) {
  const isPresent = useIsPresent();
  const { width } = GROUP_VALUE_PLACEMENTS[placement];
  const { setFloating, floatingStyles, close } = useAnchoredPopover({
    isOpen: isPresent,
    preferredWidth: width,
    onClose: () => onClose(),
    getContainer: (el) => el.closest(".mle-app"),
    placement,
    referenceElement: anchorEl,
  });

  const setPanelEl = (el: HTMLElement | null) => {
    const cleanup = setFloating(el);
    onPanelElChange?.(el);
    return () => {
      cleanup?.();
      onPanelElChange?.(null);
    };
  };

  if (!anchorEl) return null;

  return createPortal(
    <GroupValuePopoverPanel
      groupBy={groupBy}
      groupByLabel={groupByLabel}
      scope={scope}
      initialGroupSort={groupSort}
      placement={placement}
      setFloating={setPanelEl}
      floatingStyles={floatingStyles}
      panelHandlers={panelHandlers}
      isSelected={(value) => value === selectedValue}
      onSelect={(item: GroupValueItem) => {
        onSelectValue(item.value);
        close();
      }}
      onAdd={onAddValue && ((item) => onAddValue(item.value))}
      close={close}
    />,
    document.body,
  );
}
