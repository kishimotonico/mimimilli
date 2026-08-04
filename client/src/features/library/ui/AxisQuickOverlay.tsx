import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FacetAxisId } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import { useAnchoredPopover } from "./preview/useAnchoredPopover";
import type { HoverIntentHandlers } from "../../../shared/lib/useHoverIntent";
import AxisValueQuickList from "./AxisValueQuickList";

// 軸レール行のクイックオーバーレイ（ADR-0012 §7、TASK-182）。ホバー約200ms・
// フォーカス中の ArrowRight で開く。軸レールの列は overflow: hidden auto で
// クリップされるため、document.body へポータルし fixed 位置で表示する。

const OVERLAY_WIDTH = 280;
const OVERLAY_MAX_HEIGHT = 360;
const OVERLAY_GAP = 6;

interface AxisQuickOverlayProps {
  axis: AxisId;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  selectedTags: string[];
  onSelectValue: (tag: string, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  // 位置クランプ（横方向）だけ useAnchoredPopover に委ねる。ポータル先（document.body）が
  // anchorEl（軸レール行、.mle-app 配下）と別DOM系統になるため、外側クリック/Escape判定は
  // anchorEl とパネル両方を境界にした独自ロジックを下で使う（onOutsideClick/onEscapeは使わない）。
  const { anchorRef, layout } = useAnchoredPopover({
    isOpen,
    preferredWidth: OVERLAY_WIDTH,
    onOutsideClick: () => {},
    onEscape: () => {},
    getContainer: (el) => el.closest(".mle-app"),
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

  useLayoutEffect(() => {
    if (!isOpen || !anchorEl) {
      setPosition(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const estimatedHeight = Math.min(OVERLAY_MAX_HEIGHT, panelRef.current?.offsetHeight ?? 240);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= estimatedHeight + OVERLAY_GAP || rect.top < estimatedHeight
        ? rect.bottom + OVERLAY_GAP
        : Math.max(8, rect.top - estimatedHeight - OVERLAY_GAP);
    setPosition({ left: rect.left + layout.left, top });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout の値変化（left/width）のみで十分
  }, [isOpen, anchorEl, layout.left, layout.width]);

  if (!isOpen || !anchorEl || position === null) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="mll-qoverlay mll-qoverlay--fixed"
      style={{ left: position.left, top: position.top, width: layout.width }}
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
