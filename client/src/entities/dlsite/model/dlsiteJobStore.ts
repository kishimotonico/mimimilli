import { atomWithLazy } from "jotai/utils";
import {
  DLSITE_JOB_MAX_PRODUCT_CODES,
  dlsiteJobEventSchema,
  canonicalDlsiteProductCode,
  type DlsiteJobBulkProgress,
  type DlsiteJobCodeState,
  type DlsiteJobOrigin,
  type DlsiteJobSnapshot,
} from "@mimimilli/shared";
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
import {
  cancelDlsiteJobBulk,
  DLSITE_JOB_EVENTS_URL,
  getCurrentDlsiteJob,
  startDlsiteJob,
} from "../api";

export interface DlsiteJobCodeView {
  origin: DlsiteJobOrigin;
  state: DlsiteJobCodeState;
}

export interface DlsiteJobView {
  jobId: string;
  status: "running" | "finished";
  /** 正規化したproduct code → 起点と状態 */
  codes: ReadonlyMap<string, DlsiteJobCodeView>;
  bulk: DlsiteJobBulkProgress;
}

export interface DlsiteJobState {
  job: DlsiteJobView | null;
  /** まとめての開始（分割POSTを含む）の応答待ち。枠をすぐ進捗に切り替えるため件数を持つ */
  startingBulk: { total: number } | null;
  /** 単発の開始の応答待ち、または応答後にまだそのコードの状態を受け取っていないコード */
  pendingSingles: ReadonlySet<string>;
  cancelling: boolean;
  /** 終端後の候補一覧の再取得が済んだか。済むまでは終端状態を行に重ねる */
  settled: boolean;
  error: string | null;
}

export type DlsiteJobStoreEvent =
  /** コードが終端状態になった（行の情報を候補一覧から取り直す契機。Runtimeが間引く） */
  | { type: "codesTerminal"; jobId: string; origin: DlsiteJobOrigin; productCodes: string[] }
  /** 追跡中のジョブが終わった。終わりの通知を受け取れずに知ったとき（切断中に終わった・入れ替わった）は、
   *  どのコードの結果が出たか分からないので affected を unknown にする */
  | { type: "finished"; jobId: string; affected: DlsiteJobAffected };

/** ジョブの終わりで結果が変わりうるコード */
export type DlsiteJobAffected = { kind: "codes"; productCodes: string[] } | { kind: "unknown" };

export type DlsiteJobActionResult = { ok: true } | { ok: false; error: string };

export interface DlsiteJobDeps {
  startJob: typeof startDlsiteJob;
  getCurrent: typeof getCurrentDlsiteJob;
  cancelBulk: typeof cancelDlsiteJobBulk;
  connect: (url: string) => SseConnection;
}

const DEFAULT_DEPS: DlsiteJobDeps = {
  startJob: (body) => startDlsiteJob(body),
  getCurrent: () => getCurrentDlsiteJob(),
  cancelBulk: (jobId) => cancelDlsiteJobBulk(jobId),
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
  job: null,
  startingBulk: null,
  pendingSingles: new Set(),
  cancelling: false,
  settled: true,
  error: null,
};

export interface DlsiteJobStore extends ReadableStore<DlsiteJobState> {
  subscribeEvents(listener: (event: DlsiteJobStoreEvent) => void): () => void;
  startBulk(productCodes: string[]): Promise<DlsiteJobActionResult>;
  startSingle(productCode: string): Promise<DlsiteJobActionResult>;
  cancelBulk(): Promise<DlsiteJobActionResult>;
  /** サーバーで実行中のジョブがあれば追跡を始める。追跡中なら何もしない */
  attach(): Promise<void>;
  /** Runtimeが終端後の再取得を終えたら呼ぶ。jobIdが今の追跡と違えば無視 */
  markSettled(jobId: string): void;
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
  for (const code of snapshot.codes) {
    codes.set(canonicalDlsiteProductCode(code.productCode), {
      origin: code.origin,
      state: code.state,
    });
  }
  return { jobId: snapshot.jobId, status: snapshot.status, codes, bulk: snapshot.bulk };
}

function terminalCodesOf(job: DlsiteJobView): string[] {
  const codes: string[] = [];
  for (const [code, entry] of job.codes) if (isTerminalCodeState(entry.state)) codes.push(code);
  return codes;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** サーバーの現在のジョブを写すだけの追跡。自分が始めたジョブかどうかは区別しない。 */
export function createDlsiteJobStore(deps: DlsiteJobDeps = DEFAULT_DEPS): DlsiteJobStore {
  const store = createExternalStore<DlsiteJobState>(INITIAL_DLSITE_JOB_STATE);
  const events = createEventEmitter<DlsiteJobStoreEvent>();
  const generation = createSseGeneration();
  const terminalHandled = new Set<string>();
  /** resetでだけ進む。応答待ち中のresetを検知する */
  let epoch = 0;
  let connection: SseConnection | null = null;
  let trackedJobId: string | null = null;
  let receivedForTracked = false;
  /** 最後にSSEのイベントを受信した時点の clock */
  let lastSseAt = 0;
  /** 状態の受信・照会の発行・単発の開始に付ける通し番号 */
  let clock = 0;
  /** コードごとに、今のジョブで最後に受け取った状態が反映している時点（SSEは受信時、照会は発行時）。ジョブが変わると消す */
  const codeSeenAt = new Map<string, number>();
  let emptyReopens = 0;
  let bulkPosting = false;
  const inflightSingles = new Set<string>();

  const patch = (partial: Partial<DlsiteJobState>): void => {
    store.setState((state) => ({ ...state, ...partial }));
  };

  const closeConnection = (): void => {
    connection?.close();
    connection = null;
  };

  const clearStartingBulk = (): void => {
    if (!bulkPosting && store.getState().startingBulk !== null) patch({ startingBulk: null });
  };

  const releasePendingSingles = (codes: Iterable<string>): void => {
    const { pendingSingles } = store.getState();
    let next: Set<string> | null = null;
    for (const code of codes) {
      if (pendingSingles.has(code) && !inflightSingles.has(code)) {
        next ??= new Set(pendingSingles);
        next.delete(code);
      }
    }
    if (next) patch({ pendingSingles: next });
  };

  const applySnapshot = (snapshot: DlsiteJobSnapshot, stamp: number): void => {
    const view = toView(snapshot);
    for (const code of view.codes.keys()) codeSeenAt.set(code, stamp);
    receivedForTracked = true;
    patch({ job: view, settled: view.status === "finished" ? store.getState().settled : false });
    releasePendingSingles(view.codes.keys());
    clearStartingBulk();
  };

  const terminate = (jobId: string, lost: boolean): void => {
    if (terminalHandled.has(jobId)) return;
    terminalHandled.add(jobId);
    const { job, pendingSingles } = store.getState();
    const view = job?.jobId === jobId ? job : null;
    const productCodes = view ? terminalCodesOf(view) : [];
    if (trackedJobId === jobId) {
      closeConnection();
      generation.bump();
      trackedJobId = null;
    }
    patch({
      job: view ? { ...view, status: "finished" } : job,
      settled: false,
      pendingSingles: new Set([...pendingSingles].filter((code) => inflightSingles.has(code))),
    });
    clearStartingBulk();
    events.emit({
      type: "finished",
      jobId,
      affected: lost ? { kind: "unknown" } : { kind: "codes", productCodes },
    });
  };

  const failTracking = (jobId: string, message: string): void => {
    terminate(jobId, true);
    patch({ job: null, error: message });
  };

  const reset = (): void => {
    epoch += 1;
    generation.bump();
    closeConnection();
    trackedJobId = null;
    receivedForTracked = false;
    emptyReopens = 0;
    bulkPosting = false;
    inflightSingles.clear();
    codeSeenAt.clear();
    terminalHandled.clear();
    store.setState(INITIAL_DLSITE_JOB_STATE);
  };

  const open = (jobId: string): void => {
    closeConnection();
    const token = generation.bump();
    const local = deps.connect(DLSITE_JOB_EVENTS_URL);
    connection = local;
    receivedForTracked = false;
    const owned = (): boolean => generation.isCurrent(token) && trackedJobId === jobId;

    bindTypedSseEvents({
      source: local.source,
      eventNames: ["snapshot", "code", "removed", "finished"],
      schema: dlsiteJobEventSchema,
      messages: EVENT_MESSAGES,
      onValidationFailure: (message) => {
        if (owned()) failTracking(jobId, message);
      },
      onValidatedEvent: (event) => {
        if (!owned()) return;
        clock += 1;
        lastSseAt = clock;
        if (event.type === "snapshot") {
          handleSnapshot(jobId, event.job, clock);
          return;
        }
        if (event.jobId !== jobId) {
          void reconcile(token, jobId);
          return;
        }
        if (event.type === "finished") {
          terminate(jobId, false);
          return;
        }
        const state = store.getState();
        const job = state.job?.jobId === jobId ? state.job : null;
        if (!job) return;
        receivedForTracked = true;
        emptyReopens = 0;
        const codes = new Map(job.codes);
        if (event.type === "code") {
          const productCode = canonicalDlsiteProductCode(event.productCode);
          codes.set(productCode, { origin: event.origin, state: event.state });
          codeSeenAt.set(productCode, clock);
          patch({ job: { ...job, codes, bulk: event.bulk } });
          releasePendingSingles([productCode]);
          clearStartingBulk();
          if (isTerminalCodeState(event.state)) {
            events.emit({
              type: "codesTerminal",
              jobId,
              origin: event.origin,
              productCodes: [productCode],
            });
          }
        } else {
          for (const code of event.productCodes) codes.delete(canonicalDlsiteProductCode(code));
          patch({ job: { ...job, codes, bulk: event.bulk } });
          clearStartingBulk();
        }
      },
    });
    bindSseTransportError({
      source: local.source,
      onConnectionError: () => void reconcile(token, jobId),
    });
  };

  function handleSnapshot(jobId: string, snapshot: DlsiteJobSnapshot | null, stamp: number): void {
    if (snapshot === null) {
      terminate(jobId, true);
      return;
    }
    if (snapshot.jobId !== jobId) {
      if (snapshot.status === "running") follow(snapshot.jobId, { snapshot, stamp });
      else terminate(jobId, true);
      return;
    }
    emptyReopens = 0;
    applySnapshot(snapshot, stamp);
    if (snapshot.status === "finished") terminate(jobId, false);
  }

  function follow(jobId: string, initial?: { snapshot: DlsiteJobSnapshot; stamp: number }): void {
    if (trackedJobId === jobId && connection !== null) {
      if (initial) applySnapshot(initial.snapshot, initial.stamp);
      return;
    }
    if (trackedJobId !== null && trackedJobId !== jobId) terminate(trackedJobId, true);
    if (trackedJobId !== jobId) codeSeenAt.clear();
    terminalHandled.delete(jobId);
    trackedJobId = jobId;
    emptyReopens = 0;
    const state = store.getState();
    if (initial) applySnapshot(initial.snapshot, initial.stamp);
    else if (state.job?.jobId !== jobId) {
      patch({
        job: { jobId, status: "running", codes: new Map(), bulk: { processed: 0, total: 0 } },
        settled: false,
      });
    }
    open(jobId);
  }

  async function reconcile(token: number, jobId: string): Promise<void> {
    const startEpoch = epoch;
    const issuedAt = (clock += 1);
    let current: DlsiteJobSnapshot | null;
    try {
      current = await deps.getCurrent();
    } catch (cause) {
      if (epoch !== startEpoch) return;
      if (isRootReconfiguringError(cause)) {
        reset();
        return;
      }
      if (generation.isCurrent(token) && trackedJobId === jobId) noteEmptyReopen(jobId);
      return;
    }
    if (epoch !== startEpoch || !generation.isCurrent(token) || trackedJobId !== jobId) return;
    if (current === null) {
      terminate(jobId, true);
      return;
    }
    if (current.jobId !== jobId) {
      if (current.status === "running")
        follow(current.jobId, { snapshot: current, stamp: issuedAt });
      else terminate(jobId, true);
      return;
    }
    if (current.status === "finished") {
      applySnapshot(current, issuedAt);
      terminate(jobId, false);
      return;
    }
    // 照会の発行後にSSEで同じジョブの状態を受け取っていたら、古い照会結果でコードを巻き戻さない
    if (lastSseAt > issuedAt) return;
    applySnapshot(current, issuedAt);
    noteEmptyReopen(jobId);
  }

  /** 何も受け取らないまま閉じた状態が続くなら諦め、そうでなければ張り直す */
  function noteEmptyReopen(jobId: string): void {
    if (connection?.source.readyState !== EVENT_SOURCE_CLOSED) return;
    emptyReopens += 1;
    if (emptyReopens >= MAX_EMPTY_REOPENS) {
      failTracking(jobId, "DLsite取得の進捗を受け取れなくなりました");
      return;
    }
    open(jobId);
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
      const issuedAt = (clock += 1);
      try {
        const current = await deps.getCurrent();
        if (epoch !== startEpoch || trackedJobId !== null) return;
        if (current?.status === "running")
          follow(current.jobId, { snapshot: current, stamp: issuedAt });
      } catch (cause) {
        if (epoch === startEpoch && isRootReconfiguringError(cause)) reset();
      }
    },

    async startBulk(productCodes) {
      if (store.getState().startingBulk !== null) return { ok: true };
      const codes = [...new Set(productCodes.map(canonicalDlsiteProductCode))];
      if (codes.length === 0) return { ok: true };
      const startEpoch = epoch;
      bulkPosting = true;
      patch({ startingBulk: { total: codes.length } });
      try {
        for (const part of chunk(codes, DLSITE_JOB_MAX_PRODUCT_CODES)) {
          const { jobId } = await deps.startJob({ origin: "bulk", productCodes: part });
          if (epoch !== startEpoch) return { ok: true };
          follow(jobId);
        }
      } catch (cause) {
        if (epoch !== startEpoch) return { ok: true };
        bulkPosting = false;
        clearStartingBulk();
        return actionError(cause);
      }
      bulkPosting = false;
      if (receivedForTracked || trackedJobId === null) clearStartingBulk();
      return { ok: true };
    },

    async startSingle(productCode) {
      const code = canonicalDlsiteProductCode(productCode);
      if (store.getState().pendingSingles.has(code)) return { ok: true };
      const startEpoch = epoch;
      const startedAt = (clock += 1);
      inflightSingles.add(code);
      patch({ pendingSingles: new Set(store.getState().pendingSingles).add(code) });
      const drop = (): void => {
        inflightSingles.delete(code);
        const next = new Set(store.getState().pendingSingles);
        next.delete(code);
        patch({ pendingSingles: next });
      };
      try {
        const { jobId } = await deps.startJob({ origin: "single", productCode: code });
        if (epoch !== startEpoch) return { ok: true };
        follow(jobId);
        inflightSingles.delete(code);
        // 開始以降に発行・受信した状態にそのコードがあれば保留は不要。なければ、
        // 以前の終端状態が残っていても取り直しの状態を受け取るまで保留する。
        if ((codeSeenAt.get(code) ?? 0) > startedAt) releasePendingSingles([code]);
        return { ok: true };
      } catch (cause) {
        if (epoch !== startEpoch) return { ok: true };
        drop();
        return actionError(cause);
      }
    },

    async cancelBulk() {
      const { job, cancelling } = store.getState();
      if (!job || job.status !== "running" || cancelling) return { ok: true };
      const hasQueued = [...job.codes.values()].some(
        (entry) => entry.origin === "bulk" && entry.state === "queued",
      );
      if (!hasQueued) return { ok: true };
      const startEpoch = epoch;
      patch({ cancelling: true });
      try {
        await deps.cancelBulk(job.jobId);
        return { ok: true };
      } catch (cause) {
        if (epoch !== startEpoch) return { ok: true };
        return actionError(cause);
      } finally {
        if (epoch === startEpoch) patch({ cancelling: false });
      }
    },

    markSettled(jobId) {
      const { job, settled } = store.getState();
      if (job?.jobId === jobId && !settled) patch({ settled: true });
    },

    clearError: () => patch({ error: null }),
    reset,
  };
}

/** Jotai の store ごとに1つ。React 外からは store.get(dlsiteJobStoreAtom) で取る */
export const dlsiteJobStoreAtom = atomWithLazy(() => createDlsiteJobStore());
