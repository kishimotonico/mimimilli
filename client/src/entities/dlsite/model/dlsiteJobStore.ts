import { atomWithLazy } from "jotai/utils";
import {
  DLSITE_JOB_MAX_PRODUCT_CODES,
  dlsiteJobEventSchema,
  canonicalDlsiteProductCode,
  type DlsiteJobProgress,
  type DlsiteJobCode,
  type DlsiteJobCodeState,
  type DlsiteJobSnapshot,
  type DlsiteJobState as DlsiteServerState,
  type DlsiteTerminalProductSummary,
} from "@mimimilli/shared";
import {
  bindSseTransportError,
  bindTypedSseEvents,
  connectSse,
  type SseConnection,
} from "../../../shared/api/sseTransport";
import {
  createEventEmitter,
  createExternalStore,
  type ReadableStore,
} from "../../../shared/lib/externalStore";
import { formatUserError } from "../../../shared/lib/formatUserError";
import { isRootReconfiguringError } from "../../settings/apiErrorHelpers";
import {
  cancelDlsiteJob,
  DLSITE_JOB_EVENTS_URL,
  getCurrentDlsiteJob,
  startDlsiteJob,
} from "../api";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** ミラーしたコードの状態。revision はそのコードが最後に変化した時点のサーバーの revision */
export type DlsiteJobCodeView = DistributiveOmit<DlsiteJobCode, "productCode">;

export interface DlsiteJobView {
  jobId: string;
  status: "running" | "finished";
  /** 正規化したproduct code → 状態 */
  codes: ReadonlyMap<string, DlsiteJobCodeView>;
  progress: DlsiteJobProgress;
}

/** コードごとの最新の終端の結果。ジョブが入れ替わっても残す */
export interface DlsiteCodeResult {
  dlsite: DlsiteTerminalProductSummary;
  revision: number;
}

export interface DlsiteJobState {
  /** 取り込んだサーバー状態の revision。reset で 0 */
  revision: number;
  job: DlsiteJobView | null;
  results: ReadonlyMap<string, DlsiteCodeResult>;
  /** 開始（分割POSTを含む）の応答待ち。枠をすぐ進捗に切り替えるため件数を持つ */
  starting: { total: number } | null;
  cancelling: boolean;
  error: string | null;
}

/** 終端に達したコード。known が false は、ミラーが別のジョブに替わるまで終わりを見なかったコード（結果は不明） */
export interface DlsiteSettledCode {
  code: string;
  known: boolean;
}

export type DlsiteJobStoreEvent =
  | { type: "codesSettled"; codes: DlsiteSettledCode[] }
  /** ミラーのジョブが終わった、または消えた・別のジョブに替わった */
  | { type: "jobEnded"; jobId: string };

export type DlsiteJobActionResult = { ok: true } | { ok: false; error: string };

export interface DlsiteJobDeps {
  startJob: typeof startDlsiteJob;
  getCurrent: typeof getCurrentDlsiteJob;
  cancel: typeof cancelDlsiteJob;
  connect: (url: string) => SseConnection;
}

const DEFAULT_DEPS: DlsiteJobDeps = {
  startJob: (body) => startDlsiteJob(body),
  getCurrent: () => getCurrentDlsiteJob(),
  cancel: (jobId) => cancelDlsiteJob(jobId),
  connect: (url) => connectSse(url),
};

const EVENT_MESSAGES = {
  parse: "DLsite取得の進捗イベントの解析に失敗しました",
  schema: "DLsite取得の進捗イベントの形式が不正です",
} as const;

/** 何も受け取らないまま接続が閉じた状態が続いたとき、追跡を諦める回数 */
const MAX_EMPTY_REOPENS = 3;
const EVENT_SOURCE_CLOSED = 2;

export const INITIAL_DLSITE_JOB_STATE: DlsiteJobState = {
  revision: 0,
  job: null,
  results: new Map(),
  starting: null,
  cancelling: false,
  error: null,
};

export interface DlsiteJobStore extends ReadableStore<DlsiteJobState> {
  subscribeEvents(listener: (event: DlsiteJobStoreEvent) => void): () => void;
  start(productCodes: string[], force: boolean): Promise<DlsiteJobActionResult>;
  cancel(): Promise<DlsiteJobActionResult>;
  /** サーバーの現在の状態を取り込む。実行中のジョブがあれば追跡を始める */
  attach(): Promise<void>;
  clearError(): void;
  /** 接続を閉じてローカルの状態を空にする。サーバーのジョブには触れない */
  reset(): void;
}

function errorMessage(error: unknown): string {
  return formatUserError(error, "DLsiteの取得に失敗しました").message;
}

function isTerminalCodeState(state: DlsiteJobCodeState): boolean {
  return state === "fetched" || state === "not_found" || state === "failed";
}

function toView(snapshot: DlsiteJobSnapshot): DlsiteJobView {
  const codes = new Map<string, DlsiteJobCodeView>();
  for (const { productCode, ...view } of snapshot.codes) {
    codes.set(canonicalDlsiteProductCode(productCode), view as DlsiteJobCodeView);
  }
  return { jobId: snapshot.jobId, status: snapshot.status, codes, progress: snapshot.progress };
}

function toServerView(state: DlsiteServerState): { revision: number; job: DlsiteJobView | null } {
  return { revision: state.revision, job: state.job ? toView(state.job) : null };
}

/** 取り込む終端の結果。ジョブの外に持つので、ジョブが替わっても失われない */
function mergeResults(
  results: ReadonlyMap<string, DlsiteCodeResult>,
  job: DlsiteJobView | null,
): ReadonlyMap<string, DlsiteCodeResult> {
  if (!job) return results;
  let next: Map<string, DlsiteCodeResult> | null = null;
  for (const [code, entry] of job.codes) {
    if (!("dlsite" in entry)) continue;
    if (entry.revision <= (results.get(code)?.revision ?? -1)) continue;
    next ??= new Map(results);
    next.set(code, { dlsite: entry.dlsite, revision: entry.revision });
  }
  return next ?? results;
}

/** 前後のミラーの差から、終端に達したコードとジョブの終わりを導く。最初の取り込み（前のミラーが無い）は通知しない */
function transitionOf(
  prev: DlsiteJobView | null,
  next: DlsiteJobView | null,
): DlsiteJobStoreEvent[] {
  if (prev === null) return [];
  const sameJob = next !== null && prev.jobId === next.jobId;
  const reached: DlsiteSettledCode[] = [];
  if (next) {
    for (const [code, entry] of next.codes) {
      if (!isTerminalCodeState(entry.state)) continue;
      const before = sameJob ? prev.codes.get(code) : undefined;
      if (!before || before.revision < entry.revision) {
        reached.push({ code, known: true });
      }
    }
  }
  if (!sameJob) {
    for (const [code, entry] of prev.codes) {
      if (!isTerminalCodeState(entry.state)) {
        reached.push({ code, known: false });
      }
    }
  }
  const ended = new Set<string>();
  if (prev.status === "running" && !(sameJob && next.status === "running")) ended.add(prev.jobId);
  if (next?.status === "finished" && !(sameJob && prev.status === "finished"))
    ended.add(next.jobId);
  const result: DlsiteJobStoreEvent[] = [];
  if (reached.length > 0) result.push({ type: "codesSettled", codes: reached });
  for (const jobId of ended) result.push({ type: "jobEnded", jobId });
  return result;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * サーバーの現在のジョブを写すだけの追跡。自分が始めたジョブかどうかは区別しない。
 * サーバー状態は revision の大きい方だけを commit で取り込む。
 */
export function createDlsiteJobStore(deps: DlsiteJobDeps = DEFAULT_DEPS): DlsiteJobStore {
  const store = createExternalStore<DlsiteJobState>(INITIAL_DLSITE_JOB_STATE);
  const events = createEventEmitter<DlsiteJobStoreEvent>();
  /** resetでだけ進む。応答待ち中のresetを検知する。サーバーの revision では表せない、クライアントが状態を捨てた境界 */
  let epoch = 0;
  let connection: { sse: SseConnection; jobId: string } | null = null;
  let emptyReopens = 0;

  const patch = (partial: Partial<DlsiteJobState>): void => {
    store.setState((state) => ({ ...state, ...partial }));
  };

  const closeConnection = (): void => {
    connection?.sse.close();
    connection = null;
  };

  function open(jobId: string): void {
    closeConnection();
    const sse = deps.connect(DLSITE_JOB_EVENTS_URL);
    const local = { sse, jobId };
    connection = local;
    const owned = (): boolean => connection === local;

    bindTypedSseEvents({
      source: sse.source,
      eventNames: ["snapshot", "code", "removed", "finished"],
      schema: dlsiteJobEventSchema,
      messages: EVENT_MESSAGES,
      onValidationFailure: (message) => {
        if (owned()) abandon(message);
      },
      onValidatedEvent: (event) => {
        if (!owned()) return;
        if (event.type === "snapshot") {
          if (commit({ revision: event.revision, job: event.job ? toView(event.job) : null })) {
            emptyReopens = 0;
          }
          return;
        }
        const { job } = store.getState();
        if (!job || event.jobId !== job.jobId) {
          void reconcile(local);
          return;
        }
        if (event.type === "finished") {
          if (commit({ revision: event.revision, job: { ...job, status: "finished" } })) {
            emptyReopens = 0;
          }
          return;
        }
        const codes = new Map(job.codes);
        if (event.type === "code") {
          const { type: _type, jobId: _jobId, progress: _progress, productCode, ...view } = event;
          codes.set(canonicalDlsiteProductCode(productCode), view as DlsiteJobCodeView);
        } else {
          for (const code of event.productCodes) codes.delete(canonicalDlsiteProductCode(code));
        }
        if (
          commit({ revision: event.revision, job: { ...job, codes, progress: event.progress } })
        ) {
          emptyReopens = 0;
        }
      },
    });
    bindSseTransportError({
      source: sse.source,
      onConnectionError: () => void reconcile(local),
    });
  }

  /** 実行中のジョブがあれば接続し、なければ閉じる。接続の開閉はここだけで行う */
  function syncConnection(): void {
    const { job } = store.getState();
    if (job?.status === "running") {
      if (connection?.jobId !== job.jobId) open(job.jobId);
    } else closeConnection();
  }

  /** サーバー状態の取り込み口。POST の応答・照会・SSE のすべてがここを通る。revision が進まなければ捨てる */
  function commit(next: { revision: number; job: DlsiteJobView | null }): boolean {
    const state = store.getState();
    if (next.revision <= state.revision) return false;
    const transition = transitionOf(state.job, next.job);
    patch({
      revision: next.revision,
      job: next.job,
      results: mergeResults(state.results, next.job),
    });
    syncConnection();
    for (const event of transition) events.emit(event);
    return true;
  }

  /** 追跡を諦める。結果が分からないコードを通知し、ジョブを手放してエラーを立てる */
  function abandon(message: string): void {
    const { job } = store.getState();
    closeConnection();
    patch({ job: null, error: message });
    for (const event of transitionOf(job, null)) events.emit(event);
  }

  async function reconcile(local: { sse: SseConnection; jobId: string }): Promise<void> {
    const startEpoch = epoch;
    let current: DlsiteServerState;
    try {
      current = await deps.getCurrent();
    } catch (cause) {
      if (epoch !== startEpoch) return;
      if (isRootReconfiguringError(cause)) {
        reset();
        return;
      }
      if (connection === local) noteEmptyReopen(local);
      return;
    }
    if (epoch !== startEpoch) return;
    commit(toServerView(current));
    if (connection === local) noteEmptyReopen(local);
  }

  /** 何も受け取らないまま閉じた状態が続くなら諦め、そうでなければ張り直す */
  function noteEmptyReopen(local: { sse: SseConnection; jobId: string }): void {
    if (local.sse.source.readyState !== EVENT_SOURCE_CLOSED) return;
    emptyReopens += 1;
    if (emptyReopens >= MAX_EMPTY_REOPENS) {
      abandon("DLsite取得の進捗を受け取れなくなりました");
      return;
    }
    open(local.jobId);
  }

  function reset(): void {
    epoch += 1;
    closeConnection();
    emptyReopens = 0;
    store.setState(INITIAL_DLSITE_JOB_STATE);
  }

  const actionError = (cause: unknown): DlsiteJobActionResult => {
    if (isRootReconfiguringError(cause)) {
      reset();
      return { ok: true };
    }
    return { ok: false, error: errorMessage(cause) };
  };

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    subscribeEvents: events.subscribe,

    async attach() {
      const startEpoch = epoch;
      try {
        const current = await deps.getCurrent();
        if (epoch !== startEpoch) return;
        commit(toServerView(current));
      } catch (cause) {
        if (epoch === startEpoch && isRootReconfiguringError(cause)) reset();
      }
    },

    async start(productCodes, force) {
      if (store.getState().starting !== null) return { ok: true };
      const codes = [...new Set(productCodes.map(canonicalDlsiteProductCode))];
      if (codes.length === 0) return { ok: true };
      const startEpoch = epoch;
      patch({ starting: { total: codes.length } });
      try {
        for (const part of chunk(codes, DLSITE_JOB_MAX_PRODUCT_CODES)) {
          const response = await deps.startJob({ productCodes: part, force });
          if (epoch !== startEpoch) return { ok: true };
          commit(toServerView(response));
        }
      } catch (cause) {
        if (epoch !== startEpoch) return { ok: true };
        patch({ starting: null });
        return actionError(cause);
      }
      patch({ starting: null });
      return { ok: true };
    },

    async cancel() {
      const { job, cancelling } = store.getState();
      if (!job || job.status !== "running" || cancelling) return { ok: true };
      const hasQueued = [...job.codes.values()].some((entry) => entry.state === "queued");
      if (!hasQueued) return { ok: true };
      const startEpoch = epoch;
      patch({ cancelling: true });
      try {
        await deps.cancel(job.jobId);
        return { ok: true };
      } catch (cause) {
        if (epoch !== startEpoch) return { ok: true };
        return actionError(cause);
      } finally {
        if (epoch === startEpoch) patch({ cancelling: false });
      }
    },

    clearError: () => patch({ error: null }),
    reset,
  };
}

/** Jotai の store ごとに1つ。React 外からは store.get(dlsiteJobStoreAtom) で取る */
export const dlsiteJobStoreAtom = atomWithLazy(() => createDlsiteJobStore());
