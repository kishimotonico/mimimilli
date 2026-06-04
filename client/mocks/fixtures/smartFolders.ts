import type { SmartFolderMock } from "./types";

export function createInitialSmartFolders(now: string): SmartFolderMock[] {
  return [
    {
      id: "sf-1",
      name: "長時間 ASMR",
      rules: [
        { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
        { conjunction: "AND", field: "タグ", operator: "∋", values: ["ASMR", "環境音"] },
      ],
      sort: "added-desc",
      createdAt: now,
    },
    {
      id: "sf-2",
      name: "水瀬なずな 全件",
      rules: [
        { conjunction: "WHERE", field: "タグ", operator: "∋", values: ["cv/水瀬なずな"] },
      ],
      sort: "added-desc",
      createdAt: now,
    },
  ];
}
