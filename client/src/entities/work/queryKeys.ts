export const WORK_QUERY_KEYS = {
  all: () => ["works"] as const,
  list: (params: object) => ["works", params] as const,
  total: () => ["works", "total"] as const,
  scanNewCount: () => ["works", "scanNewCount"] as const,
  missingCount: () => ["works", "missingCount"] as const,
  allDetails: () => ["work"] as const,
  detail: (id: string | null) => ["work", id] as const,
  source: (id: string) => ["work", id, "source"] as const,
} as const;
