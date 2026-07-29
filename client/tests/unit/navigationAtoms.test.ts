import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";

const initialUrl = `${window.location.pathname}${window.location.search}`;

afterEach(() => {
  history.replaceState(null, "", initialUrl);
});

describe("appModeAtom", () => {
  it("ストアごとに、その時点のURLからモードを決める", () => {
    history.replaceState(null, "", "/files/RJ00000000_work");
    expect(createStore().get(appModeAtom)).toBe("files");

    history.replaceState(null, "", "/library/all");
    expect(createStore().get(appModeAtom)).toBe("library");
  });

  it("書き込み後はURLではなく書き込んだ値を返す", () => {
    history.replaceState(null, "", "/library/all");
    const store = createStore();
    store.set(appModeAtom, "files");
    history.replaceState(null, "", "/library/cv");
    expect(store.get(appModeAtom)).toBe("files");
  });
});
