// DLsite一括取得ジョブ（POST /dlsite/bulk）の進捗をSSE購読するApp共有フック（TASK-41）。
// 設定モーダルの「未連携をまとめて取得」ボタンとTopBarの一括取得ボタンが同じジョブ状態を
// 見られるよう、App.tsxで単一インスタンスを保持し両者へpropsとして配る（scanProgressと同じ設計）。
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dlsiteBulkProgressEventSchema } from "@mimimilli/shared";
import type { DlsiteBulkResult } from "@mimimilli/shared";
import { cancelDlsiteBulk, startDlsiteBulk } from "../../entities/work/api";
import { API_BASE } from "../../shared/api/http";
import { getDlsiteInvalidationKeys } from "../../features/library/model/dlsiteInvalidation";

export function useDlsiteBulk() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [result, setResult] = useState<DlsiteBulkResult | null>(null);
  const [cancelledResult, setCancelledResult] = useState<DlsiteBulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const source = new EventSource(`${API_BASE}/dlsite/events`);
    const invalidate = () => {
      void Promise.all(
        getDlsiteInvalidationKeys().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    };
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
      } else if (parsed.data.type === "complete") {
        setResult(parsed.data.result);
        setActive(false);
        setCancelling(false);
        source.close();
        invalidate();
      } else if (parsed.data.type === "cancelled") {
        setCancelledResult(parsed.data.result);
        setActive(false);
        setCancelling(false);
        source.close();
        invalidate();
      } else {
        setError(parsed.data.message);
        setActive(false);
        setCancelling(false);
        source.close();
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
  }, [active, queryClient]);

  const start = async () => {
    setResult(null);
    setCancelledResult(null);
    setError(null);
    setProgress(null);
    setCancelling(false);
    setActive(true);
    try {
      await startDlsiteBulk();
    } catch (cause) {
      setActive(false);
      setCancelling(false);
      setError(cause instanceof Error ? cause.message : "一括取得を開始できませんでした");
    }
  };

  /** スキャン完了後にサーバー側が自動で起動したジョブ（mode: "new"）を観測するだけの入口。
   *  POST /dlsite/bulk は呼ばず、既に動いているジョブのSSE進捗へ相乗りする。 */
  const attach = () => {
    setResult(null);
    setCancelledResult(null);
    setError(null);
    setProgress(null);
    setCancelling(false);
    setActive(true);
  };

  const cancel = useCallback(async () => {
    if (!active) return;
    setError(null);
    try {
      await cancelDlsiteBulk();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "一括取得の中止に失敗しました");
      throw cause;
    }
  }, [active]);

  return {
    active,
    cancelling,
    progress,
    result,
    cancelledResult,
    error,
    start,
    attach,
    cancel,
    dismiss: () => {
      setResult(null);
      setCancelledResult(null);
      setError(null);
    },
  };
}
