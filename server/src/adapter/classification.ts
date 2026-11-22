import type {
  Condition,
  SmartFolder,
  SmartFolderWrite,
  SortId,
  TagPrefix,
  TagPrefixCandidate,
  TagPrefixCreate,
  TagPrefixUpdate,
} from "@mimimilli/shared";

export interface ClassificationAdapter {
  listTagPrefixes(): Promise<TagPrefix[]>;
  /** 既存の prefix と重複する場合は null（ルートが 409 を返す） */
  createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null>;
  updateTagPrefix(prefix: string, patch: TagPrefixUpdate): Promise<TagPrefix | null>;
  /** 登録済み全 prefix を渡された順序でアトミックに並び替える。渡された集合が現在の
   *  登録済み prefix 集合と一致しない場合は null（ルートが 400 を返す） */
  reorderTagPrefixes(order: string[]): Promise<TagPrefix[] | null>;
  deleteTagPrefix(prefix: string): Promise<boolean>;
  listTagPrefixCandidates(): Promise<TagPrefixCandidate[]>;
  /** position の昇順。読めない行は condition・sort・groupBy が null の壊れた行で返す */
  listSmartFolders(): Promise<SmartFolderRow[]>;
  getSmartFolder(id: string): Promise<SmartFolderRow | null>;
  /** 末尾へ追加する。ID が既にあれば null */
  appendSmartFolder(folder: SmartFolderInsert): Promise<SmartFolderRow | null>;
  /** 同じ ID・位置・作成日時で戻す。位置が埋まっていればその位置以降を後ろへ送る。ID が既にあれば null */
  restoreSmartFolder(
    folder: SmartFolderInsert & { position: number },
  ): Promise<SmartFolderRow | null>;
  updateSmartFolder(id: string, input: SmartFolderWrite): Promise<SmartFolderRow | null>;
  /** 既定の並びの列だけを更新する。ほかの列は触らない */
  updateSmartFolderSort(id: string, sort: SortId | null): Promise<SmartFolderRow | null>;
  /** 全件の順序を置き換える。渡された集合が今の集合と一致しなければ null */
  reorderSmartFolders(ids: string[]): Promise<SmartFolderRow[] | null>;
  deleteSmartFolder(id: string): Promise<boolean>;
}

/** 件数を除いた一覧の1行 */
export type SmartFolderRow = Omit<SmartFolder, "count">;
/** 保存する行。読める行だけを書く */
export type SmartFolderInsert = Omit<SmartFolderRow, "condition" | "position"> & {
  condition: Condition;
};
