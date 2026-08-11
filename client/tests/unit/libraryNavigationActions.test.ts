import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  selectedWorkIdAtom,
  selectedTagsAtom,
} from "../../src/entities/library/model/navigationAtoms";
import { nt, nts } from "../helpers/tag";
import {
  consumeNavigationHistoryCommitAtom,
  navigationHistoryCommitAtom,
} from "../../src/shared/model/navigationHistoryAtoms";
import { activeAxisAtom } from "../../src/entities/library/model/navigationAtoms";
import {
  addLibraryTagAtom,
  clearLibraryTagsAtom,
  replaceLibraryTagAtom,
  selectLibraryWorkAtom,
  selectSoleLibraryTagAtom,
  setLibraryAxisAtom,
  toggleLibraryTagAtom,
} from "../../src/entities/library/model/navigationActions";

describe("ナビゲーション操作は選択中の作品をクリアする", () => {
  it("setLibraryAxisAtom は選択中の作品をクリアする", () => {
    const store = createStore();
    store.set(selectedWorkIdAtom, "work-1");

    store.set(setLibraryAxisAtom, "circle");

    expect(store.get(selectedWorkIdAtom)).toBeNull();
  });

  it("toggleLibraryTagAtom は選択中の作品をクリアする", () => {
    const store = createStore();
    store.set(selectedWorkIdAtom, "work-1");

    store.set(toggleLibraryTagAtom, nt("ASMR"));

    expect(store.get(selectedWorkIdAtom)).toBeNull();
  });

  it("clearLibraryTagsAtom は選択中の作品をクリアする", () => {
    const store = createStore();
    store.set(selectedWorkIdAtom, "work-1");

    store.set(clearLibraryTagsAtom);

    expect(store.get(selectedWorkIdAtom)).toBeNull();
  });
});

describe("軸を切り替えても選択中のフィルタは維持される（ADR-0012 §1）", () => {
  it("setLibraryAxisAtom は selectedTagsAtom に触れない", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["cv/藤田茜"]));

    store.set(setLibraryAxisAtom, "サークル");

    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜"]);
  });
});

describe("toggleLibraryTagAtom は全軸共通のタグフィルタへの追加・解除として働く", () => {
  it("未選択のタグを追加する", () => {
    const store = createStore();

    store.set(toggleLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜"]);
  });

  it("選択済みのタグは解除する", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["cv/藤田茜", "サークル/月白製作所"]));

    store.set(toggleLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(selectedTagsAtom)).toEqual(["サークル/月白製作所"]);
  });
});

describe("toggleLibraryTagAtom: year は単一選択（別の年を選ぶと前の選択を置き換える）", () => {
  it("別の年を追加すると前の年の選択を取り除いてから追加する", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["cv/藤田茜", "@year/2023"]));

    store.set(toggleLibraryTagAtom, nt("@year/2024"));

    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜", "@year/2024"]);
  });

  it("同じ年をもう一度選ぶとトグルとして解除する", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["@year/2024"]));

    store.set(toggleLibraryTagAtom, nt("@year/2024"));

    expect(store.get(selectedTagsAtom)).toEqual([]);
  });

  it("実タグ year/2025（予約文字なし）は単一選択の対象にならず通常のタグとして共存する", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["year/2025"]));

    store.set(toggleLibraryTagAtom, nt("@year/2024"));

    expect(store.get(selectedTagsAtom)).toEqual(["year/2025", "@year/2024"]);
  });
});

describe("selectSoleLibraryTagAtom: 作品詳細のタグクリックはタグ軸へ切り替えつつそのタグだけを選択する", () => {
  it("既存の絞り込み・軸が何であってもそのタグだけを選択した状態になる", () => {
    const store = createStore();
    store.set(activeAxisAtom, "circle");
    store.set(selectedTagsAtom, nts(["cv/藤田茜", "サークル/月白製作所"]));

    store.set(selectSoleLibraryTagAtom, nt("genre/ASMR"));

    expect(store.get(activeAxisAtom)).toBe("tag");
    expect(store.get(selectedTagsAtom)).toEqual(["genre/ASMR"]);
  });

  it("選択中の作品をクリアする", () => {
    const store = createStore();
    store.set(selectedWorkIdAtom, "work-1");

    store.set(selectSoleLibraryTagAtom, nt("genre/ASMR"));

    expect(store.get(selectedWorkIdAtom)).toBeNull();
  });
});

describe("置き換え選択は作品一覧へ進み、AND追加は現在地に留まる（ADR-0012 §7・§8）", () => {
  it("replaceLibraryTagAtom: 値一覧の軸から選ぶと結果面が作品一覧（all）へ切り替わる", () => {
    const store = createStore();
    store.set(activeAxisAtom, "cv");

    store.set(replaceLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(activeAxisAtom)).toBe("all");
    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜"]);
  });

  it("replaceLibraryTagAtom: 既に作品一覧（ビュー軸）ならそのまま維持する", () => {
    const store = createStore();
    store.set(activeAxisAtom, "recent");

    store.set(replaceLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(activeAxisAtom)).toBe("recent");
  });

  it("replaceLibraryTagAtom: 既に作品一覧（スマートフォルダー軸）ならそのまま維持する", () => {
    const store = createStore();
    store.set(activeAxisAtom, "smart-1");

    store.set(replaceLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(activeAxisAtom)).toBe("smart-1");
  });

  it("replaceLibraryTagAtom: prefix・軸に関係なく既存選択を全て外して1つだけにする（完全置換）", () => {
    const store = createStore();
    store.set(activeAxisAtom, "cv");
    store.set(selectedTagsAtom, nts(["cv/藤田茜", "サークル/月白製作所"]));

    store.set(replaceLibraryTagAtom, nt("cv/霧島レイ"));

    expect(store.get(selectedTagsAtom)).toEqual(["cv/霧島レイ"]);
  });

  it("toggleLibraryTagAtom（AND追加）は軸を変えない", () => {
    const store = createStore();
    store.set(activeAxisAtom, "cv");

    store.set(toggleLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(activeAxisAtom)).toBe("cv");
    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜"]);
  });
});

describe("addLibraryTagAtom は追加ボタン用の冪等なAND追加として働く（ADR-0013）", () => {
  it("未選択のタグを追加する", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["サークル/月白製作所"]));

    store.set(addLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(selectedTagsAtom)).toEqual(["サークル/月白製作所", "cv/藤田茜"]);
  });

  it("選択済みのタグは何もしない（解除しない）", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["cv/藤田茜", "サークル/月白製作所"]));

    store.set(addLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜", "サークル/月白製作所"]);
  });

  it("選択済みのタグを追加しても履歴コミットは走らせない", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["cv/藤田茜"]));
    store.set(consumeNavigationHistoryCommitAtom);
    const before = store.get(navigationHistoryCommitAtom);

    store.set(addLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(navigationHistoryCommitAtom)).toEqual(before);
  });

  it("組み込み擬似タグ軸は同軸排他してから追加する（year等）", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["cv/藤田茜", "@year/2023"]));

    store.set(addLibraryTagAtom, nt("@year/2024"));

    expect(store.get(selectedTagsAtom)).toEqual(["cv/藤田茜", "@year/2024"]);
  });

  it("選択中の作品をクリアする", () => {
    const store = createStore();
    store.set(selectedWorkIdAtom, "work-1");

    store.set(addLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(selectedWorkIdAtom)).toBeNull();
  });

  it("選択済みのタグを追加しても選択中の作品はクリアしない", () => {
    const store = createStore();
    store.set(selectedTagsAtom, nts(["cv/藤田茜"]));
    store.set(selectedWorkIdAtom, "work-1");

    store.set(addLibraryTagAtom, nt("cv/藤田茜"));

    expect(store.get(selectedWorkIdAtom)).toBe("work-1");
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
