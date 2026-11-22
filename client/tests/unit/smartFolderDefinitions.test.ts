import { describe, expect, it } from "vitest";
import type { GroupBy, TagPrefix } from "@mimimilli/shared";
import {
  buildGroupByRows,
  getGroupByIcon,
  getGroupByLabel,
  getSmartFolderIcon,
} from "../../src/entities/library/smartFolderDefinitions";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, protected: true },
  { prefix: "サークル", label: "サークル", color: null, protected: true },
];

describe("smartFolderDefinitions", () => {
  it("labels groupBy from prefix definitions and falls back to the raw prefix", () => {
    expect(getGroupByLabel({ kind: "prefix", prefix: "サークル" }, PREFIXES)).toBe("サークル");
    expect(getGroupByLabel({ kind: "prefix", prefix: "cv" }, PREFIXES)).toBe("CV");
    expect(getGroupByLabel({ kind: "prefix", prefix: "気分" }, PREFIXES)).toBe("気分"); // 未登録は prefix をそのまま
    expect(getGroupByLabel({ kind: "tag" })).toBe("タグ");
    expect(getGroupByLabel({ kind: "addedYear" })).toBe("追加日");
  });

  it("buildGroupByRows は定義済みの prefix 全部（定義順）＋タグ＋追加年（ADR-0041「＋絞り込み」）", () => {
    const rows = buildGroupByRows(PREFIXES);
    expect(rows.map((r) => r.groupBy)).toEqual([
      { kind: "prefix", prefix: "cv" },
      { kind: "prefix", prefix: "サークル" },
      { kind: "tag" },
      { kind: "addedYear" },
    ]);
    expect(rows[0]).toEqual({ groupBy: { kind: "prefix", prefix: "cv" }, name: "CV" });
    expect(rows.at(-1)).toEqual({ groupBy: { kind: "addedYear" }, name: "追加日" });
  });

  it("getSmartFolderIcon は条件のフォルダーを ID から、グループ分けのフォルダーをグループ分けから引き、未知の ID は既定のアイコン", () => {
    const folder = (id: string, groupBy: GroupBy | null = null) => ({ id, groupBy });
    expect(getSmartFolderIcon(folder("fav"))).toBe("star");
    expect(getSmartFolderIcon(folder("error"))).toBe("err");
    expect(getSmartFolderIcon(folder("random"))).toBe("shuffle");
    expect(getSmartFolderIcon(folder("sf-unknown"))).toBe("funnel");
    expect(getSmartFolderIcon(folder("by-circle", { kind: "prefix", prefix: "サークル" }))).toBe(
      "house",
    );
    expect(getSmartFolderIcon(folder("sf-user", { kind: "prefix", prefix: "気分" }))).toBe(
      "folder",
    );
    expect(getSmartFolderIcon(folder("by-year", { kind: "addedYear" }))).toBe("calendar");
  });

  it("値一覧の既定アイコンはサイドバーの行と同じ表から引く", () => {
    expect(getGroupByIcon({ kind: "prefix", prefix: "カテゴリ" })).toBe("steps");
    expect(getGroupByIcon({ kind: "tag" })).toBe("tag");
  });
});
