export const SMART_FOLDER_QUERY_KEYS = {
  all: () => ["smartFolders"] as const,
  allWorks: () => ["smartFolderWorks"] as const,
  // filterParams: 条件・並び・シードなど結果を決める引数。変われば別クエリとして分離する
  works: (id: string, filterParams: object = {}) => ["smartFolderWorks", id, filterParams] as const,
} as const;
