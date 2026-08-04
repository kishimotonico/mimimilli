export const SMART_FOLDER_QUERY_KEYS = {
  all: () => ["smartFolders"] as const,
  allWorks: () => ["smartFolderWorks"] as const,
  // filterParams: フォルダーのルールに対する追加フィルタ。フィルタが変われば
  // 別クエリとしてキャッシュを分離する
  works: (id: string, filterParams: object = {}) => ["smartFolderWorks", id, filterParams] as const,
} as const;
