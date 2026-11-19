import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
  clearScanCandidateLocalState,
  scanCandidateDeselectedPathsAtom,
  scanCandidateHiddenPathsAtom,
} from "../../src/entities/scan/model/atoms";

describe("clearScanCandidateLocalState", () => {
  it("非表示と選択解除の両方を空にする", () => {
    const store = createStore();
    store.set(scanCandidateHiddenPathsAtom, new Set(["a"]));
    store.set(scanCandidateDeselectedPathsAtom, new Set(["b"]));
    clearScanCandidateLocalState(store);
    expect(store.get(scanCandidateHiddenPathsAtom).size).toBe(0);
    expect(store.get(scanCandidateDeselectedPathsAtom).size).toBe(0);
  });
});
