// シークバー共通のポインター操作フック（バーの下辺ストリップ / ポップアップのスライダー両方で使う）。
// クリックで即座にシークし、ドラッグ中も追従してシークし続ける（スクラブ）。
// ホバー中/ドラッグ中の位置（0-1 の比率）も返すため、時刻ツールチップの表示に使える。

import { useCallback, useRef, useState } from "react";

interface UseSeekDragOptions {
  duration: number;
  onSeek: (time: number) => void;
}

export interface SeekDragBind {
  trackRef: React.RefObject<HTMLDivElement | null>;
  dragging: boolean;
  /** ホバー/ドラッグ中のトラック内位置（0-1）。非ホバー時は null */
  hoverRatio: number | null;
  /** hoverRatio に対応する時刻（秒）。非ホバー時は null */
  hoverTime: number | null;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
}

export function useSeekDrag({ duration, onSeek }: UseSeekDragOptions): SeekDragBind {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const ratioFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    const ratio = ratioFromClientX(e.clientX);
    setHoverRatio(ratio);
    onSeek(ratio * duration);
  }, [duration, onSeek, ratioFromClientX]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const ratio = ratioFromClientX(e.clientX);
    setHoverRatio(ratio);
    if (dragging) onSeek(ratio * duration);
  }, [dragging, duration, onSeek, ratioFromClientX]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect) {
      const inside = e.clientX >= rect.left && e.clientX <= rect.right
        && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) setHoverRatio(null);
    }
  }, []);

  const onPointerLeave = useCallback(() => {
    if (!dragging) setHoverRatio(null);
  }, [dragging]);

  return {
    trackRef,
    dragging,
    hoverRatio,
    hoverTime: hoverRatio !== null ? hoverRatio * duration : null,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
  };
}
