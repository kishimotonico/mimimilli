// 作品一覧・値一覧はフォルダー ID を直後に置き、フォルダー単位で prefix 無効化できるようにする。
// params は結果を決める引数（条件・並び・シード・母集団）。変われば別クエリとして分離する。
export const SMART_FOLDER_QUERY_KEYS = {
  all: () => ["smartFolders"] as const,
  allWorks: () => ["smartFolderWorks"] as const,
  folderWorks: (id: string) => ["smartFolderWorks", id] as const,
  works: (id: string, params: object = {}) => ["smartFolderWorks", id, params] as const,
  allGroups: () => ["smartFolderGroups"] as const,
  folderGroups: (id: string) => ["smartFolderGroups", id] as const,
  groups: (id: string, groupByKey: string, params: object = {}) =>
    ["smartFolderGroups", id, groupByKey, params] as const,
} as const;
