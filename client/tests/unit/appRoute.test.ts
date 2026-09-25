import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  appRouteCodec,
  DEFAULT_APP_ROUTE,
  type AppRoute,
} from "../../src/entities/navigation/model/appRoute";
import {
  appRouteAtom,
  appRouteStore,
  setAppModeAtom,
} from "../../src/entities/navigation/model/appRouteStore";
import { showLibraryWorkAtom } from "../../src/entities/library/model/navigationActions";
import {
  activeAxisAtom,
  librarySearchQueryAtom,
  selectedTagsAtom,
  selectedWorkIdAtom,
} from "../../src/entities/library/model/navigationAtoms";
import {
  filesRelPathAtom,
  openPathInFilesAtom,
} from "../../src/entities/file-system/model/navigationAtoms";
import { workDetailIdAtom } from "../../src/entities/work/model/navigationAtoms";
import { nts } from "../helpers/tag";

const initialUrl = `${window.location.pathname}${window.location.search}`;

afterEach(() => {
  history.replaceState(null, "", initialUrl);
});

const filteredLibrary: AppRoute = {
  ...DEFAULT_APP_ROUTE,
  library: { ...DEFAULT_APP_ROUTE.library, selectedTags: nts(["cv/藤田茜"]), q: "朗読" },
};

describe("appRouteCodec", () => {
  it("URLは表示中の画面の部分だけを表す", () => {
    const route: AppRoute = {
      ...filteredLibrary,
      mode: "files",
      files: { relPath: ["dlsite"], selectedRelPath: null },
    };

    expect(appRouteCodec.serialize(route)).toBe("/files/dlsite");
    expect(appRouteCodec.serialize(filteredLibrary)).toBe(
      "/library/all?tags=cv%2F%E8%97%A4%E7%94%B0%E8%8C%9C&q=%E6%9C%97%E8%AA%AD",
    );
  });

  it("URLの適用は他の画面の状態を現在のrouteから保つ", () => {
    const next = appRouteCodec.parse("/files/dlsite").apply(filteredLibrary);

    expect(next.mode).toBe("files");
    expect(next.files).toEqual({ relPath: ["dlsite"], selectedRelPath: null });
    expect(next.library).toBe(filteredLibrary.library);
  });

  it("作品詳細IDは作品詳細の画面だけが持つ", () => {
    const detail = appRouteCodec.parse("/work/RJ01").apply(DEFAULT_APP_ROUTE);
    expect(detail).toMatchObject({ mode: "workDetail", workId: "RJ01" });

    const back = appRouteCodec.parse("/library/all").apply(detail);
    expect("workId" in back).toBe(false);
  });
});

describe("appRouteAtom と派生atom", () => {
  it("ストア生成時のURLから全項目の初期値を決める", () => {
    history.replaceState(null, "", "/library/all?tags=cv%2F%E8%97%A4%E7%94%B0%E8%8C%9C&q=abc");
    const store = createStore();

    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜"]);
    expect(store.get(librarySearchQueryAtom)).toBe("abc");
    expect(store.get(workDetailIdAtom)).toBeNull();
  });

  it("画面を切り替えてもLibraryとFilesの状態を保つ", () => {
    history.replaceState(null, "", "/files/dlsite");
    const store = createStore();

    store.set(setAppModeAtom, "library");
    store.set(setAppModeAtom, "files");

    expect(store.get(filesRelPathAtom)).toEqual(["dlsite"]);
    expect(store.get(appRouteAtom).mode).toBe("files");
  });
});

describe("複数の項目を変える操作は1回の遷移になる", () => {
  it("再生中の作品をLibraryで表示する操作は、Filesからでも1回のpushで全作品一覧の選択状態へ移る", () => {
    history.replaceState(null, "", "/files/dlsite");
    const store = createStore();

    store.set(showLibraryWorkAtom, "work-1");

    expect(store.get(appRouteAtom).mode).toBe("library");
    expect(store.get(activeAxisAtom)).toBe("all");
    expect(store.get(selectedWorkIdAtom)).toBe("work-1");
    expect(store.get(appRouteStore.sync.pendingWriteAtom)).toBe("push");
  });

  it("「Filesで開く」はFiles表示中でもpushになる", () => {
    history.replaceState(null, "", "/files/dlsite");
    const store = createStore();

    store.set(openPathInFilesAtom, { path: "other/a.mp3", root: "/library" });

    expect(store.get(filesRelPathAtom)).toEqual(["other"]);
    expect(store.get(appRouteStore.sync.pendingWriteAtom)).toBe("push");
  });
});
