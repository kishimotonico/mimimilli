import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

const POPOVER_MARGIN = 8;
const RIGHT_PLACEMENT_GAP = 6;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface PopoverLayout {
  left: number;
  width: number;
  /** 展開先コンテナの実幅。狭幅判定など呼び出し側の追加ロジックに使う */
  containerWidth: number;
  /**
   * placement:"right" のときだけ使う、ビューポート絶対座標の上端（position:fixed 前提）。
   * placement:"below"（既定）では呼び出し側が CSS の `top: calc(100% + Npx)` で
   * アンカー直下に配置するため未使用。
   */
  top?: number;
}

/** クランプ対象コンテナの決定関数。呼び出し側が渡さない場合の既定は
 *  work-preview の `.mle-prv__meta` / `.mle-prv__body`（従来どおり）。 */
export type PopoverContainerResolver = (anchor: HTMLElement) => HTMLElement | null;

const defaultContainerResolver: PopoverContainerResolver = (anchor) =>
  (anchor.closest(".mle-prv__meta") ??
    anchor.closest(".mle-prv__body") ??
    null) as HTMLElement | null;

/** 既定 "below": アンカー直下、横方向だけクランプする（非ポータルの相対配置向け）。
 *  "right": アンカーの右隣に固定配置し、上下方向をコンテナ内へクランプする
 *  （document.body へポータルする position:fixed のフライアウト向け）。 */
export type PopoverPlacement = "below" | "right";

/** 閉じた経路（document リスナーか UI からの直接呼び出しか） */
export type PopoverCloseReason = "escape" | "outside" | "direct";

function getBelowPlacementLayout(
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

/** panel が未マウント（実高さ不明）のときは高さ0として扱う。ResizeObserver が実サイズを
 *  観測し次第すぐに再計算されるため、`?? 定数` のような暫定値は使わない。 */
function getRightPlacementLayout(
  anchor: HTMLElement,
  panel: HTMLElement | null,
  preferredWidth: number,
  getContainer: PopoverContainerResolver,
): PopoverLayout {
  const anchorRect = anchor.getBoundingClientRect();
  const container = getContainer(anchor);
  const containerRect = container?.getBoundingClientRect();
  const containerTop = (containerRect?.top ?? 0) + POPOVER_MARGIN;
  const containerBottom = (containerRect?.bottom ?? window.innerHeight) - POPOVER_MARGIN;
  const panelHeight = panel?.offsetHeight ?? 0;
  const maxTop = Math.max(containerTop, containerBottom - panelHeight);
  const top = Math.min(Math.max(anchorRect.top, containerTop), maxTop);

  return {
    left: anchorRect.right + RIGHT_PLACEMENT_GAP,
    top,
    width: preferredWidth,
    containerWidth: containerRect?.width ?? window.innerWidth,
  };
}

export interface UsePopoverDismissalOptions {
  isOpen: boolean;
  /** 閉じるときに呼ぶ（フォーカス復帰の後） */
  onClose: (reason: PopoverCloseReason) => void;
  /**
   * outside-click判定の境界に使う要素。未指定なら anchorRef 自身を使う。
   * タグ追加ポップオーバーのように、トリガーボタン＋浮遊/フル幅どちらの表示も含めて
   * 境界としたい場合に、呼び出し側で別途 ref を用意して渡す。
   */
  boundaryRef?: RefObject<HTMLElement | null>;
  /**
   * 外側クリック判定に含める追加の境界要素（ポータル先のパネルなど）。
   * anchor / boundaryRef とあわせて、いずれかに含まれるクリックは閉じない。
   */
  additionalBoundaryRefs?: RefObject<HTMLElement | null>[];
  /**
   * トリガー要素（またはそれを含む祖先）の ref。ポップオーバーを閉じた際、
   * フォーカスが BODY へ落ちていたらこの要素内の最初のフォーカス可能要素へ戻す。
   */
  anchorRef: RefObject<HTMLElement | null>;
}

export interface UsePopoverDismissalResult {
  /** すべての閉じ経路はこの関数を通す */
  close: (reason?: PopoverCloseReason) => void;
}

function isInsideBoundaries(
  target: Node,
  anchorRef: RefObject<HTMLElement | null>,
  boundaryRef: RefObject<HTMLElement | null> | undefined,
  additionalBoundaryRefs: RefObject<HTMLElement | null>[] | undefined,
): boolean {
  const primary = boundaryRef?.current ?? anchorRef.current;
  const boundaries = [primary, ...(additionalBoundaryRefs?.map((r) => r.current) ?? [])].filter(
    Boolean,
  ) as HTMLElement[];
  return boundaries.some((el) => el.contains(target));
}

function shouldRefocusPopoverAnchor(
  anchorRef: RefObject<HTMLElement | null>,
  boundaryRef: RefObject<HTMLElement | null> | undefined,
  additionalBoundaryRefs: RefObject<HTMLElement | null>[] | undefined,
): boolean {
  const active = document.activeElement;
  if (active === document.body) return true;
  if (!(active instanceof Node)) return false;
  return isInsideBoundaries(active, anchorRef, boundaryRef, additionalBoundaryRefs);
}

function refocusPopoverAnchor(anchorRef: RefObject<HTMLElement | null>): void {
  const anchor = anchorRef.current;
  if (!anchor) return;
  if (anchor.matches(FOCUSABLE_SELECTOR)) anchor.focus();
  else anchor.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
}

function refocusPopoverAnchorIfNeeded(
  anchorRef: RefObject<HTMLElement | null>,
  boundaryRef: RefObject<HTMLElement | null> | undefined,
  additionalBoundaryRefs: RefObject<HTMLElement | null>[] | undefined,
): void {
  if (!shouldRefocusPopoverAnchor(anchorRef, boundaryRef, additionalBoundaryRefs)) return;
  refocusPopoverAnchor(anchorRef);
}

/**
 * ポップオーバー/メニュー共通の「外側クリック/Escapeで閉じる」＋「閉じたときにトリガーへ
 * フォーカスを戻す」を扱うフック。通知ポップオーバー（NotificationBell）はトリガーが
 * ネイティブbuttonでクリック後もフォーカスが残るため無自覚に動いていたが、
 * ポップオーバー内へフォーカスが移った状態で閉じる（Escape・項目選択）とBODYへ落ちる欠陥があった。
 */
export function usePopoverDismissal({
  isOpen,
  onClose,
  boundaryRef,
  additionalBoundaryRefs,
  anchorRef,
}: UsePopoverDismissalOptions): UsePopoverDismissalResult {
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const closeInFlightRef = useRef(false);

  useEffect(() => {
    if (isOpen) closeInFlightRef.current = false;
  }, [isOpen]);

  const close = useCallback(
    (reason: PopoverCloseReason = "direct") => {
      if (!isOpenRef.current || closeInFlightRef.current) return;
      closeInFlightRef.current = true;
      refocusPopoverAnchorIfNeeded(anchorRef, boundaryRef, additionalBoundaryRefs);
      onClose(reason);
    },
    [onClose, boundaryRef, additionalBoundaryRefs, anchorRef],
  );

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !isInsideBoundaries(event.target, anchorRef, boundaryRef, additionalBoundaryRefs)
      ) {
        close("outside");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close("escape");
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, close, boundaryRef, additionalBoundaryRefs, anchorRef]);

  return { close };
}

export interface UseAnchoredPopoverOptions {
  isOpen: boolean;
  preferredWidth: number;
  /** 閉じるときに呼ぶ（フォーカス復帰の後） */
  onClose: (reason: PopoverCloseReason) => void;
  /**
   * outside-click判定の境界に使う要素。未指定なら anchorRef 自身を使う。
   * タグ追加ポップオーバーのように、トリガーボタン＋浮遊/フル幅どちらの表示も含めて
   * 境界としたい場合に、呼び出し側で別途 ref を用意して渡す。
   */
  boundaryRef?: RefObject<HTMLElement | null>;
  /** 外側クリック判定に含める追加の境界要素（ポータル先のパネルなど） */
  additionalBoundaryRefs?: RefObject<HTMLElement | null>[];
  /**
   * クランプ対象コンテナを差し替える。既定は `.mle-prv__meta` / `.mle-prv__body`。
   * work-preview の外（軸レールのクイックオーバーレイなど）で使う場合、
   * `.mle-app` 全体のようなコンテナを渡す。
   */
  getContainer?: PopoverContainerResolver;
  /** 既定 "below"。"right" はアンカー右隣＋上下クランプ（ポータル+fixed 前提）。 */
  placement?: PopoverPlacement;
}

export interface UseAnchoredPopoverResult {
  /** ポップオーバーのトリガー要素に付ける ref。位置計算の基準になる */
  anchorRef: RefObject<HTMLDivElement | null>;
  /**
   * placement:"right" のときにポップオーバー本体（パネル）に付ける ref。
   * ResizeObserver で実サイズを観測し、上下クランプへ反映する。
   */
  panelRef: RefObject<HTMLDivElement | null>;
  layout: PopoverLayout;
  /** すべての閉じ経路はこの関数を通す */
  close: (reason?: PopoverCloseReason) => void;
}

/**
 * アンカー要素基準で展開するポップオーバーの「配置クランプ＋外側クリック/Escapeで閉じる＋
 * 閉じたときのフォーカス復帰」を共通化するフック。タグ追加ポップオーバー・アクション
 * （その他）ポップオーバー・軸レールのクイックオーバーレイが使う。
 */
export function useAnchoredPopover({
  isOpen,
  preferredWidth,
  onClose,
  boundaryRef,
  additionalBoundaryRefs,
  getContainer = defaultContainerResolver,
  placement = "below",
}: UseAnchoredPopoverOptions): UseAnchoredPopoverResult {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dismissalBoundaryRefs = useMemo(
    () =>
      placement === "right"
        ? [...(additionalBoundaryRefs ?? []), panelRef]
        : additionalBoundaryRefs,
    [placement, additionalBoundaryRefs],
  );
  const [layout, setLayout] = useState<PopoverLayout>({
    left: 0,
    width: preferredWidth,
    containerWidth: preferredWidth,
  });

  const { close } = usePopoverDismissal({
    isOpen,
    onClose,
    boundaryRef,
    additionalBoundaryRefs: dismissalBoundaryRefs,
    anchorRef,
  });

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updateLayout = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const nextLayout =
        placement === "right"
          ? getRightPlacementLayout(anchor, panelRef.current, preferredWidth, getContainer)
          : getBelowPlacementLayout(anchor, preferredWidth, getContainer);

      setLayout((current) =>
        current.left === nextLayout.left &&
        current.width === nextLayout.width &&
        current.top === nextLayout.top
          ? current
          : nextLayout,
      );
    };

    updateLayout();
    const container = anchorRef.current ? getContainer(anchorRef.current) : null;
    const resizeObserver = new ResizeObserver(updateLayout);
    if (container) resizeObserver.observe(container);
    // "right" 配置はパネル自身の実高さで上下クランプするため、パネルの実サイズ変化にも
    // 追従する（値の読み込み完了・検索での絞り込み・ソート展開など）。ref は呼び出し側の
    // JSX で同じレンダーの中でパネル要素に付くため、このレイアウトエフェクトの実行時点で
    // 既に panelRef.current は設定済み。
    if (placement === "right" && panelRef.current) resizeObserver.observe(panelRef.current);
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [isOpen, preferredWidth, getContainer, placement]);

  return { anchorRef, panelRef, layout, close };
}
