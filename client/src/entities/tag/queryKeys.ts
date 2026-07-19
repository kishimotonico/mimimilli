export const TAG_QUERY_KEYS = {
  all: () => ["tags"] as const,
  prefixes: () => ["tagPrefixes"] as const,
  prefixCandidates: () => ["tagPrefixes", "candidates"] as const,
} as const;
