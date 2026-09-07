// TASK-428.15: スマートフォルダーのパンくずに対象名が表示されることの検証。

import { describe, expect, it } from "vitest";
import type { SmartFolder } from "@mimimilli/shared";
import { buildLibraryAddressPath } from "../../src/features/library/model/atoms";

function makeSmartFolder(overrides: Partial<SmartFolder> = {}): SmartFolder {
  return {
    id: "sf-1",
    name: "お気に入りASMR",
    rules: [],
    sort: "added-desc",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildLibraryAddressPath", () => {
  it("all軸はライブラリのみ", () => {
    expect(buildLibraryAddressPath("all", [], [])).toEqual(["ライブラリ"]);
  });

  it("スマートフォルダー軸はフォルダー名をセグメントにする", () => {
    const folder = makeSmartFolder();
    expect(buildLibraryAddressPath(`smart-${folder.id}`, [], [folder])).toEqual([
      "ライブラリ",
      folder.name,
    ]);
  });

  it("存在しないスマートフォルダーIDは汎用ラベルへ後退する", () => {
    expect(buildLibraryAddressPath("smart-missing", [], [])).toEqual([
      "ライブラリ",
      "スマートフォルダー",
    ]);
  });
});
