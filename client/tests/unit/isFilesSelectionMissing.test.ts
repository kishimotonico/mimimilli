import { describe, expect, it } from "vitest";
import { isFilesSelectionMissing } from "../../src/features/files/model/types";

const cwd = "dlsite/夜想曲スタジオ";
const entries = [{ path: "dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読" }];

describe("isFilesSelectionMissing", () => {
  it("選択パスが一覧に無ければtrue", () => {
    expect(
      isFilesSelectionMissing({
        hasLoadError: false,
        isPending: false,
        selectedPath: "dlsite/夜想曲スタジオ/nonexistent",
        cwd,
        entries,
      }),
    ).toBe(true);
  });

  it("選択パスが一覧にあればfalse", () => {
    expect(
      isFilesSelectionMissing({
        hasLoadError: false,
        isPending: false,
        selectedPath: entries[0]!.path,
        cwd,
        entries,
      }),
    ).toBe(false);
  });

  it("ディレクトリ取得が404・5xx・通信失敗（loadError）のときはfalse（そちらの表示を優先）", () => {
    expect(
      isFilesSelectionMissing({
        hasLoadError: true,
        isPending: false,
        selectedPath: "dlsite/夜想曲スタジオ/nonexistent",
        cwd,
        entries,
      }),
    ).toBe(false);
  });

  it("初回ロード中はfalse（一覧がまだ空なだけで誤検知しない）", () => {
    expect(
      isFilesSelectionMissing({
        hasLoadError: false,
        isPending: true,
        selectedPath: "dlsite/夜想曲スタジオ/nonexistent",
        cwd,
        entries: [],
      }),
    ).toBe(false);
  });

  it("選択が無いときはfalse", () => {
    expect(
      isFilesSelectionMissing({
        hasLoadError: false,
        isPending: false,
        selectedPath: null,
        cwd,
        entries,
      }),
    ).toBe(false);
  });

  it("選択がカレントディレクトリ自身（＝選択なし扱い）のときはfalse", () => {
    expect(
      isFilesSelectionMissing({
        hasLoadError: false,
        isPending: false,
        selectedPath: cwd,
        cwd,
        entries,
      }),
    ).toBe(false);
  });
});
