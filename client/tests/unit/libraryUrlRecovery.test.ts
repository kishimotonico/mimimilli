// TASK-428.15: 未登録軸・存在しないスマートフォルダーIDのURLからの復帰判定。
// 取得中・取得失敗中は「未登録かどうか判定できない」として復帰しないことを固定する
// （レビュー指摘: isPendingだけをガードにすると取得失敗時に正当なURLまで弾いていた）。

import { describe, expect, it } from "vitest";
import type { SmartFolder, TagPrefix } from "@mimimilli/shared";
import { resolveInvalidLibraryAxisMessage } from "../../src/features/library/model/libraryUrlRecovery";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, showAsAxis: true, protected: true, order: 0 },
];

const SMART_FOLDER: SmartFolder = {
  id: "sf-1",
  name: "長時間ASMR",
  rules: [],
  sort: "added-desc",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const SUCCESS = true;
const NOT_READY = false;

describe("resolveInvalidLibraryAxisMessage", () => {
  it("登録済みfacet軸は復帰しない", () => {
    expect(resolveInvalidLibraryAxisMessage("cv", SUCCESS, SUCCESS, PREFIXES, [])).toBeNull();
  });

  it("組み込みのyear軸は復帰しない", () => {
    expect(resolveInvalidLibraryAxisMessage("year", SUCCESS, SUCCESS, [], [])).toBeNull();
  });

  it("未登録のfacet軸は復帰メッセージを返す", () => {
    expect(resolveInvalidLibraryAxisMessage("気分", SUCCESS, SUCCESS, PREFIXES, [])).toBe(
      "指定された絞り込み軸が見つかりません。既定の一覧に戻りました",
    );
  });

  it("存在するスマートフォルダーIDは復帰しない", () => {
    expect(
      resolveInvalidLibraryAxisMessage(
        `smart-${SMART_FOLDER.id}`,
        SUCCESS,
        SUCCESS,
        [],
        [SMART_FOLDER],
      ),
    ).toBeNull();
  });

  it("存在しないスマートフォルダーIDは復帰メッセージを返す", () => {
    expect(resolveInvalidLibraryAxisMessage("smart-missing", SUCCESS, SUCCESS, [], [])).toBe(
      "指定されたスマートフォルダーが見つかりません。既定の一覧に戻りました",
    );
  });

  it("tagPrefixesが取得中・取得失敗中（isSuccess=false）なら未登録facet軸でも復帰しない", () => {
    expect(resolveInvalidLibraryAxisMessage("気分", NOT_READY, SUCCESS, [], [])).toBeNull();
  });

  it("smartFoldersが取得中・取得失敗中（isSuccess=false）なら存在しないスマートフォルダーIDでも復帰しない", () => {
    expect(
      resolveInvalidLibraryAxisMessage("smart-missing", SUCCESS, NOT_READY, [], []),
    ).toBeNull();
  });

  it("ビュー軸・tag軸・allは常に復帰しない", () => {
    expect(resolveInvalidLibraryAxisMessage("all", SUCCESS, SUCCESS, [], [])).toBeNull();
    expect(resolveInvalidLibraryAxisMessage("fav", SUCCESS, SUCCESS, [], [])).toBeNull();
    expect(resolveInvalidLibraryAxisMessage("tag", SUCCESS, SUCCESS, [], [])).toBeNull();
  });
});
