import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DlsiteBulkResult } from "@mimimilli/shared";
import {
  dlsiteBulkProgressEventSchema,
  type DlsiteBulkProgressEvent,
  type DlsiteBulkSnapshot,
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
  dlsiteBulkActiveAtom,
  dlsiteBulkApplyOpenAtom,
  dlsiteBulkStartingAtom,
  dlsiteBulkCancellingAtom,
  dlsiteBulkProgressAtom,
  type DlsiteBulkActions,
} from "../../../entities/dlsite/model/bulkAtoms";
import { formatDlsiteBulkResult } from "../model/formatDlsiteBulkResult";
import { useToast } from "../../../shared/ui/useToast";

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

  const resetTerminalState = useCallback(() => {
    setProgress(null);
    setCancelling(false);
  }, [setCancelling, setProgress]);

  const startingRef = useRef(false);
  // start()自身がジョブを開始した直後にSSE購読するときだけ、進捗イベントを
  // 最初から取りこぼさず全て捕捉できると確信できる。attach()は既に走っている
  // かもしれないジョブへ後から繋ぐため、この確信が持てない
  // （完了時の詳細キャッシュを処理対象だけに絞れるかどうかに関わる）。
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
      if (!isRootReconfiguringError(cause)) {
        toast.error(cause instanceof Error ? cause.message : "一括取得を開始できませんでした");
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [resetTerminalState, setActive, setCancelling, setStarting, toast]);

  // 既に走っているかもしれないジョブへの後乗り専用。ジョブの実在を確認してから
  // activeにする。running/cancellingのときだけSSEを購読し、
  // 終端済みならその結果をそのまま反映、ジョブが無ければ何もしない。
  const attach = useCallback(() => {
    freshStartRef.current = false;
    void (async () => {
      let snapshot: DlsiteBulkSnapshot | null;
      try {
        snapshot = await getDlsiteBulkStatus();
      } catch {
        return;
      }
      if (!snapshot) return;
      if (snapshot.status === "running" || snapshot.status === "cancelling") {
        resetTerminalState();
        if (snapshot.status === "cancelling") setCancelling(true);
        if (snapshot.progress) setProgress(snapshot.progress);
        setActive(true);
        return;
      }
      const terminal = terminalFromSnapshot(snapshot);
      if (!terminal) return;
      resetTerminalState();
      if (terminal.type === "complete") showComplete(terminal.result);
      else if (terminal.type === "cancelled") showCancelled(terminal.result);
      else toast.error(terminal.message);
    })();
  }, [
    resetTerminalState,
    setActive,
    setCancelling,
    setProgress,
    showCancelled,
    showComplete,
    toast,
  ]);

  const cancel = useCallback(async () => {
    if (!active) return;
    try {
      await cancelDlsiteBulk();
    } catch (cause) {
      if (!isRootReconfiguringError(cause)) {
        toast.error(cause instanceof Error ? cause.message : "一括取得の中止に失敗しました");
      }
    }
  }, [active, toast]);

  const actions = useMemo<DlsiteBulkActions>(
    () => ({ start, attach, cancel }),
    [attach, cancel, start],
  );

  useEffect(() => {
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);

  useEffect(() => {
    if (!active) return;

    let disposed = false;
    let terminalHandled = false;
    const generation = createSseGeneration();
    const connection = connectSse(`${API_BASE}/dlsite/events`);
    const source = connection.source;
    // progressイベントが伝える処理中作品のIDを集め、完了時にskippedでない（実際に処理対象だった）
    // 作品の詳細キャッシュだけを選択的に無効化する。
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
      toast.error(message);
      detach();
    };

    const applyTerminal = (event: TerminalEvent): void => {
      if (disposed || terminalHandled) return;
      terminalHandled = true;
      if (event.type === "complete") {
        showComplete(event.result);
      } else if (event.type === "cancelled") {
        showCancelled(event.result);
      } else {
        toast.error(event.message);
      }
      detach();
      void updateCachesAfterDlsiteBulkFetch(queryClient, {
        processedWorkIds: [...updatedWorkIds],
        progressMayBeMissed: missedProgress,
      }).catch(() => {});
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
        setProgress({ processed: event.processed, total: event.total, work: event.work });
        if (event.work) updatedWorkIds.add(event.work.id);
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
          if (isRootReconfiguringError(cause)) {
            terminalHandled = true;
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
    queryClient,
    setActive,
    setCancelling,
    setProgress,
    showCancelled,
    showComplete,
    toast,
  ]);

  return null;
}
