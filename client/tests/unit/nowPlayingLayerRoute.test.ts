import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";
import {
  appRouteAtom,
  appRouteStore,
  closeLayerAtom,
  openNowPlayingLayerAtom,
  setAppModeAtom,
} from "../../src/entities/navigation/model/appRouteStore";
import { openFilesDirAtom } from "../../src/features/files/model/filesNavigationActions";
import { openWorkDetailAtom } from "../../src/entities/work/model/navigationActions";
import {
  addLibraryTagAtom,
  openLibraryTagAtom,
} from "../../src/entities/library/model/navigationActions";
import { appRouteCodec } from "../../src/entities/navigation/model/appRoute";
import { pendingWrites, seedAppMode, seedRoute } from "../helpers/route";
import { nts } from "../helpers/tag";

afterEach(() => {
  vi.restoreAllMocks();
});

function openedStore(mode: Parameters<typeof seedAppMode>[1], openedBy: "app" | "url" = "app") {
  const store = createStore();
  seedAppMode(store, mode);
  store.set(appRouteStore.sync.historyAvailabilityAtom, { canBack: true, canForward: false });
  seedRoute(store, (route) => ({ ...route, layer: { kind: "nowPlaying", openedBy } }));
  return store;
}

describe("再生中の層の遷移", () => {
  it("開くと履歴を1件積み、URL は下の画面に np=1 を足す", () => {
    const store = createStore();
    seedAppMode(store, "files");
    store.set(openNowPlayingLayerAtom);

    expect(pendingWrites(store)).toEqual(["push"]);
    const route = store.get(appRouteAtom);
    expect(route.mode).toBe("files");
    expect(route.layer).toEqual({ kind: "nowPlaying", openedBy: "app" });
    expect(appRouteCodec.serialize(route).url).toMatch(/^\/files.*np=1$/);
  });

  it("開いている層をもう一度開こうとしても何もしない", () => {
    const store = openedStore("library");
    store.set(openNowPlayingLayerAtom);
    expect(pendingWrites(store)).toEqual([]);
  });

  it("アプリの中で開いた層は、閉じると履歴を1件戻る", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const store = openedStore("library", "app");
    store.set(closeLayerAtom);

    expect(back).toHaveBeenCalledOnce();
    expect(pendingWrites(store)).toEqual([]);
  });

  it("URL を直接開いた層は、閉じると置き換えで np だけを外す", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const store = openedStore("library", "url");
    store.set(closeLayerAtom);

    expect(back).not.toHaveBeenCalled();
    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(store.get(appRouteAtom).layer).toBeNull();
  });

  it("層から作品詳細へ進むと、層のエントリーを置き換え、ファイルを抜ける", () => {
    const store = openedStore("files");
    store.set(openWorkDetailAtom, "RJ01");

    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(store.get(appRouteAtom)).toMatchObject({
      mode: "workDetail",
      workId: "RJ01",
      layer: null,
    });
  });

  it("層からタグへ進むと、層のエントリーを置き換えて「すべて」＋タグへ移る", () => {
    const store = openedStore("files");
    store.set(openLibraryTagAtom, nts(["cv/藤田茜"])[0]);

    expect(pendingWrites(store)).toEqual(["replace"]);
    const route = store.get(appRouteAtom);
    expect(route).toMatchObject({ mode: "library", layer: null });
    expect(route.library.selectedTags).toEqual(nts(["cv/藤田茜"]));
  });

  it("層が閉じているときの画面遷移は、これまでどおり履歴を積む", () => {
    const store = createStore();
    seedAppMode(store, "library");
    store.set(openWorkDetailAtom, "RJ01");
    expect(pendingWrites(store)).toEqual(["push"]);
  });

  it("層が開いているあいだの画面切り替えも、層のエントリーを置き換える", () => {
    const store = openedStore("library");
    store.set(setAppModeAtom, "files");
    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(store.get(appRouteAtom)).toMatchObject({ mode: "files", layer: null });
  });

  it("層からタグを Ctrl+クリックすると、層のエントリーを置き換えてチップを足す", () => {
    const store = openedStore("library");
    store.set(addLibraryTagAtom, nts(["cv/藤田茜"])[0], "works");

    expect(pendingWrites(store)).toEqual(["replace"]);
    const route = store.get(appRouteAtom);
    expect(route.layer).toBeNull();
    expect(route.library.selectedTags).toEqual(nts(["cv/藤田茜"]));
  });

  it("画面へ進む操作は、遷移の中身によらず層を落として置き換える（ファイル内の操作を含む）", () => {
    const store = openedStore("files");
    store.set(openFilesDirAtom, "dlsite");

    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(store.get(appRouteAtom).layer).toBeNull();
  });

  it("戻り先が無いときは、アプリで開いた層も置き換えで np を外す", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const store = openedStore("library", "app");
    store.set(appRouteStore.sync.historyAvailabilityAtom, { canBack: false, canForward: false });
    store.set(closeLayerAtom);

    expect(back).not.toHaveBeenCalled();
    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(store.get(appRouteAtom).layer).toBeNull();
  });
});
