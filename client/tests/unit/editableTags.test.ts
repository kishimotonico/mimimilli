import { describe, expect, it } from "vitest";
import { buildTagsWithAdded, buildTagsWithRemoved } from "../../src/entities/work/editableTags";

describe("editable work tags（全タグ編集対象・ADR-0005）", () => {
  it("構造化タグもフラットタグも追加できる（正規化して追加）", () => {
    expect(buildTagsWithAdded(["ASMR"], "CV/ 水瀬なずな ")).toEqual(["ASMR", "cv/水瀬なずな"]);
    expect(buildTagsWithAdded(["cv/水瀬なずな"], " 睡眠用 ")).toEqual(["cv/水瀬なずな", "睡眠用"]);
  });

  it("正規化後に重複するタグは追加できない（null）", () => {
    expect(buildTagsWithAdded(["cv/水瀬なずな"], "CV/水瀬なずな")).toBeNull();
    expect(buildTagsWithAdded(["ASMR"], " ASMR ")).toBeNull();
    expect(buildTagsWithAdded(["ASMR"], "   ")).toBeNull();
  });

  it("構造化タグも削除できる（prefix の大小は無視して一致）", () => {
    expect(buildTagsWithRemoved(["cv/水瀬なずな", "ASMR"], "CV/水瀬なずな")).toEqual(["ASMR"]);
    expect(buildTagsWithRemoved(["cv/水瀬なずな", "ASMR"], "ASMR")).toEqual(["cv/水瀬なずな"]);
  });

  it("編集結果は正規形（prefix 小文字・trim・重複排除）に揃う", () => {
    expect(buildTagsWithRemoved(["CV/x", "cv/x", " ASMR ", "癒し系"], "癒し系")).toEqual([
      "cv/x",
      "ASMR",
    ]);
  });
});
