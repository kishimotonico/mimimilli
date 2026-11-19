import { useStore } from "jotai";
import { useStoreSelector } from "../../shared/lib/useStoreSelector";
import { dlsiteBulkFrame, type DlsiteBulkFrame } from "./model/dlsiteBulkFrame";
import {
  dlsiteJobStoreAtom,
  type DlsiteJobState,
  type DlsiteJobStore,
} from "./model/dlsiteJobStore";

export function useDlsiteJobStore() {
  return useStore().get(dlsiteJobStoreAtom);
}

export function useDlsiteJobState<T>(selector: (state: DlsiteJobState) => T): T {
  return useStoreSelector(useDlsiteJobStore(), selector);
}

function sameFrame(a: DlsiteBulkFrame, b: DlsiteBulkFrame): boolean {
  if (a.kind === "idle" || b.kind === "idle") return a.kind === b.kind;
  return (
    a.processed === b.processed &&
    a.total === b.total &&
    a.remainingMs === b.remainingMs &&
    a.cancellable === b.cancellable
  );
}

const frameByState = new WeakMap<DlsiteJobState, DlsiteBulkFrame>();
const IDLE_FRAME: DlsiteBulkFrame = { kind: "idle" };
const lastFrameByStore = new WeakMap<DlsiteJobStore, DlsiteBulkFrame>();

/** 同じ状態には同じ参照を返す（useSyncExternalStoreの契約）。内容が同じ枠も、同じストアでは同じ参照にそろえる。 */
function selectBulkFrameOf(store: DlsiteJobStore, state: DlsiteJobState): DlsiteBulkFrame {
  const memo = frameByState.get(state);
  if (memo) return memo;
  const next = dlsiteBulkFrame(state);
  const previous = lastFrameByStore.get(store) ?? IDLE_FRAME;
  const frame = sameFrame(previous, next) ? previous : next;
  lastFrameByStore.set(store, frame);
  frameByState.set(state, frame);
  return frame;
}

export function useDlsiteBulkFrame(): DlsiteBulkFrame {
  const store = useDlsiteJobStore();
  return useStoreSelector(store, (state) => selectBulkFrameOf(store, state));
}
