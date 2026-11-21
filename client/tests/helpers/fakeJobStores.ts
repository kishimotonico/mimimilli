import { vi } from "vitest";
import { createEventEmitter, createExternalStore } from "../../src/shared/lib/externalStore";
import {
  INITIAL_DLSITE_JOB_STATE,
  type DlsiteJobState,
  type DlsiteJobStore,
  type DlsiteJobStoreEvent,
} from "../../src/entities/dlsite/model/dlsiteJobStore";
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
    emit: events.emit,
  } satisfies ScanJobStore & {
    setState: typeof store.setState;
    emit: typeof events.emit;
  };
  return fake;
}

/** 画面テスト用。状態を直接書き換えられ、操作はvi.fn()で記録する。 */
export function createFakeDlsiteJobStore(initial: Partial<DlsiteJobState> = {}) {
  const store = createExternalStore<DlsiteJobState>({ ...INITIAL_DLSITE_JOB_STATE, ...initial });
  const events = createEventEmitter<DlsiteJobStoreEvent>();
  const fake = {
    getState: store.getState,
    subscribe: store.subscribe,
    subscribeEvents: events.subscribe,
    start: vi.fn(async () => ({ ok: true as const })),
    cancel: vi.fn(async () => ({ ok: true as const })),
    attach: vi.fn(async () => {}),
    clearError: vi.fn(),
    reset: vi.fn(),
    setState: store.setState,
    emit: events.emit,
  } satisfies DlsiteJobStore & {
    setState: typeof store.setState;
    emit: typeof events.emit;
  };
  return fake;
}
