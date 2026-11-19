import { atomWithStorage, createJSONStorage } from "jotai/utils";

/** 入口の点を出すために、前回スキャン画面を開いたときに見えていた項目のキー。 */
export interface ScanEntrySeen {
  candidates: string[];
  needsAttention: string[];
}

/** 現在の項目のキー。まだ読めていない集合は null。 */
export interface ScanEntryCurrent {
  candidates: readonly string[] | null;
  needsAttention: readonly string[] | null;
}

const EMPTY_SEEN: ScanEntrySeen = { candidates: [], needsAttention: [] };

const SETS = ["candidates", "needsAttention"] as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseScanEntrySeen(value: unknown): ScanEntrySeen {
  if (typeof value !== "object" || value === null) return EMPTY_SEEN;
  const { candidates, needsAttention } = value as Partial<Record<keyof ScanEntrySeen, unknown>>;
  if (!isStringArray(candidates) || !isStringArray(needsAttention)) return EMPTY_SEEN;
  return { candidates, needsAttention };
}

/** 読めている集合のどれかに、記憶に無いキーがあるか。 */
export function hasUnseen(current: ScanEntryCurrent, seen: ScanEntrySeen): boolean {
  return SETS.some((set) => {
    const keys = current[set];
    if (keys === null) return false;
    const known = new Set(seen[set]);
    return keys.some((key) => !known.has(key));
  });
}

/** 読めている集合だけを現在のキーで置き換える。内容が変わらないときは同じ参照を返す。 */
export function nextSeen(seen: ScanEntrySeen, current: ScanEntryCurrent): ScanEntrySeen {
  const next: ScanEntrySeen = {
    candidates: current.candidates ? [...new Set(current.candidates)].sort() : seen.candidates,
    needsAttention: current.needsAttention
      ? [...new Set(current.needsAttention)].sort()
      : seen.needsAttention,
  };
  const unchanged = SETS.every(
    (set) => next[set].length === seen[set].length && next[set].every((k, i) => k === seen[set][i]),
  );
  return unchanged ? seen : next;
}

const jsonStorage = createJSONStorage<ScanEntrySeen>(() => localStorage);

const storage: typeof jsonStorage = {
  ...jsonStorage,
  getItem: (key, initialValue) => parseScanEntrySeen(jsonStorage.getItem(key, initialValue)),
  subscribe: jsonStorage.subscribe
    ? (key, callback, initialValue) =>
        jsonStorage.subscribe!(key, (value) => callback(parseScanEntrySeen(value)), initialValue)
    : undefined,
};

export const scanEntrySeenAtom = atomWithStorage<ScanEntrySeen>(
  "mimimilli:scanEntrySeen",
  EMPTY_SEEN,
  storage,
  { getOnInit: true },
);
