import { describe, expect, it } from "vitest";
import { getDlsiteInvalidationKeys } from "../../src/features/library/model/dlsiteInvalidation";

describe("getDlsiteInvalidationKeys", () => {
  it("手動適用では対象作品の詳細を含める", () => {
    expect(getDlsiteInvalidationKeys("work-1")).toContainEqual(["work", "work-1"]);
  });

  it("一括適用では全作品詳細のプレフィックスを含める", () => {
    expect(getDlsiteInvalidationKeys()).toContainEqual(["work"]);
  });

  it("一括取得の完了時: 処理対象workIdの配列を渡すと、それぞれの詳細だけを含め全作品のプレフィックスは含めない", () => {
    const keys = getDlsiteInvalidationKeys(["work-1", "work-2"]);
    expect(keys).toContainEqual(["work", "work-1"]);
    expect(keys).toContainEqual(["work", "work-2"]);
    expect(keys).not.toContainEqual(["work"]);
  });

  it("処理対象が0件（空配列）なら詳細系のキーを一切含めない（無関係な作品の再フェッチを起こさない）", () => {
    const keys = getDlsiteInvalidationKeys([]);
    expect(keys.some((key) => key[0] === "work")).toBe(false);
    // 一覧・ファセット・タグ等の系統は引き続き無効化する
    expect(keys).toContainEqual(["works"]);
  });
});
