export const WORK_QUERY_KEYS = {
  all: () => ["works"] as const,
  list: (params: object) => ["works", params] as const,
  total: () => ["works", "total"] as const,
  allDetails: () => ["work"] as const,
  detail: (id: string) => ["work", id] as const,
  allFacets: () => ["axisFacets"] as const,
  facets: (axis: string) => ["axisFacets", axis] as const,
  dlsiteNotifications: () => ["dlsiteNotifications"] as const,
  dlsiteNotificationSummary: () => ["dlsiteNotifications", "summary"] as const,
  dlsiteNotificationList: (kind: "rj-missing" | "fetch-failed") =>
    ["dlsiteNotifications", kind] as const,
} as const;
