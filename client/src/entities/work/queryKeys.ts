export const WORK_QUERY_KEYS = {
  all: () => ["works"] as const,
  list: (params: object) => ["works", params] as const,
  total: () => ["works", "total"] as const,
  scanNewCount: () => ["works", "scanNewCount"] as const,
  missingCount: () => ["works", "missingCount"] as const,
  allDetails: () => ["work"] as const,
  detail: (id: string | null) => ["work", id] as const,
  source: (id: string) => ["work", id, "source"] as const,
  allGroupValues: () => ["groupValues"] as const,
  // スマートフォルダーの値一覧（グループ分けの値・「＋絞り込み」の候補）。folderId を groupByKey より
  // 上位に置き、フォルダー単位で prefix 無効化できるようにする。filterParams は母集団を決める引数
  scopedGroupValues: (smartFolderId: string, groupByKey: string, filterParams: object = {}) =>
    ["groupValues", "smartFolder", smartFolderId, groupByKey, filterParams] as const,
} as const;
