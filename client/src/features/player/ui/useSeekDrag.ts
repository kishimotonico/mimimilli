// シークバー共通のポインター操作フック（バーの下辺ストリップ / ポップアップのスライダー両方で使う）。
// クリックで即座にシークし、ドラッグ中も追従してシークし続ける（スクラブ）。
// ホバー中/ドラッグ中の位置（0-1 の比率）も返すため、時刻ツールチップの表示に使える。

import { useCallback, useMemo, useRef, useState } from "react";
import { formatDuration, formatTime } from "../../../shared/lib/format";

/** WAI-ARIA slider パターンの矢印キー刻み（秒） */
export const SEEK_KEYBOARD_STEP_SEC = 5;

interface UseSeekDragOptions {
  duration: number | null;
  currentTime: number;
  onSeek: (time: number) => void;
  ariaLabel?: string;
}

export interface SeekSliderProps {
  role: "slider";
  tabIndex: 0 | -1;
  "aria-label": string;
  "aria-valuenow": number;
  "aria-valuemin": number;
  "aria-valuemax": number;
  "aria-valuetext": string;
  "aria-orientation": "horizontal";
  "aria-disabled"?: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export interface SeekDragBind {
  trackRef: React.RefObject<HTMLDivElement | null>;
  dragging: boolean;
  /** ホバー/ドラッグ中のトラック内位置（0-1）。非ホバー時は null */
  hoverRatio: number | null;
  /** hoverRatio に対応する時刻（秒）。非ホバー時は null */
  hoverTime: number | null;
  sliderProps: SeekSliderProps;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
}

function clampSeekTime(time: number, duration: number): number {
  return Math.max(0, Math.min(duration, time));
}

const SLIDER_KEYDOWN_KEYS = new Set([
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "ArrowUp",
  "Home",
  "End",
]);

export function useSeekDrag({
  duration,
  currentTime,
  onSeek,
  ariaLabel = "再生位置",
}: UseSeekDragOptions): SeekDragBind {
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

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      const ratio = ratioFromClientX(e.clientX);
      setHoverRatio(ratio);
      onSeek(ratio * duration);
    },
    [duration, onSeek, ratioFromClientX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return;
      const ratio = ratioFromClientX(e.clientX);
      setHoverRatio(ratio);
      if (dragging) onSeek(ratio * duration);
    },
    [dragging, duration, onSeek, ratioFromClientX],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect) {
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) setHoverRatio(null);
    }
  }, []);

  const onPointerLeave = useCallback(() => {
    if (!dragging) setHoverRatio(null);
  }, [dragging]);

  const sliderEnabled = duration !== null && duration > 0;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!SLIDER_KEYDOWN_KEYS.has(e.key)) return;

      e.preventDefault();
      e.stopPropagation();

      if (!sliderEnabled) return;

      let nextTime: number;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          nextTime = clampSeekTime(currentTime - SEEK_KEYBOARD_STEP_SEC, duration);
          break;
        case "ArrowRight":
        case "ArrowUp":
          nextTime = clampSeekTime(currentTime + SEEK_KEYBOARD_STEP_SEC, duration);
          break;
        case "Home":
          nextTime = 0;
          break;
        case "End":
          nextTime = duration;
          break;
        default:
          return;
      }
      onSeek(nextTime);
    },
    [currentTime, duration, onSeek, sliderEnabled],
  );

  const sliderProps = useMemo((): SeekSliderProps => {
    const valueMax = sliderEnabled ? duration : 0;
    const valueNow = sliderEnabled ? clampSeekTime(currentTime, duration) : 0;
    const currentLabel = formatTime(valueNow) ?? "0:00";
    const durationLabel =
      sliderEnabled && duration !== null ? (formatDuration(duration) ?? "--:--") : null;
    return {
      role: "slider",
      tabIndex: sliderEnabled ? 0 : -1,
      "aria-label": ariaLabel,
      "aria-valuenow": valueNow,
      "aria-valuemin": 0,
      "aria-valuemax": valueMax,
      "aria-valuetext":
        durationLabel !== null ? `${currentLabel} / ${durationLabel}` : currentLabel,
      "aria-orientation": "horizontal",
      ...(sliderEnabled ? {} : { "aria-disabled": true }),
      onKeyDown,
    };
  }, [ariaLabel, currentTime, duration, onKeyDown, sliderEnabled]);

  return {
    trackRef,
    dragging,
    hoverRatio,
    hoverTime: hoverRatio !== null && duration !== null ? hoverRatio * duration : null,
    sliderProps,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
  };
}
