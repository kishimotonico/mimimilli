import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  dlsiteBulkProgressEventSchema,
  type DlsiteBulkProgressEvent,
  type DlsiteBulkSnapshot,
} from "@mimimilli/shared";
import { cancelDlsiteBulk, getDlsiteBulkStatus, startDlsiteBulk } from "../../../entities/work/api";
import { API_BASE } from "../../../shared/api/http";
import { getDlsiteInvalidationKeys } from "../../library/model/dlsiteInvalidation";
import {
  dlsiteBulkActionsAtom,
  dlsiteBulkActiveAtom,
  dlsiteBulkStartingAtom,
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkCancellingAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkProgressAtom,
  dlsiteBulkResultAtom,
  type DlsiteBulkActions,
} from "../model/atoms";

type TerminalEvent = Extract<DlsiteBulkProgressEvent, { type: "complete" | "cancelled" | "error" }>;

function terminalFromSnapshot(snapshot: DlsiteBulkSnapshot): TerminalEvent | null {
  if (snapshot.status === "complete") return { type: "complete", result: snapshot.result };
  if (snapshot.status === "cancelled") return { type: "cancelled", result: snapshot.result };
  if (snapshot.status === "error") return { type: "error", message: snapshot.message };
  return null;
}

export default function DlsiteBulkRuntime() {
  const queryClient = useQueryClient();
  const active = useAtomValue(dlsiteBulkActiveAtom);
  const setActive = useSetAtom(dlsiteBulkActiveAtom);
  const setStarting = useSetAtom(dlsiteBulkStartingAtom);
  const setCancelling = useSetAtom(dlsiteBulkCancellingAtom);
  const setProgress = useSetAtom(dlsiteBulkProgressAtom);
  const setResult = useSetAtom(dlsiteBulkResultAtom);
  const setCancelledResult = useSetAtom(dlsiteBulkCancelledResultAtom);
  const setError = useSetAtom(dlsiteBulkErrorAtom);
  const setActions = useSetAtom(dlsiteBulkActionsAtom);

  const invalidateDlsiteQueries = useCallback(() => {
    void Promise.all(
      getDlsiteInvalidationKeys().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }, [queryClient]);

  const resetTerminalState = useCallback(() => {
    setResult(null);
    setCancelledResult(null);
    setError(null);
    setProgress(null);
    setCancelling(false);
  }, [setCancelledResult, setCancelling, setError, setProgress, setResult]);

  const startingRef = useRef(false);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    resetTerminalState();
    try {
      await startDlsiteBulk();
      setActive(true);
    } catch (cause) {
      setActive(false);
      setCancelling(false);
      setError(cause instanceof Error ? cause.message : "一括取得を開始できませんでした");
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [resetTerminalState, setActive, setCancelling, setError, setStarting]);

  const attach = useCallback(() => {
    resetTerminalState();
    setActive(true);
  }, [resetTerminalState, setActive]);

  const dismiss = useCallback(() => {
    setResult(null);
    setCancelledResult(null);
    setError(null);
  }, [setCancelledResult, setError, setResult]);

  const cancel = useCallback(async () => {
    if (!active) return;
    setError(null);
    try {
      await cancelDlsiteBulk();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "一括取得の中止に失敗しました");
      throw cause;
    }
  }, [active, setError]);

  const actions = useMemo<DlsiteBulkActions>(
    () => ({ start, attach, cancel, dismiss }),
    [attach, cancel, dismiss, start],
  );

  useEffect(() => {
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);

  useEffect(() => {
    if (!active) return;

    let disposed = false;
    let terminalHandled = false;
    let generation = 0;
    const source = new EventSource(`${API_BASE}/dlsite/events`);

    const detach = (): void => {
      if (disposed) return;
      setActive(false);
      setCancelling(false);
      source.close();
    };

    const fail = (message: string): void => {
      if (disposed || terminalHandled) return;
      terminalHandled = true;
      setError(message);
      detach();
    };

    const applyTerminal = (event: TerminalEvent): void => {
      if (disposed || terminalHandled) return;
      terminalHandled = true;
      if (event.type === "complete") {
        setResult(event.result);
      } else if (event.type === "cancelled") {
        setCancelledResult(event.result);
      } else {
        setError(event.message);
      }
      detach();
      invalidateDlsiteQueries();
    };

    const applySnapshot = (snapshot: DlsiteBulkSnapshot): void => {
      if (snapshot.status === "running" || snapshot.status === "cancelling") {
        if (snapshot.status === "cancelling") setCancelling(true);
        if (snapshot.progress) setProgress(snapshot.progress);
        return;
      }
      const terminal = terminalFromSnapshot(snapshot);
      if (terminal) applyTerminal(terminal);
    };

    const handle = (event: MessageEvent<string>): void => {
      generation += 1;
      let json: unknown;
      try {
        json = JSON.parse(event.data);
      } catch {
        fail("DLsite進捗イベントの解析に失敗しました");
        return;
      }
      const parsed = dlsiteBulkProgressEventSchema.safeParse(json);
      if (!parsed.success) {
        fail("DLsite進捗イベントの形式が不正です");
        return;
      }
      if (parsed.data.type === "progress") {
        setProgress({ processed: parsed.data.processed, total: parsed.data.total });
      } else if (parsed.data.type === "cancelling") {
        setCancelling(true);
      } else {
        applyTerminal(parsed.data);
      }
    };

    const refresh = (): void => {
      if (disposed || terminalHandled) return;
      const pollGeneration = ++generation;
      void getDlsiteBulkStatus()
        .then((snapshot) => {
          if (disposed || terminalHandled || pollGeneration !== generation) return;
          if (!snapshot) {
            if (source.readyState === EventSource.CLOSED) {
              fail("DLsite一括取得の接続が切断されました");
            }
            return;
          }
          if (
            source.readyState === EventSource.CLOSED &&
            (snapshot.status === "running" || snapshot.status === "cancelling")
          ) {
            fail("DLsite一括取得の接続が切断されました");
            return;
          }
          applySnapshot(snapshot);
        })
        .catch((cause: unknown) => {
          if (disposed || terminalHandled || pollGeneration !== generation) return;
          if (source.readyState === EventSource.CLOSED) {
            fail(
              cause instanceof Error ? cause.message : "DLsite一括取得の状態を取得できませんでした",
            );
          }
        });
    };

    const onNamedEvent = (event: Event): void => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        handle(event);
      }
    };

    for (const type of ["progress", "cancelling", "complete", "cancelled"] as const) {
      source.addEventListener(type, onNamedEvent);
    }
    source.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        handle(event);
        return;
      }
      refresh();
    });

    return () => {
      disposed = true;
      source.close();
    };
  }, [
    active,
    invalidateDlsiteQueries,
    setActive,
    setCancelledResult,
    setCancelling,
    setError,
    setProgress,
    setResult,
  ]);

  return null;
}
