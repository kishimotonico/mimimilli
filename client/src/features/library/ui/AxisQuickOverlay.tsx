import { createPortal } from "react-dom";
import { useRef, type RefObject } from "react";
import type { AxisFacetItem, FacetAxisId, NormalizedTag } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import { useAnchoredPopover } from "./preview/useAnchoredPopover";
import type { HoverGroupPanelHandlers } from "../../../shared/lib/useHoverGroupCoordinator";
import AxisValueQuickList from "./AxisValueQuickList";
import { usePresence } from "../../../shared/ui/usePresence";
import { PRESENCE_DURATION_MS } from "../../../shared/ui/presenceDurations";

// 軸レール行のクイックオーバーレイ（ADR-0012 §7）。ホバー約200ms・フォーカス中の
// ArrowRight で開く。軸行の右向き矢印・ArrowRightキーの操作方向と揃えて右側に出す。
// 軸レールは画面左端に固定されているため、デスクトップ幅で右に余白が無いケースは
// 実質発生せず、左右の反転フォールバックは設けない（モバイル幅は ADR-0006 の別設計）。
// 位置決めは useAnchoredPopover の placement:"right" に一本化する（自前の位置計算は
// 持たない）。軸レールの列は overflow: hidden auto でクリップされるため、
// document.body へポータルし fixed 位置で表示する。

const OVERLAY_WIDTH = 280;

interface AxisQuickOverlayProps {
  axis: AxisId;
  axisLabel: string;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  selectedTags: NormalizedTag[];
  onSelectValue: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** ホバー/フォーカス時の＋ボタン（冪等なAND追加。ADR-0013） */
  onAddValue: (tag: NormalizedTag) => void;
  onClose: () => void;
  panelHandlers: HoverGroupPanelHandlers;
  panelElRef: RefObject<HTMLElement | null>;
}

export default function AxisQuickOverlay({
  axis,
  axisLabel,
  anchorEl,
  isOpen,
  selectedTags,
  onSelectValue,
  onAddValue,
  onClose,
  panelHandlers,
  panelElRef,
}: AxisQuickOverlayProps) {
  const facetQuery = useAxisFacetsQuery(isOpen ? (axis as FacetAxisId) : null, selectedTags);

  // isOpen=false になった直後にクエリを無効化するため facetQuery.data は失われる。
  // Presence の退出アニメーション中も一覧の中身が消えないよう、開いていた間の最後の
  // 結果を保持し、退出中はそれを表示し続ける。
  const lastResultRef = useRef<{
    items: AxisFacetItem[];
    isLoading: boolean;
    isError: boolean;
  }>({ items: [], isLoading: false, isError: false });
  if (isOpen) {
    lastResultRef.current = {
      items: facetQuery.data ?? [],
      isLoading: facetQuery.isLoading,
      isError: facetQuery.isError,
    };
  }
  const displayResult = isOpen
    ? { items: facetQuery.data ?? [], isLoading: facetQuery.isLoading, isError: facetQuery.isError }
    : lastResultRef.current;

  const { anchorRef, panelRef, layout, close } = useAnchoredPopover({
    isOpen,
    preferredWidth: OVERLAY_WIDTH,
    onClose: () => onClose(),
    getContainer: (el) => el.closest(".mle-app"),
    placement: "right",
  });
  anchorRef.current = anchorEl as HTMLDivElement | null;

  const setPanelEl = (el: HTMLDivElement | null) => {
    panelRef.current = el;
    panelElRef.current = el;
  };

  // 退出アニメーション完了までマウントを保つ（呼び出し側は isOpen=false のあとも
  // axis / anchorEl に最後に開いていた値を渡し続ける契約）。
  const { mounted, phase } = usePresence(isOpen, {
    durationMs: PRESENCE_DURATION_MS["popover-scale"],
  });

  if (!mounted || !anchorEl) return null;

  return createPortal(
    <div
      ref={setPanelEl}
      data-phase={phase}
      className="mll-qoverlay mll-qoverlay--fixed ml-presence-popover-scale"
      // マウント直後、パネル実測前の1フレームだけ top が未確定（layout effect が
      // 実サイズを測ってペイント前に補正する。ちらつきは出ない）。
      style={{ left: layout.left, top: layout.top ?? 0, width: layout.width }}
      // pointer-events:none（CSS）だけではキーボード操作・アクセシビリティツリーからの
      // 到達を防げないため、退出中は inert にする（Presence コンポーネントと同じ扱い）。
      // data-phase ではなく isOpen を見るのは、退出中に isOpen が再び true になった
      // 瞬間（usePresence の effect が phase を "enter" へ更新する前の1レンダー）に
      // inert が残って子（検索欄）へフォーカスできなくなるのを避けるため。
      inert={!isOpen}
      {...panelHandlers}
    >
      <AxisValueQuickList
        axis={axis}
        axisLabel={axisLabel}
        isOpen={isOpen}
        items={displayResult.items}
        isLoading={displayResult.isLoading}
        isError={displayResult.isError}
        isSelected={(value) => selectedTags.includes(buildFilterTag(axis, value))}
        onSelect={(item, e) => {
          onSelectValue(buildFilterTag(axis, item.value), {
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
          });
          close();
        }}
        onAdd={(item) => {
          onAddValue(buildFilterTag(axis, item.value));
        }}
        close={close}
      />
    </div>,
    document.body,
  );
}
