import { atomWithLazy } from "jotai/utils";
import { scanJobEventSchema, type ScanJobSnapshot, type StartScanRequest } from "@mimimilli/shared";
import { API_BASE, ApiRequestError, ApiResponseSchemaError } from "../../../shared/api/http";
import {
  bindSseTransportError,
  bindTypedSseEvents,
  connectSse,
  createSseGeneration,
  type SseConnection,
} from "../../../shared/api/sseTransport";
import {
  createEventEmitter,
  createExternalStore,
  type ReadableStore,
} from "../../../shared/lib/externalStore";
import { formatUserError } from "../../../shared/lib/formatUserError";
import { isRootReconfiguringError } from "../../settings/apiErrorHelpers";
import { cancelScan, getActiveScan, getScanJob, ScanAlreadyActiveError, startScan } from "../api";
import { isTerminalScanJob } from "./scanJob";

export interface ScanJobState {
  job: ScanJobSnapshot | null;
  error: string | null;
}

export type ScanJobEvent =
  /** 新規ジョブの起動に成功したとき。既存ジョブへの再接続では出ない */
  { type: "started"; job: ScanJobSnapshot } | { type: "terminal"; job: ScanJobSnapshot };

export type ScanActionResult =
  | { ok: true; job: ScanJobSnapshot | null }
  | { ok: false; error: string };

export interface ScanJobDeps {
  startScan: typeof startScan;
  getActiveScan: typeof getActiveScan;
  getScanJob: typeof getScanJob;
  cancelScan: typeof cancelScan;
  connect: (url: string) => SseConnection;
}

const DEFAULT_DEPS: ScanJobDeps = {
  startScan: (options) => startScan(options),
  getActiveScan: () => getActiveScan(),
  getScanJob: (id) => getScanJob(id),
  cancelScan: (id) => cancelScan(id),
  connect: (url) => connectSse(url),
};

const EVENT_MESSAGES = {
  parse: "スキャン進捗イベントの解析に失敗しました",
  schema: "スキャン進捗イベントの形式が不正です",
} as const;

function errorMessage(error: unknown): string {
  return formatUserError(error, "スキャン状態の取得に失敗しました").message;
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

export interface ScanJobStore extends ReadableStore<ScanJobState> {
  subscribeEvents(listener: (event: ScanJobEvent) => void): () => void;
  start(options?: StartScanRequest): Promise<ScanActionResult>;
  cancel(): Promise<ScanActionResult>;
  /** サーバー上で実行中のジョブがあれば、その追跡を始める。追跡中のジョブがあれば何もしない */
  attach(): Promise<void>;
  clearError(): void;
  /** 追跡中のジョブをローカルの状態からだけ切り離す。サーバー側のジョブには触れない */
  reset(): void;
}

/** サーバーのjob snapshotを唯一の状態源とする。リロード後もactive discoveryから同じjobへ再接続する。 */
export function createScanJobStore(
  deps: ScanJobDeps = DEFAULT_DEPS,
  initial: ScanJobState = { job: null, error: null },
): ScanJobStore {
  const store = createExternalStore<ScanJobState>(initial);
  const events = createEventEmitter<ScanJobEvent>();
  const generation = createSseGeneration();
  const terminalHandled = new Set<string>();
  let connection: SseConnection | null = null;
  let attachedJobId: string | null = null;

  const closeConnection = (): void => {
    connection?.close();
    connection = null;
  };

  const setError = (error: string | null): void => {
    store.setState((state) => ({ ...state, error }));
  };

  const owns = (token: number, jobId: string): boolean =>
    generation.isCurrent(token) && attachedJobId === jobId;

  const resetTracking = (): void => {
    generation.bump();
    attachedJobId = null;
    closeConnection();
  };

  const reset = (): void => {
    resetTracking();
    store.setState({ job: null, error: null });
  };

  const applyOwned = (
    token: number,
    jobId: string,
    localConnection: SseConnection | null,
    next: ScanJobSnapshot,
    previous: ScanJobSnapshot | null = store.getState().job,
  ): void => {
    if (!owns(token, jobId)) return;
    if (
      previous?.id === next.id &&
      (isTerminalScanJob(previous) || statusRank(next.status) < statusRank(previous.status))
    ) {
      return;
    }
    store.setState({
      job: next,
      error: next.status === "failed" ? (next.error ?? "スキャンに失敗しました") : null,
    });
    if (isTerminalScanJob(next) && !terminalHandled.has(next.id)) {
      terminalHandled.add(next.id);
      if (localConnection !== null && connection === localConnection) closeConnection();
      events.emit({ type: "terminal", job: next });
    }
  };

  const detachWithError = (
    token: number,
    jobId: string,
    localConnection: SseConnection,
    cause: unknown,
  ): void => {
    if (!owns(token, jobId)) return;
    if (connection === localConnection) closeConnection();
    attachedJobId = null;
    generation.bump();
    store.setState({ job: null, error: errorMessage(cause) });
  };

  const follow = (initialJob: ScanJobSnapshot): void => {
    closeConnection();
    const token = generation.bump();
    const jobId = initialJob.id;
    attachedJobId = jobId;
    applyOwned(token, jobId, null, initialJob, null);
    if (isTerminalScanJob(initialJob)) return;

    const local = deps.connect(`${API_BASE}/scan/${encodeURIComponent(jobId)}/events`);
    connection = local;

    const refresh = (): void => {
      if (!owns(token, jobId)) return;
      void deps
        .getScanJob(jobId)
        .then((next) => applyOwned(token, jobId, local, next))
        .catch((cause: unknown) => {
          if (!owns(token, jobId)) return;
          // root再設定中は/scan系APIが409で拒否される。追跡中のジョブは再設定側で
          // 取り消し済みなので、終端イベントを待たずここで追跡終了とする。
          if (isRootReconfiguringError(cause)) {
            reset();
            return;
          }
          if (isDefinitiveRefreshError(cause)) detachWithError(token, jobId, local, cause);
        });
    };

    bindTypedSseEvents({
      source: local.source,
      eventNames: ["state", "progress", "completed", "failed", "cancelled"],
      schema: scanJobEventSchema,
      messages: EVENT_MESSAGES,
      onValidationFailure: (message) => detachWithError(token, jobId, local, new Error(message)),
      onValidatedEvent: (event) => {
        if (!owns(token, jobId)) return;
        if (event.type === "state") {
          applyOwned(token, jobId, local, event.snapshot);
        } else if (event.type === "progress") {
          const { job } = store.getState();
          if (job?.id !== jobId) return;
          store.setState((state) => ({
            ...state,
            job: {
              ...job,
              status: job.status === "queued" ? "running" : job.status,
              progress: event.progress,
            },
          }));
        } else {
          refresh();
        }
      },
    });

    bindSseTransportError({ source: local.source, onConnectionError: refresh });
  };

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    subscribeEvents: events.subscribe,

    async attach() {
      const discoveryToken = generation.current();
      try {
        const active = await deps.getActiveScan();
        if (active && generation.isCurrent(discoveryToken) && attachedJobId === null)
          follow(active);
      } catch (cause) {
        if (
          generation.isCurrent(discoveryToken) &&
          attachedJobId === null &&
          !isRootReconfiguringError(cause)
        ) {
          setError(errorMessage(cause));
        }
      }
    },

    async start(options) {
      setError(null);
      try {
        const next = await deps.startScan(options);
        events.emit({ type: "started", job: next });
        follow(next);
        return { ok: true, job: next };
      } catch (cause) {
        if (cause instanceof ScanAlreadyActiveError) {
          follow(cause.active);
          return { ok: true, job: cause.active };
        }
        const message = errorMessage(cause);
        if (!isRootReconfiguringError(cause)) setError(message);
        return { ok: false, error: message };
      }
    },

    async cancel() {
      const { job } = store.getState();
      if (!job) return { ok: true, job: null };
      const token = generation.current();
      const jobId = job.id;
      const localConnection = connection;
      setError(null);
      try {
        const next = await deps.cancelScan(jobId);
        applyOwned(token, jobId, localConnection, next);
        return { ok: true, job: next };
      } catch (cause) {
        const message = errorMessage(cause);
        if (owns(token, jobId) && !isRootReconfiguringError(cause)) setError(message);
        return { ok: false, error: message };
      }
    },

    clearError: () => setError(null),
    reset,
  };
}

/** Jotai の store ごとに1つ。React 外からは store.get(scanJobStoreAtom) で取る */
export const scanJobStoreAtom = atomWithLazy(() => createScanJobStore());

export function isScanning(state: ScanJobState): boolean {
  return state.job !== null && !isTerminalScanJob(state.job);
}
