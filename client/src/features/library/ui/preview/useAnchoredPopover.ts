import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const POPOVER_MARGIN = 8;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface PopoverLayout {
  left: number;
  width: number;
  /** 展開先コンテナの実幅。狭幅判定など呼び出し側の追加ロジックに使う */
  containerWidth: number;
}

/** クランプ対象コンテナの決定関数。呼び出し側が渡さない場合の既定は
 *  work-preview の `.mle-prv__meta` / `.mle-prv__body`（従来どおり）。 */
export type PopoverContainerResolver = (anchor: HTMLElement) => HTMLElement | null;

const defaultContainerResolver: PopoverContainerResolver = (anchor) =>
  (anchor.closest(".mle-prv__meta") ??
    anchor.closest(".mle-prv__body") ??
    null) as HTMLElement | null;

function getClampedPopoverLayout(
  anchor: HTMLElement,
  preferredWidth: number,
  getContainer: PopoverContainerResolver,
): PopoverLayout {
  const anchorRect = anchor.getBoundingClientRect();
  const container = getContainer(anchor);
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

export interface UsePopoverDismissalOptions {
  isOpen: boolean;
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
  /**
   * トリガー要素（またはそれを含む祖先）の ref。ポップオーバーを閉じた際、
   * フォーカスが BODY へ落ちていたらこの要素内の最初のフォーカス可能要素へ戻す。
   */
  anchorRef: RefObject<HTMLElement | null>;
}

/**
 * ポップオーバー/メニュー共通の「外側クリック/Escapeで閉じる」＋「閉じたときにトリガーへ
 * フォーカスを戻す」を扱うフック。通知ポップオーバー（NotificationBell）はトリガーが
 * ネイティブbuttonでクリック後もフォーカスが残るため無自覚に動いていたが、
 * ポップオーバー内へフォーカスが移った状態で閉じる（Escape・項目選択）とBODYへ落ちる欠陥があった。
 */
export function usePopoverDismissal({
  isOpen,
  onOutsideClick,
  onEscape,
  boundaryRef,
  anchorRef,
}: UsePopoverDismissalOptions): void {
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
  }, [isOpen, onOutsideClick, onEscape, boundaryRef, anchorRef]);

  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen && document.activeElement === document.body) {
      anchorRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, anchorRef]);
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
  /**
   * クランプ対象コンテナを差し替える。既定は `.mle-prv__meta` / `.mle-prv__body`。
   * work-preview の外（軸レールのクイックオーバーレイなど）で使う場合、
   * `.mle-app` 全体のようなコンテナを渡す。
   */
  getContainer?: PopoverContainerResolver;
}

export interface UseAnchoredPopoverResult {
  /** ポップオーバーのトリガー要素に付ける ref。位置計算の基準になる */
  anchorRef: RefObject<HTMLDivElement | null>;
  layout: PopoverLayout;
}

/**
 * アンカー要素基準で展開するポップオーバーの「配置クランプ＋外側クリック/Escapeで閉じる＋
 * 閉じたときのフォーカス復帰」を共通化するフック。タグ追加ポップオーバーとアクション
 * （その他）ポップオーバーの両方が使う。
 */
export function useAnchoredPopover({
  isOpen,
  preferredWidth,
  onOutsideClick,
  onEscape,
  boundaryRef,
  getContainer = defaultContainerResolver,
}: UseAnchoredPopoverOptions): UseAnchoredPopoverResult {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<PopoverLayout>({
    left: 0,
    width: preferredWidth,
    containerWidth: preferredWidth,
  });

  usePopoverDismissal({ isOpen, onOutsideClick, onEscape, boundaryRef, anchorRef });

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updateLayout = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const nextLayout = getClampedPopoverLayout(anchor, preferredWidth, getContainer);

      setLayout((current) =>
        current.left === nextLayout.left && current.width === nextLayout.width
          ? current
          : nextLayout,
      );
    };

    updateLayout();
    const container = anchorRef.current ? getContainer(anchorRef.current) : null;
    const resizeObserver = container ? new ResizeObserver(updateLayout) : null;
    if (container) resizeObserver?.observe(container);
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [isOpen, preferredWidth, getContainer]);

  return { anchorRef, layout };
}
