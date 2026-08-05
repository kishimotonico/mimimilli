import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { FacetAxisId, NormalizedTag } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import { useAnchoredPopover } from "./preview/useAnchoredPopover";
import type { HoverIntentHandlers } from "../../../shared/lib/useHoverIntent";
import AxisValueQuickList from "./AxisValueQuickList";

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
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  selectedTags: NormalizedTag[];
  onSelectValue: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  onClose: () => void;
  panelHandlers: HoverIntentHandlers;
}

export default function AxisQuickOverlay({
  axis,
  anchorEl,
  isOpen,
  selectedTags,
  onSelectValue,
  onClose,
  panelHandlers,
}: AxisQuickOverlayProps) {
  const facetQuery = useAxisFacetsQuery(isOpen ? (axis as FacetAxisId) : null, selectedTags);

  // ポータル先（document.body）が anchorEl（軸レール行、.mle-app 配下）と別DOM系統になる
  // ため、外側クリック/Escape判定は anchorEl とパネル両方を境界にした独自ロジックを下で使う
  // （onOutsideClick/onEscapeは使わない）。位置クランプ（左右・上下）は useAnchoredPopover に
  // 委ね、panelRef をパネル要素に付けることで実サイズ変化にも追従させる。
  const { anchorRef, panelRef, layout } = useAnchoredPopover({
    isOpen,
    preferredWidth: OVERLAY_WIDTH,
    onOutsideClick: () => {},
    onEscape: () => {},
    getContainer: (el) => el.closest(".mle-app"),
    placement: "right",
  });
  anchorRef.current = anchorEl as HTMLDivElement | null;

  // 閉じるときにフォーカスがパネル内（検索欄など）にあれば軸行へ戻す（AC#4）。
  // ホバーだけで閉じる場合はフォーカス移動と無関係のため奪わない。
  const closeAndMaybeRefocus = () => {
    if (panelRef.current?.contains(document.activeElement)) {
      anchorEl?.focus();
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorEl?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAndMaybeRefocus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeAndMaybeRefocus は毎レンダー新規参照のため anchorEl/onClose だけに依存を絞る
  }, [isOpen, anchorEl, onClose]);

  if (!isOpen || !anchorEl) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="mll-qoverlay mll-qoverlay--fixed"
      // マウント直後、パネル実測前の1フレームだけ top が未確定（layout effect が
      // 実サイズを測ってペイント前に補正する。ちらつきは出ない）。
      style={{ left: layout.left, top: layout.top ?? 0, width: layout.width }}
      {...panelHandlers}
    >
      <AxisValueQuickList
        axis={axis}
        items={facetQuery.data ?? []}
        isLoading={facetQuery.isLoading}
        isError={facetQuery.isError}
        isSelected={(value) => selectedTags.includes(buildFilterTag(axis, value))}
        onSelect={(item, e) => {
          onSelectValue(buildFilterTag(axis, item.value), {
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
          });
          closeAndMaybeRefocus();
        }}
        onClose={closeAndMaybeRefocus}
      />
    </div>,
    document.body,
  );
}
