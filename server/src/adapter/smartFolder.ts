import type { SmartFolder, SmartFolderPatch, SmartFolderViolation } from "@mimimilli/shared";

export interface SmartFolderAdapter {
  /** position の昇順。読めない行が1つでもあれば UnreadableSmartFolderError を投げる */
  listSmartFolders(): Promise<SmartFolder[]>;
  getSmartFolder(id: string): Promise<SmartFolder | null>;
  /** ID が既にあれば null。position を渡すとその位置に入れ、埋まっていればその位置以降を後ろへ送る。省けば末尾 */
  insertSmartFolder(folder: SmartFolderInsert, position?: number): Promise<SmartFolder | null>;
  /** 送った列だけを更新する。ほかの列は触らない。今の行に重ねたできあがりの行を、読み出しと書き込みの
   *  1回の中で smartFolderViolation に通し、違反なら書かずに violation を返す。行がなければ null */
  updateSmartFolder(id: string, patch: SmartFolderPatch): Promise<SmartFolderUpdateResult | null>;
  /** 全件の順序を置き換える。渡された集合が今の集合と一致しなければ null */
  reorderSmartFolders(ids: string[]): Promise<SmartFolder[] | null>;
  deleteSmartFolder(id: string): Promise<boolean>;
}

export type SmartFolderUpdateResult = { row: SmartFolder } | { violation: SmartFolderViolation };

/** 保存する行。読める行だけを書く */
export type SmartFolderInsert = Omit<SmartFolder, "position">;
