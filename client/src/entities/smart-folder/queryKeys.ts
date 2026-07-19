export const SMART_FOLDER_QUERY_KEYS = {
  all: () => ["smartFolders"] as const,
  allWorks: () => ["smartFolderWorks"] as const,
  works: (id: string) => ["smartFolderWorks", id] as const,
} as const;
