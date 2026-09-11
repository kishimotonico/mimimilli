// openPathInFilesAtom は要対応タブ（root相対パス）とエラー作品のwork.physicalPath
// （絶対パス）の両方から呼ばれる。絶対パスがroot相対へ正しく変換されることを固定する
// （work.physicalPathを素通ししてroot名が二重に混入するバグの回帰防止）。
import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  filesRelPathAtom,
  filesSelectedPathAtom,
  openPathInFilesAtom,
} from "../../src/entities/file-system/model/navigationAtoms";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";

describe("openPathInFilesAtom", () => {
  it("絶対パス（work.physicalPath相当）をrootで剥がしたroot相対パスへ変換する", () => {
    const store = createStore();
    store.set(openPathInFilesAtom, {
      path: "/library/dlsite/夜想曲スタジオ/RJ501010_朗読劇",
      root: "/library",
    });

    expect(store.get(appModeAtom)).toBe("files");
    expect(store.get(filesRelPathAtom)).toEqual(["dlsite", "夜想曲スタジオ"]);
    expect(store.get(filesSelectedPathAtom)).toBe("dlsite/夜想曲スタジオ/RJ501010_朗読劇");
  });

  it("すでにroot相対なパス（要対応タブ由来）はそのまま扱う", () => {
    const store = createStore();
    store.set(openPathInFilesAtom, {
      path: "dlsite/夜想曲スタジオ/RJ501010_朗読劇",
      root: "/library",
    });

    expect(store.get(filesRelPathAtom)).toEqual(["dlsite", "夜想曲スタジオ"]);
    expect(store.get(filesSelectedPathAtom)).toBe("dlsite/夜想曲スタジオ/RJ501010_朗読劇");
  });
});
