// library feature の TanStack Query key factory。
// 一箇所で管理し、invalidation と依存を一致させる。

export const LIBRARY_KEYS = {
  allWorks: () => ["works"] as const,
  works: (params: object) => ["works", params] as const,
  libraryTotal: () => ["works", "total"] as const,
  allSmartFolderWorks: () => ["smartFolderWorks"] as const,
  smartFolderWorks: (id: string) => ["smartFolderWorks", id] as const,
  allFacets: () => ["axisFacets"] as const,
  facets: (axis: string) => ["axisFacets", axis] as const,
  smartFolders: () => ["smartFolders"] as const,
  workDetail: (id: string) => ["work", id] as const,
  tags: () => ["tags"] as const,
  tagPrefixes: () => ["tagPrefixes"] as const,
  tagPrefixCandidates: () => ["tagPrefixes", "candidates"] as const,
} as const;
