import { describe, expect, it } from "vitest";
import type { TagPrefix } from "@mimimilli/shared";
import {
  buildFacetAxisRows,
  getAxisLabel,
  getSmartFolderIcon,
} from "../../src/entities/library/axisDefinitions";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, protected: true },
  { prefix: "サークル", label: "サークル", color: null, protected: true },
];

describe("axisDefinitions", () => {
  it("labels axes from prefix definitions and falls back to the raw id", () => {
    expect(getAxisLabel("サークル", PREFIXES)).toBe("サークル");
    expect(getAxisLabel("cv", PREFIXES)).toBe("CV");
    expect(getAxisLabel("気分", PREFIXES)).toBe("気分"); // 未登録は ID をそのまま
    expect(getAxisLabel("tag")).toBe("タグ");
    expect(getAxisLabel("year")).toBe("追加日");
  });

  it("buildFacetAxisRows は定義済みの prefix 全部（定義順）＋タグ＋追加年（ADR-0041「＋絞り込み」）", () => {
    const rows = buildFacetAxisRows(PREFIXES);
    expect(rows.map((r) => r.id)).toEqual(["cv", "サークル", "tag", "year"]);
    expect(rows[0]).toEqual({ id: "cv", name: "CV", icon: "user" });
    expect(rows.at(-1)).toEqual({ id: "year", name: "追加日", icon: "refresh" });
  });

  it("getSmartFolderIcon は既定のスマートフォルダー ID から引き、未知の ID は既定のアイコン", () => {
    expect(getSmartFolderIcon("fav")).toBe("star");
    expect(getSmartFolderIcon("error")).toBe("err");
    expect(getSmartFolderIcon("sf-unknown")).toBe("gridS");
  });
});
