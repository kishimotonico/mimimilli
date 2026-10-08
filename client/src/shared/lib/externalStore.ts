export interface ReadableStore<S> {
  getState(): S;
  subscribe(listener: () => void): () => void;
}

export interface ExternalStore<S> extends ReadableStore<S> {
  setState(next: S | ((current: S) => S)): void;
}

/** React に依存しない最小の状態保持。同一参照への更新は通知しない。 */
export function createExternalStore<S>(initial: S): ExternalStore<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState: (next) => {
      const resolved = typeof next === "function" ? (next as (current: S) => S)(state) : next;
      if (Object.is(resolved, state)) return;
      state = resolved;
      for (const listener of listeners) listener();
    },
  };
}

export interface EventEmitter<E> {
  emit(event: E): void;
  subscribe(listener: (event: E) => void): () => void;
}

export function createEventEmitter<E>(): EventEmitter<E> {
  const listeners = new Set<(event: E) => void>();
  return {
    emit: (event) => {
      for (const listener of listeners) listener(event);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
