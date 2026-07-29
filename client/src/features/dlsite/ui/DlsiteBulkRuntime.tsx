import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import { dlsiteBulkProgressEventSchema } from "@mimimilli/shared";
import { cancelDlsiteBulk, startDlsiteBulk } from "../../../entities/work/api";
import { API_BASE } from "../../../shared/api/http";
import { getDlsiteInvalidationKeys } from "../../library/model/dlsiteInvalidation";
import {
  dlsiteBulkActionsAtom,
  dlsiteBulkActiveAtom,
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkCancellingAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkProgressAtom,
  dlsiteBulkResultAtom,
  type DlsiteBulkActions,
} from "../model/atoms";

export default function DlsiteBulkRuntime() {
  const queryClient = useQueryClient();
  const active = useAtomValue(dlsiteBulkActiveAtom);
  const setActive = useSetAtom(dlsiteBulkActiveAtom);
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

  const start = useCallback(async () => {
    resetTerminalState();
    setActive(true);
    try {
      await startDlsiteBulk();
    } catch (cause) {
      setActive(false);
      setCancelling(false);
      setError(cause instanceof Error ? cause.message : "一括取得を開始できませんでした");
    }
  }, [resetTerminalState, setActive, setCancelling, setError]);

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

    let terminalHandled = false;
    const source = new EventSource(`${API_BASE}/dlsite/events`);

    const handle = (event: MessageEvent<string>) => {
      let json: unknown;
      try {
        json = JSON.parse(event.data);
      } catch (cause) {
        console.error("DLsite進捗イベントのJSON解析に失敗しました", cause);
        return;
      }
      const parsed = dlsiteBulkProgressEventSchema.safeParse(json);
      if (!parsed.success) return;
      if (parsed.data.type === "progress") {
        setProgress({ processed: parsed.data.processed, total: parsed.data.total });
      } else if (parsed.data.type === "cancelling") {
        setCancelling(true);
      } else {
        if (terminalHandled) return;
        terminalHandled = true;
        if (parsed.data.type === "complete") {
          setResult(parsed.data.result);
        } else if (parsed.data.type === "cancelled") {
          setCancelledResult(parsed.data.result);
        } else {
          setError(parsed.data.message);
        }
        setActive(false);
        setCancelling(false);
        source.close();
        invalidateDlsiteQueries();
      }
    };

    source.addEventListener("progress", handle as EventListener);
    source.addEventListener("cancelling", handle as EventListener);
    source.addEventListener("complete", handle as EventListener);
    source.addEventListener("cancelled", handle as EventListener);
    source.addEventListener("error", (event) => {
      if (event instanceof MessageEvent) handle(event);
    });

    return () => source.close();
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
