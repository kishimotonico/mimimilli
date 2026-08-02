/** 購読者 signal の合流用。フライト本体は自前 AbortController を使い、全購読者が abort したときだけ中断する。 */
export const SHARED_FLIGHT_ABORT_MESSAGE = "リクエストはキャンセルされました";

export function throwIfAborted(signal?: AbortSignal, message = SHARED_FLIGHT_ABORT_MESSAGE): void {
  if (signal?.aborted) {
    throw new DOMException(message, "AbortError");
  }
}

type Subscriber = { aborted: boolean };

type SharedFlightHandle<T> = {
  subscribe: (signal?: AbortSignal) => Promise<T>;
  onComplete: (callback: () => void) => void;
};

function createSharedFlight<T>(
  execute: (flightSignal: AbortSignal) => Promise<T>,
): SharedFlightHandle<T> {
  const controller = new AbortController();
  const subscribers: Subscriber[] = [];
  let promise: Promise<T> | undefined;
  let completeCallback: (() => void) | undefined;

  function ensurePromise(): Promise<T> {
    if (!promise) {
      promise = execute(controller.signal);
      void promise.catch(() => undefined);
      void promise.then(
        () => completeCallback?.(),
        () => completeCallback?.(),
      );
    }
    return promise;
  }

  function subscribe(signal?: AbortSignal): Promise<T> {
    throwIfAborted(signal);
    const subscriber: Subscriber = { aborted: false };
    subscribers.push(subscriber);
    const flightPromise = ensurePromise();

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const settleAbort = () => {
        if (settled) return;
        settled = true;
        reject(new DOMException(SHARED_FLIGHT_ABORT_MESSAGE, "AbortError"));
      };

      const onSubscriberAbort = () => {
        subscriber.aborted = true;
        if (subscribers.length > 0 && subscribers.every((entry) => entry.aborted)) {
          controller.abort();
        }
        settleAbort();
      };

      if (signal) {
        signal.addEventListener("abort", onSubscriberAbort, { once: true });
      }

      void flightPromise.then(
        (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      );
    });
  }

  function onComplete(callback: () => void): void {
    completeCallback = callback;
    if (promise) {
      void promise.then(
        () => callback(),
        () => callback(),
      );
    }
  }

  return { subscribe, onComplete };
}

/** 同一キーの in-flight を束ね、購読者ごとの signal を独立に扱う。 */
export class SharedFlightPool<T> {
  private readonly flights = new Map<string, SharedFlightHandle<T>>();

  run(
    key: string,
    signal: AbortSignal | undefined,
    execute: (flightSignal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    throwIfAborted(signal);
    let flight = this.flights.get(key);
    if (!flight) {
      flight = createSharedFlight(execute);
      this.flights.set(key, flight);
      flight.onComplete(() => {
        if (this.flights.get(key) === flight) {
          this.flights.delete(key);
        }
      });
    }
    return flight.subscribe(signal);
  }
}
