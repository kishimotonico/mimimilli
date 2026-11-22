import { createPortal } from "react-dom";
import { motion, useIsPresent } from "motion/react";
import type { GroupBy, NormalizedTag } from "@mimimilli/shared";
import { useGroupValuesQuery } from "../model/useGroupValuesQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import { useAnchoredPopover } from "../../../shared/ui/useAnchoredPopover";
import type { HoverGroupPanelHandlers } from "../../../shared/lib/useHoverGroupCoordinator";
import GroupValueQuickList from "./GroupValueQuickList";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";

// サイドバーのグループ分けの行のクイックオーバーレイ（ADR-0012 §7・ADR-0041）。ホバー約200ms・
// フォーカス中の ArrowRight で開く。行の右向き矢印・ArrowRightキーの操作方向と揃えて右側に出す。
// サイドバーは画面左端に固定されているため、デスクトップ幅で右に余白が無いケースは
// 実質発生せず、左右の反転フォールバックは設けない。
// 位置決めは useAnchoredPopover の placement:"right" に一本化する。サイドバーの列は
// overflow でクリップされるため、document.body へポータルし fixed 位置で表示する。
//
// 呼び出し側（LibrarySidebarPanel）は開いている行ごとに異なる key で AnimatePresence の子として
// マウントする。退出アニメーション中もこのコンポーネントインスタンス自体はマウントされ
// 続けるため、groupBy / anchorEl は AnimatePresence が凍結した最後の props のまま渡り続け、
// クエリも常に有効な groupBy で購読され続ける（値の手動退避は不要）。

const OVERLAY_WIDTH = 280;

interface GroupQuickOverlayProps {
  folderId: string;
  groupBy: GroupBy;
  groupByLabel: string;
  anchorEl: HTMLElement | null;
  /** 開いているグループの値（そのスマートフォルダーを開いているとき） */
  selectedValue: string | null;
  /** 主クリックも Ctrl/Cmd+クリックも、その値の作品一覧へ進む（ADR-0041） */
  onSelectValue: (value: string) => void;
  /** ホバー/フォーカス時の＋ボタン。作品一覧ならチップを足し、値一覧なら「すべて」＋そのチップ */
  onAddTag: (tag: NormalizedTag) => void;
  onClose: () => void;
  panelHandlers: HoverGroupPanelHandlers;
  onPanelElChange: (el: HTMLElement | null) => void;
}

export default function GroupQuickOverlay({
  folderId,
  groupBy,
  groupByLabel,
  anchorEl,
  selectedValue,
  onSelectValue,
  onAddTag,
  onClose,
  panelHandlers,
  onPanelElChange,
}: GroupQuickOverlayProps) {
  const isPresent = useIsPresent();
  // 件数は主クリック（その値の作品一覧）の結果と一致させるため、絞り込み無しで数える
  const groupValuesQuery = useGroupValuesQuery(groupBy, { folderId });
  const { popoverScale } = useMotionVariants();
  const variant = popoverScale({ origin: "left center" });

  const { setFloating, floatingStyles, close } = useAnchoredPopover({
    isOpen: isPresent,
    preferredWidth: OVERLAY_WIDTH,
    onClose: () => onClose(),
    getContainer: (el) => el.closest(".mle-app"),
    placement: "right",
    referenceElement: anchorEl,
  });

  const setPanelEl = (el: HTMLDivElement | null) => {
    const cleanup = setFloating(el);
    onPanelElChange(el);
    return () => {
      cleanup?.();
      onPanelElChange(null);
    };
  };

  if (!anchorEl) return null;

  return createPortal(
    <motion.div
      ref={setPanelEl}
      {...variant}
      className="mll-qoverlay mll-qoverlay--fixed"
      style={floatingStyles}
      inert={!isPresent}
      {...panelHandlers}
    >
      <GroupValueQuickList
        groupBy={groupBy}
        groupByLabel={groupByLabel}
        isOpen={isPresent}
        items={groupValuesQuery.data ?? []}
        isLoading={groupValuesQuery.isLoading}
        isError={groupValuesQuery.isError}
        isSelected={(value) => value === selectedValue}
        onSelect={(item) => {
          onSelectValue(item.value);
          close();
        }}
        onAdd={(item) => {
          onAddTag(buildFilterTag(groupBy, item.value));
        }}
        close={close}
      />
    </motion.div>,
    document.body,
  );
}
