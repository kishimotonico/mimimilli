import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
  clearScanCandidateLocalState,
  scanCandidateDeselectedPathsAtom,
} from "../../src/entities/scan/model/atoms";

describe("clearScanCandidateLocalState", () => {
  it("選択解除を空にする", () => {
    const store = createStore();
    store.set(scanCandidateDeselectedPathsAtom, new Set(["b"]));
    clearScanCandidateLocalState(store);
    expect(store.get(scanCandidateDeselectedPathsAtom).size).toBe(0);
  });
});
