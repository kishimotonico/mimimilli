import { describe, expect, it } from "vitest";
import { reconcileWorkEditSnapshot } from "../../src/features/library/model/workEditReconcile";

const base = { title: "元タイトル", tags: [], urls: [] };

describe("reconcileWorkEditSnapshot", () => {
  it("dirtyなフィールドでも、届いた値が現在のdraftと一致するなら衝突にしない（自分の保存の反映）", () => {
    const result = reconcileWorkEditSnapshot(
      base,
      { ...base, title: "編集後タイトル" },
      { title: true, tags: false, urls: false },
      { ...base, title: "編集後タイトル" },
    );
    expect(result.changedFields).toEqual(["title"]);
    expect(result.conflictFields).toEqual([]);
  });

  it("dirtyなフィールドの届いた値がdraftとも異なるなら衝突にする（真の外部変更）", () => {
    const result = reconcileWorkEditSnapshot(
      base,
      { ...base, title: "他人が変更したタイトル" },
      { title: true, tags: false, urls: false },
      { ...base, title: "自分の編集" },
    );
    expect(result.changedFields).toEqual(["title"]);
    expect(result.conflictFields).toEqual(["title"]);
  });

  it("非dirtyなフィールドが変わったら衝突にせず自動追従の対象にする", () => {
    const result = reconcileWorkEditSnapshot(
      base,
      { ...base, tags: ["新タグ"] },
      { title: false, tags: false, urls: false },
      base,
    );
    expect(result.changedFields).toEqual(["tags"]);
    expect(result.conflictFields).toEqual([]);
  });
});
