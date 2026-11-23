import type {
  Condition,
  SmartFolder,
  SmartFolderPatch,
  SmartFolderViolation,
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
  /** position の昇順。読めない行が1つでもあれば UnreadableSmartFolderError を投げる */
  listSmartFolders(): Promise<SmartFolderRow[]>;
  getSmartFolder(id: string): Promise<SmartFolderRow | null>;
  /** ID が既にあれば null。position を渡すとその位置に入れ、埋まっていればその位置以降を後ろへ送る。省けば末尾 */
  insertSmartFolder(folder: SmartFolderInsert, position?: number): Promise<SmartFolderRow | null>;
  /** 送った列だけを更新する。ほかの列は触らない。今の行に重ねたできあがりの行を、読み出しと書き込みの
   *  1回の中で smartFolderViolation に通し、違反なら書かずに violation を返す。行がなければ null */
  updateSmartFolder(id: string, patch: SmartFolderPatch): Promise<SmartFolderUpdateResult | null>;
  /** 全件の順序を置き換える。渡された集合が今の集合と一致しなければ null */
  reorderSmartFolders(ids: string[]): Promise<SmartFolderRow[] | null>;
  deleteSmartFolder(id: string): Promise<boolean>;
}

export type SmartFolderUpdateResult = { row: SmartFolderRow } | { violation: SmartFolderViolation };

/** 件数を除いた一覧の1行 */
export type SmartFolderRow = Omit<SmartFolder, "count">;
/** 保存する行。読める行だけを書く */
export type SmartFolderInsert = Omit<SmartFolderRow, "condition" | "position"> & {
  condition: Condition;
};
