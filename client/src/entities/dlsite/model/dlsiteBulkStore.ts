import { atomWithLazy } from "jotai/utils";
import {
  dlsiteBulkProgressEventSchema,
  type DlsiteBulkProgressSnapshot,
  type DlsiteBulkSnapshot,
  type DlsiteBulkTerminal,
} from "@mimimilli/shared";
import { API_BASE } from "../../../shared/api/http";
import {
  bindSseTransportError,
  connectSse,
  createSseGeneration,
  parseTypedSseMessage,
  type SseConnection,
} from "../../../shared/api/sseTransport";
import {
  createEventEmitter,
  createExternalStore,
  type ReadableStore,
} from "../../../shared/lib/externalStore";
import { isRootReconfiguringError } from "../../settings/apiErrorHelpers";
import { cancelDlsiteBulk, getDlsiteBulkStatus, startDlsiteBulk } from "../../work/api";

export interface DlsiteBulkState {
  /** 追跡中の一括取得ジョブのID */
  jobId: string | null;
  /** POST /dlsite/bulk の応答待ち。追跡が始まる前の多重開始を防ぐ */
  starting: boolean;
  cancelling: boolean;
  progress: DlsiteBulkProgressSnapshot | null;
}

export type DlsiteBulkEvent =
  /** 追跡していたジョブが終端に達した（後乗りで終端済みの結果を見つけた場合を含む） */
  | { type: "terminal"; terminal: DlsiteBulkTerminal }
  /** 追跡していたジョブが終端を見せないまま別のジョブに置き換わった */
  | { type: "superseded" }
  | { type: "error"; message: string };

export interface DlsiteBulkDeps {
  startBulk: typeof startDlsiteBulk;
  getStatus: typeof getDlsiteBulkStatus;
  cancelBulk: typeof cancelDlsiteBulk;
  connect: (url: string) => SseConnection;
}

const DEFAULT_DEPS: DlsiteBulkDeps = {
  startBulk: () => startDlsiteBulk(),
  getStatus: () => getDlsiteBulkStatus(),
  cancelBulk: () => cancelDlsiteBulk(),
  connect: (url) => connectSse(url),
};

const EVENT_MESSAGES = {
  parse: "DLsite進捗イベントの解析に失敗しました",
  schema: "DLsite進捗イベントの形式が不正です",
} as const;

const IDLE: DlsiteBulkState = { jobId: null, starting: false, cancelling: false, progress: null };

interface TrackingSession {
  jobId: string;
  connection: SseConnection;
  disposed: boolean;
  finished: boolean;
}

export interface DlsiteBulkStore extends ReadableStore<DlsiteBulkState> {
  subscribeEvents(listener: (event: DlsiteBulkEvent) => void): () => void;
  start(): Promise<void>;
  cancel(): Promise<void>;
  /** サーバー上で実行中のジョブがあれば追跡し、終端済みならその結果を反映する。ジョブが無ければ何もしない */
  attach(): Promise<void>;
  /** 追跡中のジョブをローカルの状態からだけ切り離す。サーバー側のジョブには触れない */
  reset(): void;
}

export function createDlsiteBulkStore(
  deps: DlsiteBulkDeps = DEFAULT_DEPS,
  initial: DlsiteBulkState = IDLE,
): DlsiteBulkStore {
  const store = createExternalStore<DlsiteBulkState>(initial);
  const events = createEventEmitter<DlsiteBulkEvent>();
  let session: TrackingSession | null = null;
  const resetGeneration = createSseGeneration();

  const closeSession = (): void => {
    if (!session) return;
    session.disposed = true;
    session.connection.close();
    session = null;
  };

  const stopTracking = (): void => {
    closeSession();
    store.setState((state) => ({ ...state, jobId: null, cancelling: false, progress: null }));
  };

  const track = (current: NonNullable<DlsiteBulkSnapshot["current"]>): void => {
    store.setState((state) => ({
      ...state,
      jobId: current.jobId,
      cancelling: current.status === "cancelling",
      progress: current.progress ?? null,
    }));
    if (session?.jobId !== current.jobId) openSession(current.jobId);
  };

  const openSession = (jobId: string): void => {
    closeSession();
    const generation = createSseGeneration();
    const connection = deps.connect(`${API_BASE}/dlsite/events`);
    const source = connection.source;
    const own: TrackingSession = { jobId, connection, disposed: false, finished: false };
    session = own;

    const active = (): boolean => !own.disposed && !own.finished;

    const detach = (): void => {
      own.finished = true;
      if (own.disposed) return;
      stopTracking();
    };

    const fail = (message: string): void => {
      if (!active()) return;
      events.emit({ type: "error", message });
      detach();
    };

    const applySnapshot = (snapshot: DlsiteBulkSnapshot): void => {
      const closed = source.readyState === EventSource.CLOSED;
      if (snapshot.lastTerminal?.jobId === jobId) {
        detach();
        events.emit({ type: "terminal", terminal: snapshot.lastTerminal });
        return;
      }
      if (snapshot.current?.jobId === jobId) {
        if (closed) {
          fail("DLsite一括取得の接続が切断されました");
          return;
        }
        store.setState((state) => ({
          ...state,
          cancelling: snapshot.current?.status === "cancelling" ? true : state.cancelling,
          progress: snapshot.current?.progress ?? state.progress,
        }));
        return;
      }
      events.emit({ type: "superseded" });
      if (closed) {
        fail("DLsite一括取得の接続が切断されました");
        return;
      }
      detach();
      if (snapshot.current) track(snapshot.current);
    };

    const confirm = (): void => {
      if (!active()) return;
      const pollGeneration = generation.bump();
      void deps
        .getStatus()
        .then((snapshot) => {
          if (!active() || !generation.isCurrent(pollGeneration)) return;
          applySnapshot(snapshot);
        })
        .catch((cause: unknown) => {
          if (!active() || !generation.isCurrent(pollGeneration)) return;
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

    const handleRawSseEvent = (raw: Event): void => {
      if (!(raw instanceof MessageEvent) || typeof raw.data !== "string") return;
      if (!active()) return;
      generation.bump();
      const parsed = parseTypedSseMessage(raw.data, dlsiteBulkProgressEventSchema, EVENT_MESSAGES);
      if (!parsed.ok) {
        fail(parsed.message);
        return;
      }
      const event = parsed.event;
      if (event.jobId !== jobId) {
        confirm();
      } else if (event.type === "progress") {
        store.setState((state) => ({
          ...state,
          progress: { processed: event.processed, total: event.total, work: event.work },
        }));
      } else if (event.type === "cancelling") {
        store.setState((state) => ({ ...state, cancelling: true }));
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
  };

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    subscribeEvents: events.subscribe,

    async start() {
      if (store.getState().starting) return;
      store.setState((state) => ({ ...state, starting: true, cancelling: false, progress: null }));
      const token = resetGeneration.current();
      try {
        const jobId = await deps.startBulk();
        if (!resetGeneration.isCurrent(token)) return;
        store.setState((state) => ({ ...state, jobId }));
        if (session?.jobId !== jobId) openSession(jobId);
      } catch (cause) {
        stopTracking();
        if (!isRootReconfiguringError(cause)) {
          events.emit({
            type: "error",
            message: cause instanceof Error ? cause.message : "一括取得を開始できませんでした",
          });
        }
      } finally {
        store.setState((state) => ({ ...state, starting: false }));
      }
    },

    async cancel() {
      if (store.getState().jobId === null) return;
      try {
        await deps.cancelBulk();
      } catch (cause) {
        if (!isRootReconfiguringError(cause)) {
          events.emit({
            type: "error",
            message: cause instanceof Error ? cause.message : "一括取得の中止に失敗しました",
          });
        }
      }
    },

    async attach() {
      const token = resetGeneration.current();
      let snapshot: DlsiteBulkSnapshot;
      try {
        snapshot = await deps.getStatus();
      } catch {
        return;
      }
      if (!resetGeneration.isCurrent(token)) return;
      if (snapshot.current) {
        track(snapshot.current);
        return;
      }
      if (!snapshot.lastTerminal) return;
      store.setState((state) => ({ ...state, cancelling: false, progress: null }));
      events.emit({ type: "terminal", terminal: snapshot.lastTerminal });
    },

    reset() {
      resetGeneration.bump();
      closeSession();
      store.setState((state) => ({ ...state, jobId: null, cancelling: false, progress: null }));
    },
  };
}

/** Jotai の store ごとに1つ。React 外からは store.get(dlsiteBulkStoreAtom) で取る */
export const dlsiteBulkStoreAtom = atomWithLazy(() => createDlsiteBulkStore());
