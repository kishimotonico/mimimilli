import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { gridInspectorOpenAtom, selectedWorkIdAtom } from "../../src/features/library/model/atoms";
import {
  clearLibraryTagsAtom,
  drillBackAtom,
  drillIntoAtom,
  selectLibraryWorkAtom,
  setLibraryAxisAtom,
  toggleLibraryTagAtom,
} from "../../src/features/library/model/libraryNavigationActions";

// TASK: 軸切替・ドリル・タグ操作でグリッド詳細パネルの開閉stateが引き継がれると、
// 別軸・別ドリル先で「未選択パネルが開いた状態」の WorkGrid がマウントされ、
// グリッド幅が意図せずジャンプする（ちらつきの原因）。ナビゲーション系アクションは
// パネルを必ず閉じることを確認する。

describe("ナビゲーション操作でグリッド詳細パネルを閉じる", () => {
  it("setLibraryAxisAtom はパネルを閉じる", () => {
    const store = createStore();
    store.set(gridInspectorOpenAtom, true);

    store.set(setLibraryAxisAtom, "circle");

    expect(store.get(gridInspectorOpenAtom)).toBe(false);
  });

  it("drillIntoAtom はパネルを閉じる", () => {
    const store = createStore();
    store.set(gridInspectorOpenAtom, true);

    store.set(drillIntoAtom, "藤田茜");

    expect(store.get(gridInspectorOpenAtom)).toBe(false);
  });

  it("drillBackAtom はパネルを閉じる", () => {
    const store = createStore();
    store.set(gridInspectorOpenAtom, true);

    store.set(drillBackAtom);

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
