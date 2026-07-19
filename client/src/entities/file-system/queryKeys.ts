export const FILE_SYSTEM_QUERY_KEYS = {
  directory: (path: string) => ["fs", path] as const,
} as const;
