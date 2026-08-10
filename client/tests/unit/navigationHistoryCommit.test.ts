import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { setAppModeAtom } from "../../src/features/navigation/model/navigationAtoms";
import { mergeNavigationHistoryCommitKind } from "../../src/shared/model/navigationHistoryCommit";
import {
  consumeNavigationHistoryCommitAtom,
  navigationHistoryCommitAtom,
  requestNavigationHistoryCommitAtom,
} from "../../src/shared/model/navigationHistoryAtoms";
import {
  selectLibraryWorkAtom,
  setLibraryAxisAtom,
} from "../../src/entities/library/model/navigationActions";

const initialUrl = `${window.location.pathname}${window.location.search}`;

afterEach(() => {
  history.replaceState(null, "", initialUrl);
});

describe("mergeNavigationHistoryCommitKind", () => {
  it("replace と replace は replace", () => {
    expect(mergeNavigationHistoryCommitKind("replace", "replace")).toBe("replace");
  });

  it("push が混在すれば push を優先する", () => {
    expect(mergeNavigationHistoryCommitKind("push", "replace")).toBe("push");
    expect(mergeNavigationHistoryCommitKind("replace", "push")).toBe("push");
    expect(mergeNavigationHistoryCommitKind("push", "push")).toBe("push");
  });
});

describe("requestNavigationHistoryCommitAtom", () => {
  it("同一バッチで push → replace の順に宣言しても push が残る", () => {
    const store = createStore();

    store.set(requestNavigationHistoryCommitAtom, "push");
    store.set(requestNavigationHistoryCommitAtom, "push");
    store.set(requestNavigationHistoryCommitAtom, "replace");

    expect(store.get(navigationHistoryCommitAtom)).toMatchObject({
      kind: "push",
      pending: true,
      revision: 3,
    });
  });

  it("再生中作品表示と同型の push×2 → replace でも push が残る", () => {
    const store = createStore();
    history.replaceState(null, "", "/files");

    store.set(setAppModeAtom, "library");
    store.set(setLibraryAxisAtom, "all");
    store.set(selectLibraryWorkAtom, "work-1");

    expect(store.get(navigationHistoryCommitAtom)).toMatchObject({
      kind: "push",
      pending: true,
      revision: 3,
    });
  });

  it("消費後の replace 単独宣言は replace になる", () => {
    const store = createStore();

    store.set(requestNavigationHistoryCommitAtom, "push");
    store.set(consumeNavigationHistoryCommitAtom);
    store.set(requestNavigationHistoryCommitAtom, "replace");

    expect(store.get(navigationHistoryCommitAtom)).toMatchObject({
      kind: "replace",
      pending: true,
      revision: 2,
    });
  });
});
