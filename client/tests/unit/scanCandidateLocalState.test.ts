import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
  clearScanCandidateLocalState,
  scanCandidateSelectionAtom,
} from "../../src/entities/scan/model/atoms";

describe("clearScanCandidateLocalState", () => {
  it("選択の上書きを空にする", () => {
    const store = createStore();
    store.set(scanCandidateSelectionAtom, new Map([["b", { selected: false, judged: false }]]));
    clearScanCandidateLocalState(store);
    expect(store.get(scanCandidateSelectionAtom).size).toBe(0);
  });
});
