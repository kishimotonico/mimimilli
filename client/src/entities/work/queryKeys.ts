export const WORK_QUERY_KEYS = {
  all: () => ["works"] as const,
  list: (params: object) => ["works", params] as const,
  total: () => ["works", "total"] as const,
  errorViewCount: () => ["works", "errorViewCount"] as const,
  missingCount: () => ["works", "missingCount"] as const,
  allDetails: () => ["work"] as const,
  detail: (id: string) => ["work", id] as const,
  allFacets: () => ["axisFacets"] as const,
  // filterParams: 自軸除外後の絞り込み。フィルタが変われば別クエリとして
  // キャッシュを分離する
  facets: (axis: string, filterParams: object = {}) => ["axisFacets", axis, filterParams] as const,
  // スマートフォルダー条件付きのファセット。smartFolderIdをaxisより上位に置き、
  // そのフォルダーの分だけをprefixで無効化できるようにする（通常のfacetsとは
  // 別系統。フォルダー保存・削除時にそのフォルダーのファセットだけ無効化する用途）
  scopedFacets: (smartFolderId: string, axis: string, filterParams: object = {}) =>
    ["axisFacets", "smartFolder", smartFolderId, axis, filterParams] as const,
  allScopedFacets: (smartFolderId: string) => ["axisFacets", "smartFolder", smartFolderId] as const,
  dlsiteNotifications: () => ["dlsiteNotifications"] as const,
  dlsiteNotificationSummary: () => ["dlsiteNotifications", "summary"] as const,
  dlsiteNotificationList: (kind: "rj-missing" | "fetch-failed" | "parse-failed") =>
    ["dlsiteNotifications", kind] as const,
} as const;
