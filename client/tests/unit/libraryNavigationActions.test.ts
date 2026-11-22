import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import { nt, nts } from "../helpers/tag";
import { clearPendingOps, pendingWrites, seedAppMode, seedLibraryRoute } from "../helpers/route";
import { appRouteAtom } from "../../src/entities/navigation/model/appRouteStore";
import {
  addLibraryTagAtom,
  clearLibrarySortAtom,
  clearLibraryTagsAtom,
  goToLibrarySegmentAtom,
  openLibraryFolderAtom,
  openLibraryGroupValueAtom,
  openLibraryTagAtom,
  removeLibraryTagAtom,
  replaceLibraryFolderAtom,
  reshuffleLibrarySeedAtom,
  searchLibraryInAllAtom,
  selectLibraryGroupValueAtom,
  selectLibraryWorkAtom,
  setLibrarySearchQueryAtom,
  setLibrarySortAtom,
} from "../../src/entities/library/model/navigationActions";

function setup(patch: Parameters<typeof seedLibraryRoute>[1] = {}) {
  const store = createStore();
  seedLibraryRoute(store, patch);
  return store;
}

const lib = (store: ReturnType<typeof createStore>) => store.get(libraryRouteAtom);

describe("開いているスマートフォルダーを消したときの入り直し（replaceLibraryFolderAtom）", () => {
  it("ライブラリでは履歴を積まずに置き換える", () => {
    const store = setup({ folderId: "added", q: "x" });

    store.set(replaceLibraryFolderAtom, "all");

    expect(lib(store)).toMatchObject({ folderId: "all", q: "" });
    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  it("作品詳細では何もしない", () => {
    const store = createStore();
    seedLibraryRoute(store, { folderId: "added" });
    seedAppMode(store, { workDetail: "work-1" });
    clearPendingOps(store);

    store.set(replaceLibraryFolderAtom, "all");

    expect(lib(store).folderId).toBe("added");
    expect(pendingWrites(store)).toEqual([]);
  });
});

describe("サイドバーからの入り直し（openLibraryFolderAtom）", () => {
  it("フォルダーを切り替えるとチップ・検索語・グループの値・選択中の作品・今の並びを消し、新しい seed を入れる", () => {
    const store = setup({
      folderId: "by-cv",
      group: "藤田茜",
      selectedTags: nts(["cv/藤田茜"]),
      q: "藤田",
      selectedWorkId: "work-1",
      sort: "title-asc",
      seed: 1,
    });

    store.set(openLibraryFolderAtom, "fav");

    expect(lib(store)).toMatchObject({
      folderId: "fav",
      group: null,
      selectedTags: [],
      q: "",
      selectedWorkId: null,
      sort: null,
    });
    expect(lib(store).seed).not.toBe(1);
    expect(pendingWrites(store)).toEqual(["push"]);
  });

  it("画面がファイルでも library に切り替わる", () => {
    const store = createStore();
    seedAppMode(store, "files");

    store.set(openLibraryFolderAtom, "fav");

    expect(store.get(appRouteAtom).mode).toBe("library");
  });

  it("グループの値のクイックオーバーレイから入ると、その値の作品一覧へ今の並びを捨てて入る", () => {
    const store = setup({ sort: "title-asc", selectedTags: nts(["ASMR"]), q: "x" });

    store.set(openLibraryGroupValueAtom, "by-cv", "藤田茜");

    expect(lib(store)).toMatchObject({
      folderId: "by-cv",
      group: "藤田茜",
      selectedTags: [],
      q: "",
      sort: null,
    });
  });
});

describe("グループの値の選択（selectLibraryGroupValueAtom）", () => {
  it("値一覧から値を選ぶと、効いていなかったチップ・検索語は持ち込まず、今の並びと seed は保つ", () => {
    const store = setup({
      folderId: "by-cv",
      group: null,
      selectedTags: nts(["ASMR"]),
      q: "x",
      sort: "title-asc",
      seed: 5,
    });

    store.set(selectLibraryGroupValueAtom, "藤田茜");

    expect(lib(store)).toMatchObject({
      group: "藤田茜",
      selectedTags: [],
      q: "",
      sort: "title-asc",
      seed: 5,
    });
  });

  it("作品一覧の兄弟の値へ移ると、チップ・検索語は保つ", () => {
    const store = setup({
      folderId: "by-cv",
      group: "藤田茜",
      selectedTags: nts(["ASMR"]),
      q: "x",
      selectedWorkId: "work-1",
    });

    store.set(selectLibraryGroupValueAtom, "霧島レイ");

    expect(lib(store)).toMatchObject({
      group: "霧島レイ",
      selectedTags: ["ASMR"],
      q: "x",
      selectedWorkId: null,
    });
  });

  it("同じ値を選んでも何もしない", () => {
    const store = setup({ folderId: "by-cv", group: "藤田茜" });
    clearPendingOps(store);

    store.set(selectLibraryGroupValueAtom, "藤田茜");

    expect(pendingWrites(store)).toEqual([]);
  });
});

describe("パンくずの先頭（goToLibrarySegmentAtom）", () => {
  it("値の作品一覧から、そのスマートフォルダーの値一覧へ戻る。チップ・検索語は消す", () => {
    const store = setup({
      folderId: "by-cv",
      group: "藤田茜",
      selectedTags: nts(["ASMR"]),
      q: "x",
    });

    store.set(goToLibrarySegmentAtom, 0);

    expect(lib(store)).toMatchObject({ folderId: "by-cv", group: null, selectedTags: [], q: "" });
  });

  it("値を選んでいないときは何もしない", () => {
    const store = setup({ folderId: "by-cv", group: null });
    clearPendingOps(store);

    store.set(goToLibrarySegmentAtom, 0);

    expect(pendingWrites(store)).toEqual([]);
  });

  it("先頭以外のセグメントでは何もしない", () => {
    const store = setup({ folderId: "by-cv", group: "藤田茜" });

    store.set(goToLibrarySegmentAtom, 1);

    expect(lib(store).group).toBe("藤田茜");
  });
});

describe("タグの行き先（ADR-0041 の表）", () => {
  it("openLibraryTagAtom: どの場所からでも「すべて」＋そのタグ。他のチップ・検索語・グループは置き換える", () => {
    const store = setup({
      folderId: "by-cv",
      group: "藤田茜",
      selectedTags: nts(["サークル/月白製作所"]),
      q: "x",
      sort: "title-asc",
    });

    store.set(openLibraryTagAtom, nt("cv/霧島レイ"));

    expect(lib(store)).toMatchObject({
      folderId: "all",
      group: null,
      selectedTags: ["cv/霧島レイ"],
      q: "",
      sort: null,
    });
  });

  it("openLibraryTagAtom: すでに「すべて」の作品一覧なら並びと seed を保ったままタグを置き換える", () => {
    const store = setup({
      folderId: "all",
      selectedTags: nts(["ASMR"]),
      sort: "title-asc",
      seed: 9,
    });

    store.set(openLibraryTagAtom, nt("cv/藤田茜"));

    expect(lib(store)).toMatchObject({ selectedTags: ["cv/藤田茜"], sort: "title-asc", seed: 9 });
  });

  it("openLibraryTagAtom: 作品詳細からは mode が library になる", () => {
    const store = createStore();
    seedAppMode(store, { workDetail: "work-1" });

    store.set(openLibraryTagAtom, nt("cv/藤田茜"));

    const route = store.get(appRouteAtom);
    expect(route.mode).toBe("library");
    expect("workId" in route).toBe(false);
    expect(route.library.folderId).toBe("all");
  });

  it("addLibraryTagAtom: 作品一覧ならその一覧にチップを足す（フォルダーは変えない）", () => {
    const store = setup({ folderId: "fav", selectedTags: nts(["サークル/月白製作所"]) });

    store.set(addLibraryTagAtom, nt("cv/藤田茜"), "works");

    expect(lib(store)).toMatchObject({
      folderId: "fav",
      selectedTags: ["サークル/月白製作所", "cv/藤田茜"],
    });
  });

  it("addLibraryTagAtom: 値一覧なら「すべて」＋そのチップ", () => {
    const store = setup({ folderId: "by-cv", group: null });

    store.set(addLibraryTagAtom, nt("cv/藤田茜"), "value-list");

    expect(lib(store)).toMatchObject({
      folderId: "all",
      group: null,
      selectedTags: ["cv/藤田茜"],
      sort: null,
    });
  });

  it("addLibraryTagAtom: 読めない行を保持しているときも「すべて」＋そのチップ", () => {
    const store = setup({ folderId: "sf-broken" });

    store.set(addLibraryTagAtom, nt("cv/藤田茜"), "broken");

    expect(lib(store)).toMatchObject({ folderId: "all", selectedTags: ["cv/藤田茜"] });
  });

  it("addLibraryTagAtom: 作品詳細から押すと mode が library になって保持している一覧に足す", () => {
    const store = createStore();
    seedLibraryRoute(store, { folderId: "fav" });
    seedAppMode(store, { workDetail: "work-1" });

    store.set(addLibraryTagAtom, nt("cv/藤田茜"), "works");

    expect(store.get(appRouteAtom).mode).toBe("library");
    expect(lib(store)).toMatchObject({ folderId: "fav", selectedTags: ["cv/藤田茜"] });
  });

  it("addLibraryTagAtom: 選択済みのタグは何もしない（解除しない・履歴も積まない）", () => {
    const store = setup({ selectedTags: nts(["cv/藤田茜"]), selectedWorkId: "work-1" });
    clearPendingOps(store);

    store.set(addLibraryTagAtom, nt("cv/藤田茜"), "works");

    expect(lib(store).selectedTags).toEqual(["cv/藤田茜"]);
    expect(lib(store).selectedWorkId).toBe("work-1");
    expect(pendingWrites(store)).toEqual([]);
  });

  it("addLibraryTagAtom: 組み込み擬似タグは同じキーで排他してから追加する（year）", () => {
    const store = setup({ selectedTags: nts(["cv/藤田茜", "@year/2023"]) });

    store.set(addLibraryTagAtom, nt("@year/2024"), "works");

    expect(lib(store).selectedTags).toEqual(["cv/藤田茜", "@year/2024"]);
  });

  it("addLibraryTagAtom: 実タグ year/2025 は単一選択の対象にならず共存する", () => {
    const store = setup({ selectedTags: nts(["year/2025"]) });

    store.set(addLibraryTagAtom, nt("@year/2024"), "works");

    expect(lib(store).selectedTags).toEqual(["year/2025", "@year/2024"]);
  });

  it("addLibraryTagAtom: 選択中の作品をクリアする", () => {
    const store = setup({ selectedWorkId: "work-1" });

    store.set(addLibraryTagAtom, nt("cv/藤田茜"), "works");

    expect(lib(store).selectedWorkId).toBeNull();
  });

  it("removeLibraryTagAtom / clearLibraryTagsAtom は選択中の作品をクリアする", () => {
    const store = setup({ selectedTags: nts(["a", "b"]), selectedWorkId: "work-1" });

    store.set(removeLibraryTagAtom, nt("a"));
    expect(lib(store)).toMatchObject({ selectedTags: ["b"], selectedWorkId: null });

    seedLibraryRoute(store, { selectedWorkId: "work-1" });
    store.set(clearLibraryTagsAtom);
    expect(lib(store)).toMatchObject({ selectedTags: [], selectedWorkId: null });
  });
});

describe("検索欄の入力（setLibrarySearchQueryAtom）", () => {
  it("作品一覧ならその一覧で検索する（replace）", () => {
    const store = setup({ folderId: "fav", selectedTags: nts(["ASMR"]) });
    clearPendingOps(store);

    store.set(setLibrarySearchQueryAtom, "藤田", "works");

    expect(lib(store)).toMatchObject({ folderId: "fav", q: "藤田", selectedTags: ["ASMR"] });
    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(store.get(libraryRouteAtom).q).toBe("藤田");
  });

  it("同じ検索語なら何もしない", () => {
    const store = setup({ q: "藤田" });
    clearPendingOps(store);

    store.set(setLibrarySearchQueryAtom, "藤田", "works");

    expect(pendingWrites(store)).toEqual([]);
  });

  it("値一覧では「すべて」の検索結果へ移る（push・チップなし）", () => {
    const store = setup({ folderId: "by-cv", group: null });
    clearPendingOps(store);

    store.set(setLibrarySearchQueryAtom, "藤田", "value-list");

    expect(lib(store)).toMatchObject({ folderId: "all", group: null, selectedTags: [], q: "藤田" });
    expect(pendingWrites(store)).toEqual(["push"]);
  });

  it("値一覧での空文字入力は何もしない", () => {
    const store = setup({ folderId: "by-cv", group: null });
    clearPendingOps(store);

    store.set(setLibrarySearchQueryAtom, "", "value-list");

    expect(lib(store).folderId).toBe("by-cv");
    expect(pendingWrites(store)).toEqual([]);
  });

  it("読めない行を保持しているときも「すべて」の検索結果へ移る", () => {
    const store = setup({ folderId: "sf-broken" });

    store.set(setLibrarySearchQueryAtom, "藤田", "broken");

    expect(lib(store)).toMatchObject({ folderId: "all", q: "藤田" });
  });
});

describe("0件時の「すべて」で探す（searchLibraryInAllAtom）", () => {
  it("同じチップと検索語のまま「すべて」へ移る。今の並びは捨てて新しい seed", () => {
    const store = setup({
      folderId: "fav",
      selectedTags: nts(["cv/藤田茜"]),
      q: "藤田",
      sort: "title-asc",
      seed: 3,
    });

    store.set(searchLibraryInAllAtom);

    expect(lib(store)).toMatchObject({
      folderId: "all",
      group: null,
      selectedTags: ["cv/藤田茜"],
      q: "藤田",
      sort: null,
    });
    expect(lib(store).seed).not.toBe(3);
    expect(pendingWrites(store)).toEqual(["push"]);
  });
});

describe("今の並びとランダムの seed", () => {
  it("setLibrarySortAtom は今の並びを replace で書く", () => {
    const store = setup();
    clearPendingOps(store);

    store.set(setLibrarySortAtom, "title-asc");

    expect(lib(store).sort).toBe("title-asc");
    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  it("同じ並びなら何もしない", () => {
    const store = setup({ sort: "title-asc" });
    clearPendingOps(store);

    store.set(setLibrarySortAtom, "title-asc");

    expect(pendingWrites(store)).toEqual([]);
  });

  it("clearLibrarySortAtom は保存を始めたときと同じフォルダー・同じ並びのときだけ今の並びを null に戻す", () => {
    const store = setup({ sort: "title-asc" });

    store.set(clearLibrarySortAtom, { folderId: "other", sort: "title-asc" });
    expect(lib(store).sort).toBe("title-asc");
    store.set(clearLibrarySortAtom, { folderId: "all", sort: "added-asc" });
    expect(lib(store).sort).toBe("title-asc");

    store.set(clearLibrarySortAtom, { folderId: "all", sort: "title-asc" });
    expect(lib(store).sort).toBeNull();

    clearPendingOps(store);
    store.set(clearLibrarySortAtom, { folderId: "all", sort: "title-asc" });
    expect(pendingWrites(store)).toEqual([]);
  });

  it("reshuffleLibrarySeedAtom は新しい seed を replace で入れ、今の並びは変えない", () => {
    const store = setup({ sort: "random", seed: 1 });
    clearPendingOps(store);

    store.set(reshuffleLibrarySeedAtom);

    expect(lib(store).seed).not.toBe(1);
    expect(lib(store).sort).toBe("random");
    expect(pendingWrites(store)).toEqual(["replace"]);
  });
});

describe("selectLibraryWorkAtom の履歴コミット種別", () => {
  it("未選択→選択は push（戻るで未選択に戻れるように）", () => {
    const store = createStore();

    store.set(selectLibraryWorkAtom, "work-1");

    expect(pendingWrites(store)).toEqual(["push"]);
  });

  it("選択→別作品への切替は replace", () => {
    const store = createStore();
    store.set(selectLibraryWorkAtom, "work-1");
    clearPendingOps(store);

    store.set(selectLibraryWorkAtom, "work-2");

    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  it("選択→解除は replace", () => {
    const store = createStore();
    store.set(selectLibraryWorkAtom, "work-1");
    clearPendingOps(store);

    store.set(selectLibraryWorkAtom, null);

    expect(pendingWrites(store)).toEqual(["replace"]);
  });
});
