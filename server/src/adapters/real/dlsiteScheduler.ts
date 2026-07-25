import { MAX_DLSITE_TIMER_MS, type DlsiteRequestConfig } from "./dlsiteConfig.ts";

export type DlsiteTransport = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface DlsiteSchedulerDependencies {
  transport?: DlsiteTransport;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  logger?: (event: Record<string, unknown>) => void;
}

export class DlsiteOfflineError extends Error {
  constructor() {
    super("DLsiteはオフライン設定のため取得しませんでした");
    this.name = "DlsiteOfflineError";
  }
}

function abortError(): DOMException {
  return new DOMException("DLsiteリクエストはキャンセルされました", "AbortError");
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function waitForQueue(queue: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return queue;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    void queue.then(
      () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function retryAfterMs(value: string | null, now: number): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) {
    const seconds = Number(value.trim());
    return Number.isSafeInteger(seconds) && seconds <= Math.floor(MAX_DLSITE_TIMER_MS / 1_000)
      ? seconds * 1_000
      : MAX_DLSITE_TIMER_MS;
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/** DLsiteへ出る各HTTP試行を直列化し、開始間隔・retry・共有cooldownを保証する。 */
export class DlsiteScheduler {
  private readonly config: DlsiteRequestConfig;
  private readonly transport: DlsiteTransport;
  private readonly now: () => number;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;
  private readonly logger: (event: Record<string, unknown>) => void;
  private nextStartAt = 0;
  private cooldownUntil = 0;
  private queue = Promise.resolve();
  private requestCount = 0;

  constructor(config: DlsiteRequestConfig, dependencies: DlsiteSchedulerDependencies = {}) {
    this.config = config;
    this.transport = dependencies.transport ?? fetch;
    this.now = dependencies.now ?? Date.now;
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.random = dependencies.random ?? Math.random;
    this.logger = dependencies.logger ?? (() => undefined);
  }

  assertOnline(): void {
    if (this.config.offline) throw new DlsiteOfflineError();
  }

  async fetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
    this.assertOnline();
    const deadline = this.deadline();
    let retry = 0;
    while (true) {
      const signal = this.timeoutSignal(init.signal, deadline);
      try {
        const response = await this.start(
          () => this.transport(input, { ...init, signal }),
          signal,
          deadline,
        );
        const retryable = response.status === 429 || response.status >= 500;
        if (response.status === 429 || response.status === 503) {
          const delay = retryAfterMs(response.headers.get("retry-after"), this.now());
          if (delay !== null)
            this.cooldownUntil = Math.max(this.cooldownUntil, this.addDelay(delay));
        }
        if (!retryable || retry >= this.config.retryCount) return response;
        await response.body?.cancel();
      } catch (error) {
        if (init.signal?.aborted || (error instanceof DOMException && error.name === "AbortError"))
          throw error;
        if (this.now() >= deadline || retry >= this.config.retryCount) throw error;
      }
      retry += 1;
      const base = Math.min(this.config.maxBackoffMs, 1_000 * 2 ** (retry - 1));
      const delay = Math.min(this.config.maxBackoffMs, Math.floor(base * (0.5 + this.random())));
      if (this.addDelay(delay) > deadline)
        throw new Error("DLsiteリクエストの総期限を超過しました");
      this.logger({ event: "dlsite_http_retry", retry, delayMs: delay });
      await this.sleep(delay, init.signal ?? undefined);
    }
  }

  /** 注入した疑似transportも実HTTPと同じ開始間隔へ載せるためのテスト境界。 */
  async schedule<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    this.assertOnline();
    return this.start(operation, signal);
  }

  private timeoutSignal(signal: AbortSignal | null | undefined, deadline: number): AbortSignal {
    const remaining = Math.max(0, deadline - this.now());
    const timeout = AbortSignal.timeout(remaining);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  }

  private deadline(): number {
    return this.addDelay(this.config.timeoutMs);
  }

  private addDelay(delay: number): number {
    return Math.min(Number.MAX_SAFE_INTEGER, this.now() + delay);
  }

  private async start<T>(
    operation: () => Promise<T>,
    signal?: AbortSignal,
    deadline?: number,
  ): Promise<T> {
    let release!: () => void;
    const previous = this.queue;
    const current = new Promise<void>((resolve) => (release = resolve));
    this.queue = previous.then(() => current);
    try {
      await waitForQueue(previous, signal);
      if (signal?.aborted) throw abortError();
      const waitMs = Math.max(0, this.nextStartAt - this.now(), this.cooldownUntil - this.now());
      if (
        waitMs > MAX_DLSITE_TIMER_MS ||
        (deadline !== undefined && this.addDelay(waitMs) > deadline)
      ) {
        throw new Error("DLsiteリクエストの総期限を超過しました");
      }
      if (waitMs > 0) await this.sleep(waitMs, signal);
      if (signal?.aborted) throw abortError();
      const startedAt = this.now();
      this.nextStartAt = startedAt + this.config.requestIntervalMs;
      this.requestCount += 1;
      this.logger({ event: "dlsite_http_request", count: this.requestCount });
      return await operation();
    } finally {
      release();
    }
  }
}
