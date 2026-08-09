import { useCallback, useEffect, useRef, useState } from "react";
import { scanJobEventSchema, type ScanJobSnapshot, type StartScanRequest } from "@mimimilli/shared";
import { API_BASE, ApiRequestError, ApiResponseSchemaError } from "../../../shared/api/http";
import {
  bindSseTransportError,
  bindTypedSseEvents,
  connectSse,
} from "../../../shared/api/sseTransport";
import { cancelScan, getActiveScan, getScanJob, ScanAlreadyActiveError, startScan } from "../api";
import type { ScanActionResult } from "../../../entities/scan/model/atoms";
import { isTerminalScanJob } from "../../../entities/scan/model/scanJob";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "スキャン状態の取得に失敗しました";
}

function isDefinitiveRefreshError(error: unknown): boolean {
  return (
    error instanceof ApiResponseSchemaError ||
    (error instanceof ApiRequestError && (error.status === 404 || error.status === 410))
  );
}

function statusRank(status: ScanJobSnapshot["status"]): number {
  if (status === "queued") return 0;
  if (status === "running") return 1;
  if (status === "cancelling") return 2;
  return 3;
}

export interface UseScanJobOptions {
  onTerminal?: (job: ScanJobSnapshot) => void;
}

/** サーバーのjob snapshotを唯一の状態源とする。リロード後もactive discoveryから同じjobへ再接続する。 */
export function useScanJob(options: UseScanJobOptions = {}) {
  const [job, setJob] = useState<ScanJobSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const attachedJobIdRef = useRef<string | null>(null);
  const snapshotRef = useRef<ScanJobSnapshot | null>(null);
  const generationRef = useRef(0);
  const terminalHandled = useRef(new Set<string>());
  const onTerminalRef = useRef(options.onTerminal);
  onTerminalRef.current = options.onTerminal;

  const owns = useCallback(
    (generation: number, jobId: string): boolean =>
      generationRef.current === generation && attachedJobIdRef.current === jobId,
    [],
  );

  const applyOwned = useCallback(
    (
      generation: number,
      jobId: string,
      localSource: EventSource | null,
      next: ScanJobSnapshot,
    ): void => {
      if (!owns(generation, jobId)) return;
      const previous = snapshotRef.current;
      if (
        previous?.id === next.id &&
        (isTerminalScanJob(previous) || statusRank(next.status) < statusRank(previous.status))
      ) {
        return;
      }
      snapshotRef.current = next;
      setJob(next);
      setError(next.status === "failed" ? (next.error ?? "スキャンに失敗しました") : null);
      if (isTerminalScanJob(next) && !terminalHandled.current.has(next.id)) {
        terminalHandled.current.add(next.id);
        if (localSource !== null && sourceRef.current === localSource) {
          localSource.close();
          sourceRef.current = null;
        }
        onTerminalRef.current?.(next);
      }
    },
    [owns],
  );

  const detachWithError = useCallback(
    (generation: number, jobId: string, localSource: EventSource, cause: unknown): void => {
      if (!owns(generation, jobId)) return;
      if (sourceRef.current === localSource) {
        localSource.close();
        sourceRef.current = null;
      }
      attachedJobIdRef.current = null;
      snapshotRef.current = null;
      generationRef.current += 1;
      setJob(null);
      setError(errorMessage(cause));
    },
    [owns],
  );

  const attach = useCallback(
    (initial: ScanJobSnapshot): void => {
      sourceRef.current?.close();
      sourceRef.current = null;
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      attachedJobIdRef.current = initial.id;
      snapshotRef.current = null;
      setError(null);
      applyOwned(generation, initial.id, null, initial);
      if (isTerminalScanJob(initial)) return;

      const connection = connectSse(`${API_BASE}/scan/${encodeURIComponent(initial.id)}/events`);
      const source = connection.source;
      sourceRef.current = source;
      const fail = (message: string): void => {
        detachWithError(generation, initial.id, source, new Error(message));
      };

      const refresh = (): void => {
        if (!owns(generation, initial.id)) return;
        void getScanJob(initial.id)
          .then((next) => applyOwned(generation, initial.id, source, next))
          .catch((cause: unknown) => {
            if (!owns(generation, initial.id)) return;
            if (isDefinitiveRefreshError(cause)) {
              detachWithError(generation, initial.id, source, cause);
            }
          });
      };

      const eventMessages = {
        parse: "スキャン進捗イベントの解析に失敗しました",
        schema: "スキャン進捗イベントの形式が不正です",
      } as const;

      bindTypedSseEvents({
        source,
        eventNames: ["reset", "state", "progress", "completed", "failed", "cancelled"],
        schema: scanJobEventSchema,
        messages: eventMessages,
        onValidationFailure: fail,
        onValidatedEvent: (event) => {
          if (!owns(generation, initial.id)) return;
          if (event.type === "reset" || event.type === "state") {
            applyOwned(generation, initial.id, source, event.snapshot);
          } else if (event.type === "progress") {
            const currentSnapshot = snapshotRef.current;
            if (currentSnapshot?.id === initial.id && currentSnapshot.status === "queued") {
              snapshotRef.current = {
                ...currentSnapshot,
                status: "running",
                progress: event.progress,
              };
            } else if (currentSnapshot?.id === initial.id) {
              snapshotRef.current = { ...currentSnapshot, progress: event.progress };
            }
            setJob((current) =>
              owns(generation, initial.id) && current?.id === initial.id
                ? {
                    ...current,
                    status: current.status === "queued" ? "running" : current.status,
                    progress: event.progress,
                  }
                : current,
            );
          } else {
            refresh();
          }
        },
      });

      bindSseTransportError({
        source,
        onConnectionError: refresh,
      });
    },
    [applyOwned, detachWithError, owns],
  );

  useEffect(() => {
    const discoveryGeneration = generationRef.current;
    void getActiveScan()
      .then((active) => {
        if (
          active &&
          generationRef.current === discoveryGeneration &&
          attachedJobIdRef.current === null
        ) {
          attach(active);
        }
      })
      .catch((cause: unknown) => {
        if (generationRef.current === discoveryGeneration && attachedJobIdRef.current === null) {
          setError(errorMessage(cause));
        }
      });
    return () => {
      generationRef.current += 1;
      attachedJobIdRef.current = null;
      snapshotRef.current = null;
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [attach]);

  const start = useCallback(
    async (options?: StartScanRequest): Promise<ScanActionResult> => {
      setError(null);
      try {
        const next = await startScan(options);
        attach(next);
        return { ok: true, job: next };
      } catch (cause) {
        if (cause instanceof ScanAlreadyActiveError) {
          attach(cause.active);
          return { ok: true, job: cause.active };
        }
        const message = errorMessage(cause);
        setError(message);
        return { ok: false, error: message };
      }
    },
    [attach],
  );

  const cancel = useCallback(async (): Promise<ScanActionResult> => {
    if (!job) return { ok: true, job: null };
    const generation = generationRef.current;
    const jobId = job.id;
    const localSource = sourceRef.current;
    setError(null);
    try {
      const next = await cancelScan(jobId);
      applyOwned(generation, jobId, localSource, next);
      return { ok: true, job: next };
    } catch (cause) {
      const message = errorMessage(cause);
      if (owns(generation, jobId)) setError(message);
      return { ok: false, error: message };
    }
  }, [applyOwned, job, owns]);

  const clearError = useCallback(() => setError(null), []);
  return {
    job,
    error,
    scanning: job !== null && !isTerminalScanJob(job),
    start,
    cancel,
    attach,
    clearError,
  };
}
