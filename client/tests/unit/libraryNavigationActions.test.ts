import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  gridInspectorOpenAtom,
  selectedWorkIdAtom,
  selectedTagsAtom,
} from "../../src/features/library/model/atoms";
import {
  consumeNavigationHistoryCommitAtom,
  navigationHistoryCommitAtom,
} from "../../src/features/navigation/model/navigationHistoryAtoms";
import {
  clearLibraryTagsAtom,
  selectLibraryWorkAtom,
  setLibraryAxisAtom,
  toggleLibraryTagAtom,
} from "../../src/features/library/model/libraryNavigationActions";

// TASK: 軸切替・タグ操作でグリッド詳細パネルの開閉stateが引き継がれると、
// 別軸で「未選択パネルが開いた状態」の WorkGrid がマウントされ、
// グリッド幅が意図せずジャンプする（ちらつきの原因）。ナビゲーション系アクションは
// パネルを必ず閉じることを確認する。

describe("ナビゲーション操作でグリッド詳細パネルを閉じる", () => {
  it("setLibraryAxisAtom はパネルを閉じる", () => {
    const store = createStore();
    store.set(gridInspectorOpenAtom, true);

    store.set(setLibraryAxisAtom, "circle");

    expect(store.get(gridInspectorOpenAtom)).toBe(false);
  });

  it("toggleLibraryTagAtom はパネルを閉じる", () => {
    const store = createStore();
    store.set(gridInspectorOpenAtom, true);

    store.set(toggleLibraryTagAtom, "ASMR");

    expect(store.get(gridInspectorOpenAtom)).toBe(false);
  });

  it("clearLibraryTagsAtom はパネルを閉じる", () => {
    const store = createStore();
    store.set(gridInspectorOpenAtom, true);

    store.set(clearLibraryTagsAtom);

    expect(store.get(gridInspectorOpenAtom)).toBe(false);
  });

  it("selectLibraryWorkAtom（作品選択・解除）はパネルの開閉stateに触れない", () => {
    const store = createStore();
    store.set(gridInspectorOpenAtom, true);

    store.set(selectLibraryWorkAtom, "work-1");
    expect(store.get(gridInspectorOpenAtom)).toBe(true);

    store.set(selectLibraryWorkAtom, null);
    expect(store.get(gridInspectorOpenAtom)).toBe(true);
    expect(store.get(selectedWorkIdAtom)).toBeNull();
  });
});

describe("軸を切り替えても選択中のフィルタは維持される（ADR-0012 §1）", () => {
  it("setLibraryAxisAtom は selectedTagsAtom に触れない", () => {
    const store = createStore();
    store.set(selectedTagsAtom, ["cv/藤田茜"]);

    store.set(setLibraryAxisAtom, "サークル");

    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜"]);
  });
});

describe("toggleLibraryTagAtom は全軸共通のタグフィルタへの追加・解除として働く", () => {
  it("未選択のタグを追加する", () => {
    const store = createStore();

    store.set(toggleLibraryTagAtom, "cv/藤田茜");

    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜"]);
  });

  it("選択済みのタグは解除する", () => {
    const store = createStore();
    store.set(selectedTagsAtom, ["cv/藤田茜", "サークル/月白製作所"]);

    store.set(toggleLibraryTagAtom, "cv/藤田茜");

    expect(store.get(selectedTagsAtom)).toEqual(["サークル/月白製作所"]);
  });
});

describe("selectLibraryWorkAtom の履歴コミット種別", () => {
  it("未選択→選択は push（戻るでドリル済み・未選択に戻れるように）", () => {
    const store = createStore();
    expect(store.get(selectedWorkIdAtom)).toBeNull();

    store.set(selectLibraryWorkAtom, "work-1");

    expect(store.get(navigationHistoryCommitAtom).kind).toBe("push");
  });

  it("選択→別作品への切替は replace", () => {
    const store = createStore();
    store.set(selectLibraryWorkAtom, "work-1");
    store.set(consumeNavigationHistoryCommitAtom);

    store.set(selectLibraryWorkAtom, "work-2");

    expect(store.get(navigationHistoryCommitAtom).kind).toBe("replace");
  });

  it("選択→解除は replace", () => {
    const store = createStore();
    store.set(selectLibraryWorkAtom, "work-1");
    store.set(consumeNavigationHistoryCommitAtom);

    store.set(selectLibraryWorkAtom, null);

    expect(store.get(navigationHistoryCommitAtom).kind).toBe("replace");
  });
});
