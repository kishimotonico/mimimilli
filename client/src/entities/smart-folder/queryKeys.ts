export const SMART_FOLDER_QUERY_KEYS = {
  all: () => ["smartFolders"] as const,
  allWorks: () => ["smartFolderWorks"] as const,
  // filterParams: フォルダーのルールに対する追加フィルタ。フィルタが変われば
  // 別クエリとしてキャッシュを分離する
  works: (id: string, filterParams: object = {}) => ["smartFolderWorks", id, filterParams] as const,
  // rules をそのままキーに含める。同じ条件内容なら結果は決定的で、キャッシュを共有できる。
  // allWorks 配下に置き、スキャン・登録・解除による無効化（libraryInvalidation.ts）が
  // 件数プレビューにも及ぶようにする
  preview: (rules: object) => ["smartFolderWorks", "preview", rules] as const,
} as const;
