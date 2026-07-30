import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PRESENCE_DURATION_MS } from "./presenceDurations";

export type PresencePhase = "enter" | "shown" | "exit";

export interface UsePresenceOptions {
  /** initial={false} 相当。初回レンダー時に show=true のときだけ enter をスキップする */
  skipInitial?: boolean;
  durationMs?: number;
  onExitComplete?: () => void;
}

/** 出現/退出アニメーション中もマウントを保ち、退出完了後にアンマウントする */
export function usePresence(show: boolean, options: UsePresenceOptions = {}) {
  const {
    skipInitial = false,
    durationMs = DEFAULT_PRESENCE_DURATION_MS,
    onExitComplete,
  } = options;
  const suppressInitialEnterRef = useRef(skipInitial && show);
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;
  const rafIdsRef = useRef<{ outer?: number; inner?: number }>({});

  const cancelEnterRaf = useCallback(() => {
    if (rafIdsRef.current.outer !== undefined) cancelAnimationFrame(rafIdsRef.current.outer);
    if (rafIdsRef.current.inner !== undefined) cancelAnimationFrame(rafIdsRef.current.inner);
    rafIdsRef.current = {};
  }, []);

  const [mounted, setMounted] = useState(() => show);
  const [phase, setPhase] = useState<PresencePhase>(() => {
    if (!show) return "exit";
    if (suppressInitialEnterRef.current) {
      suppressInitialEnterRef.current = false;
      return "shown";
    }
    return "enter";
  });

  const beginEnter = useCallback(() => {
    cancelEnterRaf();
    setPhase("enter");
    rafIdsRef.current.outer = requestAnimationFrame(() => {
      rafIdsRef.current.inner = requestAnimationFrame(() => {
        setPhase("shown");
        rafIdsRef.current = {};
      });
    });
  }, [cancelEnterRaf]);

  useEffect(() => {
    if (show) {
      if (!mounted) {
        setMounted(true);
        if (suppressInitialEnterRef.current) {
          suppressInitialEnterRef.current = false;
          setPhase("shown");
          return;
        }
        beginEnter();
        return;
      }
      if (phase === "exit" || phase === "enter") {
        beginEnter();
      }
      return;
    }

    cancelEnterRaf();
    if (mounted && phase !== "exit") {
      setPhase("exit");
    }
  }, [show, mounted, phase, beginEnter, cancelEnterRaf]);

  const completeExit = useCallback(() => {
    setMounted(false);
    onExitCompleteRef.current?.();
  }, []);

  useEffect(() => {
    if (phase !== "exit" || !mounted) return;
    const timer = setTimeout(completeExit, durationMs);
    return () => clearTimeout(timer);
  }, [phase, mounted, durationMs, completeExit]);

  useEffect(() => cancelEnterRaf, [cancelEnterRaf]);

  return { mounted, phase };
}
