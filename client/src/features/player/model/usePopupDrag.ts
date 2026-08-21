// 再生ポップアップのドラッグ移動。
// ボタン・入力・シークバー上からはドラッグを開始させず、余白部分のみを掴む。
// 位置は playerPopupOffsetAtom（localStorage）に確定値のみを書き込み、ドラッグ中は
// motion value（x/y）だけで追従させる。初期位置付近での離しは吸着してオフセットをリセットする。

import { useAtom } from "jotai";
import { animate, useDragControls, useMotionValue, type PanInfo } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { playerPopupOffsetAtom, type PlayerPopupOffset } from "./playerPresentationAtoms";
import { clamp } from "../../../shared/lib/clamp";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";

/** 離した位置が初期位置からこの距離(px)以内なら吸着して初期位置へ戻す。 */
const SNAP_DISTANCE_PX = 70;
const RESET_DURATION_S = 0.22;
/** ドラッグの起点判定から除外する操作系要素。 */
const DRAG_IGNORE_SELECTOR = "button, input, a, [role='slider']";

interface DragConstraints {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** 実測前に暫定で使う無制約の範囲。0,0,0,0 にすると mount 直後に motion が x/y を 0 へ強制してしまう。 */
const UNBOUNDED_CONSTRAINTS: DragConstraints = {
  top: -Infinity,
  left: -Infinity,
  right: Infinity,
  bottom: Infinity,
};

export interface PopupDragBind {
  popupRef: React.RefObject<HTMLDivElement | null>;
  dragControls: ReturnType<typeof useDragControls>;
  dragConstraints: DragConstraints;
  x: ReturnType<typeof useMotionValue<number>>;
  y: ReturnType<typeof useMotionValue<number>>;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onDragEnd: (event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => void;
}

export function usePopupDrag(): PopupDragBind {
  const popupRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [offset, setOffset] = useAtom(playerPopupOffsetAtom);
  const { reduced } = useMotionVariants();

  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const x = useMotionValue(offset.x);
  const y = useMotionValue(offset.y);

  const [dragConstraints, setDragConstraints] = useState<DragConstraints>(UNBOUNDED_CONSTRAINTS);
  const dragConstraintsRef = useRef(dragConstraints);
  dragConstraintsRef.current = dragConstraints;

  const recomputeConstraints = useCallback(() => {
    const el = popupRef.current;
    if (!el) return;
    // getBoundingClientRect は入場アニメ中の scale の影響を受けて縮んだ値になるため使わない。
    // offsetWidth/offsetHeight は transform の影響を受けないレイアウトサイズ、
    // 初期位置は CSS の right/bottom（transform 適用前の値）から直接求める。
    const style = getComputedStyle(el);
    const rightPx = Number.parseFloat(style.right) || 0;
    const bottomPx = Number.parseFloat(style.bottom) || 0;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const current = offsetRef.current;
    const next: DragConstraints = {
      left: -(window.innerWidth - rightPx - width),
      top: -(window.innerHeight - bottomPx - height),
      right: rightPx,
      bottom: bottomPx,
    };
    setDragConstraints(next);

    const clamped: PlayerPopupOffset = {
      x: clamp(current.x, next.left, next.right),
      y: clamp(current.y, next.top, next.bottom),
    };
    if (clamped.x !== current.x || clamped.y !== current.y) {
      setOffset(clamped);
      x.set(clamped.x);
      y.set(clamped.y);
    }
  }, [setOffset, x, y]);

  useLayoutEffect(() => {
    recomputeConstraints();
  }, [recomputeConstraints]);

  useEffect(() => {
    window.addEventListener("resize", recomputeConstraints);
    return () => window.removeEventListener("resize", recomputeConstraints);
  }, [recomputeConstraints]);

  const resetToOrigin = useCallback(() => {
    const duration = reduced ? 0 : RESET_DURATION_S;
    animate(x, 0, { duration, ease: [0, 0, 0.2, 1] });
    animate(y, 0, { duration, ease: [0, 0, 0.2, 1] });
    // 既に原点なら書き込み・再レンダー不要（未ドラッグ状態での通常クリックが毎回ここを通るため）。
    const current = offsetRef.current;
    if (current.x === 0 && current.y === 0) return;
    setOffset({ x: 0, y: 0 });
  }, [reduced, setOffset, x, y]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(DRAG_IGNORE_SELECTOR)) return;
      dragControls.start(e);
    },
    [dragControls],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(DRAG_IGNORE_SELECTOR)) return;
      resetToOrigin();
    },
    [resetToOrigin],
  );

  const onDragEnd = useCallback(() => {
    const rawX = x.get();
    const rawY = y.get();
    if (Math.hypot(rawX, rawY) <= SNAP_DISTANCE_PX) {
      resetToOrigin();
      return;
    }
    const constraints = dragConstraintsRef.current;
    const next: PlayerPopupOffset = {
      x: clamp(rawX, constraints.left, constraints.right),
      y: clamp(rawY, constraints.top, constraints.bottom),
    };
    if (next.x !== rawX) x.set(next.x);
    if (next.y !== rawY) y.set(next.y);
    // 移動を伴わないクリック（next が現在値と同じ）では localStorage 書き込み・再レンダーを起こさない。
    const current = offsetRef.current;
    if (next.x === current.x && next.y === current.y) return;
    setOffset(next);
  }, [resetToOrigin, setOffset, x, y]);

  return {
    popupRef,
    dragControls,
    dragConstraints,
    x,
    y,
    onPointerDown,
    onDoubleClick,
    onDragEnd,
  };
}
