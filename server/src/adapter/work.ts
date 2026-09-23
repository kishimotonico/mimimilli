import type {
  DataIntegrityWarning,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  IdentityConflictReassignBody,
  NormalizedTag,
  ResumeBody,
  Work,
  WorkBookmarkPatch,
  WorkBookmarkResult,
  WorkCreateBody,
  WorkEditSnapshot,
  WorkRegisterPreview,
  WorkSourceMutationResult,
  WorkSourcePatch,
  WorkspacePath,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";

/** 投影前に catalog 行が無く、今回 published になった新規登録の完了。HTTP 応答には載せない。 */
export type WorkSourceProjectionResult = WorkSourceMutationResult & {
  catalogInserted?: true;
};

export interface WorkAdapter {
  queryWorks(params: WorksQuery): Promise<WorksPage>;
  getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview | null>;
  createWork(body: WorkCreateBody): Promise<WorkSourceMutationResult | null>;
  reassignIdentityConflict(
    body: IdentityConflictReassignBody,
  ): Promise<WorkSourceMutationResult | null>;
  projectWorkSource(path: WorkspacePath): Promise<WorkSourceProjectionResult | null>;
  /** 作品を DB とメタファイルから削除する。物理ファイルは触らない。存在しなければ false */
  deleteWork(id: string): Promise<boolean>;
  /** status === "missing" の作品数 */
  countMissingWorks(): Promise<number>;
  /** status === "missing" の作品を全件登録解除する。一部失敗しても残りを続行する */
  unregisterMissingWorks(): Promise<{ deletedCount: number; failedCount: number }>;
  getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary>;
  queryDlsiteNotifications(
    kind: DlsiteNotificationKind,
    query: Required<DlsiteNotificationQuery>,
  ): Promise<DlsiteNotificationPage>;
  getWork(id: string): Promise<Work | null>;
  /** 再生準備。対象作品を live probe し、総時間を catalog へ公開する。存在しなければ null */
  prepareWorkPlayback(id: string): Promise<Work | null>;
  getWorkEditSnapshot(id: string): Promise<WorkEditSnapshot | null>;
  /** 正本の部分更新。存在しなければ null */
  patchWorkSource(id: string, patch: WorkSourcePatch): Promise<WorkSourceMutationResult | null>;
  patchWorkBookmark(id: string, patch: WorkBookmarkPatch): Promise<WorkBookmarkResult | null>;
  addWorkTag(id: string, tag: NormalizedTag): Promise<WorkSourceMutationResult | null>;
  removeWorkTag(id: string, tag: NormalizedTag): Promise<WorkSourceMutationResult | null>;
  saveResume(id: string, body: ResumeBody): Promise<boolean>;
  touchLastPlayed(id: string): Promise<boolean>;
  listTags(): Promise<string[]>;
  exportLibrary(): Promise<{ data: string; dataIntegrityWarning?: DataIntegrityWarning }>;
}
