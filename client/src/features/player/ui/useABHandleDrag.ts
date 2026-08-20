// AB リピートのハンドル（シークバー上の角括弧）をドラッグして時刻を微調整するフック。
// 位置計算は useSeekDrag と同じトラック要素基準（比率 → 秒）だが、シーク（再生位置移動）ではなく
// abPointSet の positionSec を動かす点が異なるため、シーク本体のドラッグとは分離している。

import { useCallback, useState } from "react";

interface UseABHandleDragOptions {
  trackRef: React.RefObject<HTMLDivElement | null>;
  duration: number | null;
  onSet: (time: number) => void;
}

export interface ABHandleDragBind {
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function useABHandleDrag({
  trackRef,
  duration,
  onSet,
}: UseABHandleDragOptions): ABHandleDragBind {
  const [dragging, setDragging] = useState(false);

  const ratioFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return 0;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [trackRef],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      onSet(ratioFromClientX(e.clientX) * duration);
    },
    [duration, onSet, ratioFromClientX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !duration) return;
      e.stopPropagation();
      onSet(ratioFromClientX(e.clientX) * duration);
    },
    [dragging, duration, onSet, ratioFromClientX],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return { dragging, onPointerDown, onPointerMove, onPointerUp };
}
