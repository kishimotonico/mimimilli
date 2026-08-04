export const WORK_QUERY_KEYS = {
  all: () => ["works"] as const,
  list: (params: object) => ["works", params] as const,
  total: () => ["works", "total"] as const,
  allDetails: () => ["work"] as const,
  detail: (id: string) => ["work", id] as const,
  allFacets: () => ["axisFacets"] as const,
  // filterParams: 自軸除外後の絞り込み（TASK-187）。フィルタが変われば別クエリとして
  // キャッシュを分離する
  facets: (axis: string, filterParams: object = {}) => ["axisFacets", axis, filterParams] as const,
  dlsiteNotifications: () => ["dlsiteNotifications"] as const,
  dlsiteNotificationSummary: () => ["dlsiteNotifications", "summary"] as const,
  dlsiteNotificationList: (kind: "rj-missing" | "fetch-failed" | "parse-failed") =>
    ["dlsiteNotifications", kind] as const,
} as const;
