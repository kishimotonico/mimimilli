import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FacetAxisId } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import type { HoverIntentHandlers } from "../../../shared/lib/useHoverIntent";
import AxisValueQuickList from "./AxisValueQuickList";

// 軸レール行のクイックオーバーレイ（ADR-0012 §7）。ホバー約200ms・フォーカス中の
// ArrowRight で開く。軸行の右向き矢印・ArrowRightキーの操作方向と揃えて右側に出す。
// 軸レールは画面左端に固定されているため、デスクトップ幅で右に余白が無いケースは
// 実質発生せず、左右の反転フォールバックは設けない（モバイル幅は ADR-0006 の別設計）。
// 上下方向だけ、軸行を基準に画面外へはみ出さないようクランプする。
// 軸レールの列は overflow: hidden auto でクリップされるため、document.body へ
// ポータルし fixed 位置で表示する。

const OVERLAY_WIDTH = 280;
const OVERLAY_MAX_HEIGHT = 360;
const OVERLAY_GAP = 6;
const VIEWPORT_MARGIN = 8;

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
    // 軸行の上端に合わせるのが既定。画面外へはみ出す分だけ上下方向にクランプする
    // （左右の反転フォールバックは設けない）。
    const maxTop = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - estimatedHeight - VIEWPORT_MARGIN,
    );
    const top = Math.min(Math.max(rect.top, VIEWPORT_MARGIN), maxTop);
    setPosition({ left: rect.right + OVERLAY_GAP, top });
  }, [isOpen, anchorEl]);

  if (!isOpen || !anchorEl || position === null) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="mll-qoverlay mll-qoverlay--fixed"
      style={{ left: position.left, top: position.top, width: OVERLAY_WIDTH }}
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
