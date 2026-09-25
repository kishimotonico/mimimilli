import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  dlsiteBulkProgressEventSchema,
  type DlsiteBulkResult,
  type DlsiteBulkSnapshot,
  type DlsiteBulkTerminal,
} from "@mimimilli/shared";
import { cancelDlsiteBulk, getDlsiteBulkStatus, startDlsiteBulk } from "../../../entities/work/api";
import { API_BASE } from "../../../shared/api/http";
import { isRootReconfiguringError } from "../../../entities/settings/apiErrorHelpers";
import {
  bindSseTransportError,
  connectSse,
  createSseGeneration,
  parseTypedSseMessage,
} from "../../../shared/api/sseTransport";
import { updateCachesAfterDlsiteBulkFetch } from "../../../entities/work/model/workCacheUpdates";
import {
  dlsiteBulkActionsAtom,
  dlsiteBulkApplyOpenAtom,
  dlsiteBulkStartingAtom,
  dlsiteBulkCancellingAtom,
  dlsiteBulkJobIdAtom,
  dlsiteBulkProgressAtom,
  type DlsiteBulkActions,
} from "../../../entities/dlsite/model/bulkAtoms";
import { formatDlsiteBulkResult } from "../model/formatDlsiteBulkResult";
import { useToast } from "../../../shared/ui/useToast";

export default function DlsiteBulkRuntime() {
  const queryClient = useQueryClient();
  const jobId = useAtomValue(dlsiteBulkJobIdAtom);
  const setJobId = useSetAtom(dlsiteBulkJobIdAtom);
  const setStarting = useSetAtom(dlsiteBulkStartingAtom);
  const setCancelling = useSetAtom(dlsiteBulkCancellingAtom);
  const setProgress = useSetAtom(dlsiteBulkProgressAtom);
  const setApplyOpen = useSetAtom(dlsiteBulkApplyOpenAtom);
  const setActions = useSetAtom(dlsiteBulkActionsAtom);
  const toast = useToast();

  const showComplete = useCallback(
    (result: DlsiteBulkResult) => {
      toast.show({
        message: `DLsite一括取得: ${formatDlsiteBulkResult(result)}`,
        variant: result.failed > 0 ? "warning" : "success",
        priority: "notice",
        actionLabel: "未設定項目を適用",
        onAction: () => setApplyOpen(true),
      });
    },
    [setApplyOpen, toast],
  );

  const showCancelled = useCallback(
    (result: DlsiteBulkResult) => {
      toast.show({
        message: `DLsite一括取得を中断しました（${formatDlsiteBulkResult(result)}）`,
        variant: "warning",
        priority: "notice",
      });
    },
    [toast],
  );

  const showTerminal = useCallback(
    (terminal: DlsiteBulkTerminal) => {
      if (terminal.status === "complete") showComplete(terminal.result);
      else if (terminal.status === "cancelled") showCancelled(terminal.result);
      else toast.error(terminal.message);
    },
    [showCancelled, showComplete, toast],
  );

  const resetTerminalState = useCallback(() => {
    setProgress(null);
    setCancelling(false);
  }, [setCancelling, setProgress]);

  const trackCurrent = useCallback(
    (current: NonNullable<DlsiteBulkSnapshot["current"]>) => {
      resetTerminalState();
      if (current.status === "cancelling") setCancelling(true);
      if (current.progress) setProgress(current.progress);
      setJobId(current.jobId);
    },
    [resetTerminalState, setCancelling, setJobId, setProgress],
  );

  const startingRef = useRef(false);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    resetTerminalState();
    try {
      setJobId(await startDlsiteBulk());
    } catch (cause) {
      setJobId(null);
      setCancelling(false);
      if (!isRootReconfiguringError(cause)) {
        toast.error(cause instanceof Error ? cause.message : "一括取得を開始できませんでした");
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [resetTerminalState, setCancelling, setJobId, setStarting, toast]);

  // 既に走っているかもしれないジョブへの後乗り専用。実行中ならそのジョブを追跡し、
  // 終端済みならその結果を反映する。ジョブが無ければ何もしない。
  const attach = useCallback(() => {
    void (async () => {
      let snapshot: DlsiteBulkSnapshot;
      try {
        snapshot = await getDlsiteBulkStatus();
      } catch {
        return;
      }
      if (snapshot.current) {
        trackCurrent(snapshot.current);
        return;
      }
      if (!snapshot.lastTerminal) return;
      resetTerminalState();
      showTerminal(snapshot.lastTerminal);
      void updateCachesAfterDlsiteBulkFetch(queryClient).catch(() => {});
    })();
  }, [queryClient, resetTerminalState, showTerminal, trackCurrent]);

  const cancel = useCallback(async () => {
    if (jobId === null) return;
    try {
      await cancelDlsiteBulk();
    } catch (cause) {
      if (!isRootReconfiguringError(cause)) {
        toast.error(cause instanceof Error ? cause.message : "一括取得の中止に失敗しました");
      }
    }
  }, [jobId, toast]);

  const actions = useMemo<DlsiteBulkActions>(
    () => ({ start, attach, cancel }),
    [attach, cancel, start],
  );

  useEffect(() => {
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);

  useEffect(() => {
    if (jobId === null) return;

    let disposed = false;
    let finished = false;
    const generation = createSseGeneration();
    const connection = connectSse(`${API_BASE}/dlsite/events`);
    const source = connection.source;

    const detach = (): void => {
      finished = true;
      if (disposed) return;
      setJobId(null);
      resetTerminalState();
      connection.close();
    };

    const fail = (message: string): void => {
      if (disposed || finished) return;
      toast.error(message);
      detach();
    };

    const updateCaches = (): void => {
      void updateCachesAfterDlsiteBulkFetch(queryClient).catch(() => {});
    };

    const applySnapshot = (snapshot: DlsiteBulkSnapshot): void => {
      const closed = source.readyState === EventSource.CLOSED;
      if (snapshot.lastTerminal?.jobId === jobId) {
        showTerminal(snapshot.lastTerminal);
        detach();
        updateCaches();
        return;
      }
      if (snapshot.current?.jobId === jobId) {
        if (closed) {
          fail("DLsite一括取得の接続が切断されました");
          return;
        }
        if (snapshot.current.status === "cancelling") setCancelling(true);
        if (snapshot.current.progress) setProgress(snapshot.current.progress);
        return;
      }
      updateCaches();
      if (closed) {
        fail("DLsite一括取得の接続が切断されました");
        return;
      }
      detach();
      if (snapshot.current) trackCurrent(snapshot.current);
    };

    const confirm = (): void => {
      if (disposed || finished) return;
      const pollGeneration = generation.bump();
      void getDlsiteBulkStatus()
        .then((snapshot) => {
          if (disposed || finished || !generation.isCurrent(pollGeneration)) return;
          applySnapshot(snapshot);
        })
        .catch((cause: unknown) => {
          if (disposed || finished || !generation.isCurrent(pollGeneration)) return;
          if (isRootReconfiguringError(cause)) {
            detach();
            return;
          }
          if (source.readyState === EventSource.CLOSED) {
            fail(
              cause instanceof Error ? cause.message : "DLsite一括取得の状態を取得できませんでした",
            );
          }
        });
    };

    const eventMessages = {
      parse: "DLsite進捗イベントの解析に失敗しました",
      schema: "DLsite進捗イベントの形式が不正です",
    } as const;

    const handleRawSseEvent = (raw: Event): void => {
      if (!(raw instanceof MessageEvent) || typeof raw.data !== "string") return;
      if (disposed || finished) return;
      generation.bump();
      const parsed = parseTypedSseMessage(raw.data, dlsiteBulkProgressEventSchema, eventMessages);
      if (!parsed.ok) {
        fail(parsed.message);
        return;
      }
      const event = parsed.event;
      if (event.jobId !== jobId) {
        confirm();
      } else if (event.type === "progress") {
        setProgress({ processed: event.processed, total: event.total, work: event.work });
      } else if (event.type === "cancelling") {
        setCancelling(true);
      } else {
        confirm();
      }
    };

    for (const type of ["progress", "cancelling", "complete", "cancelled"] as const) {
      source.addEventListener(type, handleRawSseEvent);
    }

    bindSseTransportError({
      source,
      onConnectionError: confirm,
      onNamedErrorEvent: handleRawSseEvent,
    });

    return () => {
      disposed = true;
      connection.close();
    };
  }, [
    jobId,
    queryClient,
    resetTerminalState,
    setCancelling,
    setJobId,
    setProgress,
    showTerminal,
    toast,
    trackCurrent,
  ]);

  return null;
}
