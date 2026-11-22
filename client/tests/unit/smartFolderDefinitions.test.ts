import { describe, expect, it } from "vitest";
import type { TagPrefix } from "@mimimilli/shared";
import {
  buildGroupByRows,
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
    expect(rows[0]).toEqual({
      groupBy: { kind: "prefix", prefix: "cv" },
      name: "CV",
      icon: "user",
    });
    expect(rows.at(-1)).toEqual({
      groupBy: { kind: "addedYear" },
      name: "追加日",
      icon: "refresh",
    });
  });

  it("getSmartFolderIcon は既定のスマートフォルダー ID から引き、未知の ID は既定のアイコン", () => {
    expect(getSmartFolderIcon("fav")).toBe("star");
    expect(getSmartFolderIcon("error")).toBe("err");
    expect(getSmartFolderIcon("random")).toBe("shuffle");
    expect(getSmartFolderIcon("sf-unknown")).toBe("funnel");
  });
});
