import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const POPOVER_MARGIN = 8;

export interface PopoverLayout {
  left: number;
  width: number;
  /** 展開先コンテナの実幅。狭幅判定など呼び出し側の追加ロジックに使う */
  containerWidth: number;
}

function anchorContainer(anchor: HTMLElement | null): HTMLElement | null {
  return (anchor?.closest(".mle-prv__meta") ??
    anchor?.closest(".mle-prv__body") ??
    null) as HTMLElement | null;
}

function getClampedPopoverLayout(anchor: HTMLElement, preferredWidth: number): PopoverLayout {
  const anchorRect = anchor.getBoundingClientRect();
  // タグ・アクション行が実際に収まる列は `.mle-prv__meta`（カバー画像列を含まない）。
  // 無ければ `.mle-prv__body` 全体にフォールバックする。
  const container = anchorContainer(anchor);
  const containerRect = container?.getBoundingClientRect();
  const visibleLeft = (containerRect?.left ?? 0) + POPOVER_MARGIN;
  const visibleRight = (containerRect?.right ?? window.innerWidth) - POPOVER_MARGIN;
  const availableWidth = Math.max(0, visibleRight - visibleLeft);
  const width = Math.min(preferredWidth, availableWidth);
  const minLeft = visibleLeft - anchorRect.left;
  const maxLeft = visibleRight - width - anchorRect.left;
  const left = maxLeft < minLeft ? minLeft : Math.min(Math.max(0, minLeft), maxLeft);

  return { left, width, containerWidth: containerRect?.width ?? window.innerWidth };
}

export interface UseAnchoredPopoverOptions {
  isOpen: boolean;
  preferredWidth: number;
  /** ポップオーバー外へのポインター押下時に呼ぶ */
  onOutsideClick: () => void;
  /** Escapeキー押下時に呼ぶ（outsideClickと副作用が異なる場合に個別指定できる） */
  onEscape: () => void;
  /**
   * outside-click判定の境界に使う要素。未指定なら anchorRef 自身を使う。
   * タグ追加ポップオーバーのように、トリガーボタン＋浮遊/フル幅どちらの表示も含めて
   * 境界としたい場合に、呼び出し側で別途 ref を用意して渡す。
   */
  boundaryRef?: RefObject<HTMLElement | null>;
}

export interface UseAnchoredPopoverResult {
  /** ポップオーバーのトリガー要素に付ける ref。位置計算の基準になる */
  anchorRef: RefObject<HTMLDivElement | null>;
  layout: PopoverLayout;
}

/**
 * アンカー要素基準で展開するポップオーバーの「配置クランプ＋外側クリック/Escapeで閉じる」を
 * 共通化するフック。タグ追加ポップオーバーとアクション（その他）ポップオーバーの両方が使う。
 */
export function useAnchoredPopover({
  isOpen,
  preferredWidth,
  onOutsideClick,
  onEscape,
  boundaryRef,
}: UseAnchoredPopoverOptions): UseAnchoredPopoverResult {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<PopoverLayout>({
    left: 0,
    width: preferredWidth,
    containerWidth: preferredWidth,
  });

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const boundary = boundaryRef?.current ?? anchorRef.current;
      if (boundary && event.target instanceof Node && !boundary.contains(event.target)) {
        onOutsideClick();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onOutsideClick, onEscape, boundaryRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updateLayout = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const nextLayout = getClampedPopoverLayout(anchor, preferredWidth);

      setLayout((current) =>
        current.left === nextLayout.left && current.width === nextLayout.width
          ? current
          : nextLayout,
      );
    };

    updateLayout();
    const container = anchorContainer(anchorRef.current);
    const resizeObserver = container ? new ResizeObserver(updateLayout) : null;
    if (container) resizeObserver?.observe(container);
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [isOpen, preferredWidth]);

  return { anchorRef, layout };
}
