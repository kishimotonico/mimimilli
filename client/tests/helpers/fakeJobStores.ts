import { vi } from "vitest";
import { createEventEmitter, createExternalStore } from "../../src/shared/lib/externalStore";
import type {
  ScanJobEvent,
  ScanJobState,
  ScanJobStore,
} from "../../src/entities/scan/model/scanJobStore";

/** 画面テスト用。状態を直接書き換えられ、操作はvi.fn()で記録する。 */
export function createFakeScanJobStore(initial: Partial<ScanJobState> = {}) {
  const store = createExternalStore<ScanJobState>({ job: null, error: null, ...initial });
  const events = createEventEmitter<ScanJobEvent>();
  const fake = {
    getState: store.getState,
    subscribe: store.subscribe,
    subscribeEvents: events.subscribe,
    start: vi.fn(async () => ({ ok: true as const, job: null })),
    cancel: vi.fn(async () => ({ ok: true as const, job: null })),
    attach: vi.fn(async () => {}),
    clearError: vi.fn(),
    reset: vi.fn(),
    setState: store.setState,
  } satisfies ScanJobStore & { setState: typeof store.setState };
  return fake;
}
