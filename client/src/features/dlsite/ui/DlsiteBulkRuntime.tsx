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
import {
  bindSseTransportError,
  connectSse,
  createSseGeneration,
  parseTypedSseMessage,
} from "../../../shared/api/sseTransport";
import { invalidateDlsiteCache } from "../model/dlsiteInvalidation";
import {
  dlsiteBulkActionsAtom,
  dlsiteBulkActiveAtom,
  dlsiteBulkStartingAtom,
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkCancellingAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkProgressAtom,
  dlsiteBulkResultAtom,
  dlsiteInvalidateAtom,
  type DlsiteBulkActions,
} from "../../../entities/dlsite/model/bulkAtoms";

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
  const setInvalidate = useSetAtom(dlsiteInvalidateAtom);

  const invalidateDlsiteQueries = useCallback(
    (workIds?: string | string[]) => {
      void invalidateDlsiteCache(queryClient, workIds);
    },
    [queryClient],
  );

  const resetTerminalState = useCallback(() => {
    setResult(null);
    setCancelledResult(null);
    setError(null);
    setProgress(null);
    setCancelling(false);
  }, [setCancelledResult, setCancelling, setError, setProgress, setResult]);

  const startingRef = useRef(false);
  // start()自身がジョブを開始した直後にSSE購読するときだけ、進捗イベントを
  // 最初から取りこぼさず全て捕捉できると確信できる。attach()は既に走っている
  // かもしれないジョブへ後から繋ぐため、この確信が持てない
  // （invalidateDlsiteQueriesの選択的無効化に使うupdatedWorkIdsの信頼性に関わる）。
  const freshStartRef = useRef(false);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    resetTerminalState();
    try {
      freshStartRef.current = true;
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
    freshStartRef.current = false;
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
    const invalidate = (workIds?: string | string[]) => invalidateDlsiteCache(queryClient, workIds);
    setInvalidate(invalidate);
    return () => setInvalidate(null);
  }, [queryClient, setInvalidate]);

  useEffect(() => {
    if (!active) return;

    let disposed = false;
    let terminalHandled = false;
    const generation = createSseGeneration();
    const connection = connectSse(`${API_BASE}/dlsite/events`);
    const source = connection.source;
    // progressイベントのworkIdを集め、完了時にskippedでない（実際に処理対象だった）
    // 作品の詳細キャッシュだけを選択的に無効化する（getDlsiteInvalidationKeys参照）。
    // SSE切断→再接続、またはattach()での後乗り（開始直後からの購読と確信できない）
    // でprogressイベントを取りこぼした可能性がある場合はmissedProgressを立て、
    // 安全側に倒して全作品を無効化する。
    const updatedWorkIds = new Set<string>();
    let missedProgress = !freshStartRef.current;
    freshStartRef.current = false;

    const detach = (): void => {
      if (disposed) return;
      setActive(false);
      setCancelling(false);
      connection.close();
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
      invalidateDlsiteQueries(missedProgress ? undefined : [...updatedWorkIds]);
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

    const eventMessages = {
      parse: "DLsite進捗イベントの解析に失敗しました",
      schema: "DLsite進捗イベントの形式が不正です",
    } as const;

    const handleRawSseEvent = (raw: Event): void => {
      if (!(raw instanceof MessageEvent) || typeof raw.data !== "string") return;
      generation.bump();
      const parsed = parseTypedSseMessage(raw.data, dlsiteBulkProgressEventSchema, eventMessages);
      if (!parsed.ok) {
        fail(parsed.message);
        return;
      }
      const event = parsed.event;
      if (event.type === "progress") {
        setProgress({ processed: event.processed, total: event.total });
        updatedWorkIds.add(event.workId);
      } else if (event.type === "cancelling") {
        setCancelling(true);
      } else {
        applyTerminal(event);
      }
    };

    const refresh = (): void => {
      if (disposed || terminalHandled) return;
      missedProgress = true;
      const pollGeneration = generation.bump();
      void getDlsiteBulkStatus()
        .then((snapshot) => {
          if (disposed || terminalHandled || !generation.isCurrent(pollGeneration)) return;
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
          if (disposed || terminalHandled || !generation.isCurrent(pollGeneration)) return;
          if (source.readyState === EventSource.CLOSED) {
            fail(
              cause instanceof Error ? cause.message : "DLsite一括取得の状態を取得できませんでした",
            );
          }
        });
    };

    for (const type of ["progress", "cancelling", "complete", "cancelled"] as const) {
      source.addEventListener(type, handleRawSseEvent);
    }

    bindSseTransportError({
      source,
      onConnectionError: refresh,
      onNamedErrorEvent: handleRawSseEvent,
    });

    return () => {
      disposed = true;
      connection.close();
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
