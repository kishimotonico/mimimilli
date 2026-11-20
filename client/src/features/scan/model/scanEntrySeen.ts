import { atomWithStorage, createJSONStorage } from "jotai/utils";

/** 入口の点を出すために、前回スキャン画面を開いたときに見えていた項目のキー。 */
export interface ScanEntrySeen {
  candidates: string[];
  needsAttention: string[];
  /** 変化のあったスキャンの完了時刻。 */
  changes: string[];
}

/** 現在の項目のキー。まだ読めていない集合は null。 */
export interface ScanEntryCurrent {
  candidates: readonly string[] | null;
  needsAttention: readonly string[] | null;
  changes: readonly string[] | null;
}

const EMPTY_SEEN: ScanEntrySeen = { candidates: [], needsAttention: [], changes: [] };

const SETS = ["candidates", "needsAttention", "changes"] as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseScanEntrySeen(value: unknown): ScanEntrySeen {
  if (typeof value !== "object" || value === null) return EMPTY_SEEN;
  const { candidates, needsAttention, changes } = value as Partial<
    Record<keyof ScanEntrySeen, unknown>
  >;
  if (!isStringArray(candidates) || !isStringArray(needsAttention) || !isStringArray(changes)) {
    return EMPTY_SEEN;
  }
  return { candidates, needsAttention, changes };
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
    changes: current.changes ? [...new Set(current.changes)].sort() : seen.changes,
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
