import { defaultSmartFolders } from "../helpers/smartFolders";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";
import {
  appRouteAtom,
  appRouteStore,
  closeLayerAtom,
  leaveMissingWorkDetailAtom,
  openNowPlayingLayerAtom,
  setAppModeAtom,
} from "../../src/entities/navigation/model/appRouteStore";
import {
  dropFilesSelectionOfAtom,
  openFilesDirAtom,
} from "../../src/features/files/model/filesNavigationActions";
import { openWorkDetailAtom } from "../../src/entities/work/model/navigationActions";
import {
  addLibraryTagAtom,
  dropLibraryGroupAtom,
  normalizeLibraryFolderAtom,
  openLibraryTagAtom,
} from "../../src/entities/library/model/navigationActions";
import { appRouteCodec } from "../../src/entities/navigation/model/appRoute";
import {
  clearPendingOps,
  pendingWrites,
  seedAppMode,
  seedLibraryRoute,
  seedRoute,
} from "../helpers/route";
import { nts } from "../helpers/tag";

afterEach(() => {
  vi.restoreAllMocks();
});

function openedStore(mode: Parameters<typeof seedAppMode>[1]) {
  const store = createStore();
  seedAppMode(store, mode);
  store.set(appRouteStore.sync.historyAvailabilityAtom, { canBack: true, canForward: false });
  seedRoute(store, (route) => ({ ...route, layer: { kind: "nowPlaying" } }));
  return store;
}

describe("再生中の層の遷移", () => {
  it("開くと履歴を1件積み、URL は下の画面のまま", () => {
    const store = createStore();
    seedAppMode(store, "files");
    store.set(openNowPlayingLayerAtom);

    expect(pendingWrites(store)).toEqual(["push"]);
    const route = store.get(appRouteAtom);
    expect(route.mode).toBe("files");
    expect(route.layer).toEqual({ kind: "nowPlaying" });
    expect(appRouteCodec.serialize(route).url).toBe("/files");
  });

  it("開いている層をもう一度開こうとしても何もしない", () => {
    const store = openedStore("library");
    store.set(openNowPlayingLayerAtom);
    expect(pendingWrites(store)).toEqual([]);
  });

  it("閉じると履歴を1件戻り、戻るが終わるまで続けて閉じても2件戻らない", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const store = openedStore("library");
    store.set(closeLayerAtom);
    store.set(closeLayerAtom);

    expect(back).toHaveBeenCalledOnce();
    expect(pendingWrites(store)).toEqual([]);
  });

  it("戻るが終わって route が変われば、次に開いた層は同じように閉じられる", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const store = openedStore("library");
    store.set(closeLayerAtom);
    seedRoute(store, (route) => ({ ...route, layer: null }));
    seedRoute(store, (route) => ({ ...route, layer: { kind: "nowPlaying" } }));
    store.set(closeLayerAtom);

    expect(back).toHaveBeenCalledTimes(2);
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
    store.set(openLibraryTagAtom, nts(["cv/藤田茜"])[0], defaultSmartFolders());

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
    store.set(addLibraryTagAtom, nts(["cv/藤田茜"])[0], defaultSmartFolders());

    expect(pendingWrites(store)).toEqual(["replace"]);
    const route = store.get(appRouteAtom);
    expect(route.layer).toBeNull();
    expect(route.library.selectedTags).toEqual(nts(["cv/藤田茜"]));
  });

  it("層から選択済みのタグを Ctrl+クリックしても、層を落として一覧へ移る", () => {
    const store = openedStore("library");
    seedLibraryRoute(store, { selectedTags: nts(["cv/藤田茜"]) });
    clearPendingOps(store);
    store.set(addLibraryTagAtom, nts(["cv/藤田茜"])[0], defaultSmartFolders());

    expect(pendingWrites(store)).toEqual(["replace"]);
    const route = store.get(appRouteAtom);
    expect(route.layer).toBeNull();
    expect(route.library.selectedTags).toEqual(nts(["cv/藤田茜"]));
  });

  it("補正（グループ分けを変えた保存後・消えたフォルダーからの退避）は層を保ち、置き換える", () => {
    const store = openedStore("library");
    seedLibraryRoute(store, { folderId: "sf-x", group: "藤田茜" });
    clearPendingOps(store);

    store.set(dropLibraryGroupAtom, "sf-x");
    expect(store.get(appRouteAtom)).toMatchObject({ layer: { kind: "nowPlaying" } });
    expect(store.get(appRouteAtom).library.group).toBeNull();

    store.set(normalizeLibraryFolderAtom, defaultSmartFolders());
    expect(store.get(appRouteAtom)).toMatchObject({ layer: { kind: "nowPlaying" } });
    expect(store.get(appRouteAtom).library.folderId).toBe("all");
    expect(pendingWrites(store)).toEqual(["replace", "replace"]);
  });

  it("存在しない作品詳細からの退避は、同じ作品のときだけ層を保って置き換える", () => {
    const store = openedStore({ workDetail: "work-a" });
    clearPendingOps(store);

    store.set(leaveMissingWorkDetailAtom, "work-b");
    expect(store.get(appRouteAtom)).toMatchObject({ mode: "workDetail", workId: "work-a" });
    expect(pendingWrites(store)).toEqual([]);

    store.set(leaveMissingWorkDetailAtom, "work-a");
    expect(store.get(appRouteAtom)).toMatchObject({
      mode: "library",
      layer: { kind: "nowPlaying" },
    });
    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  it("ファイルの選択の解除は、選択が同じパスのときだけ層を保って置き換える", () => {
    const store = openedStore("files");
    seedRoute(store, (route) => ({
      ...route,
      files: { ...route.files, relPath: ["dlsite"], selectedRelPath: ["dlsite", "a.json"] },
    }));
    clearPendingOps(store);

    store.set(dropFilesSelectionOfAtom, "dlsite/b.json");
    expect(store.get(appRouteAtom).files.selectedRelPath).toEqual(["dlsite", "a.json"]);
    expect(pendingWrites(store)).toEqual([]);

    store.set(dropFilesSelectionOfAtom, "dlsite/a.json");
    expect(store.get(appRouteAtom).files.selectedRelPath).toBeNull();
    expect(store.get(appRouteAtom).layer).toEqual({ kind: "nowPlaying" });
    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  it("画面へ進む操作は、遷移の中身によらず層を落として置き換える（ファイル内の操作を含む）", () => {
    const store = openedStore("files");
    store.set(openFilesDirAtom, "dlsite");

    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(store.get(appRouteAtom).layer).toBeNull();
  });

  it("戻り先が無いときは、置き換えで層を外す", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const store = openedStore("library");
    store.set(appRouteStore.sync.historyAvailabilityAtom, { canBack: false, canForward: false });
    store.set(closeLayerAtom);

    expect(back).not.toHaveBeenCalled();
    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(store.get(appRouteAtom).layer).toBeNull();
  });
});
