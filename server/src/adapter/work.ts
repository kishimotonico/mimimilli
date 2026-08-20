import type {
  DataIntegrityWarning,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  FileEntry,
  IdentityConflictReassignBody,
  ResumeBody,
  Work,
  WorkCreateBody,
  WorkPatch,
  WorkRegisterPreview,
  WorkspacePath,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";

export interface WorkAdapter {
  queryWorks(params: WorksQuery): Promise<WorksPage>;
  getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview | null>;
  createWork(body: WorkCreateBody): Promise<Work | null>;
  reassignIdentityConflict(body: IdentityConflictReassignBody): Promise<Work | null>;
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
  /** 更新後の Work を返す。存在しなければ null */
  patchWork(id: string, patch: WorkPatch): Promise<Work | null>;
  saveResume(id: string, body: ResumeBody): Promise<boolean>;
  touchLastPlayed(id: string): Promise<boolean>;
  listWorkFiles(id: string): Promise<FileEntry | null>;
  listTags(): Promise<string[]>;
  exportLibrary(): Promise<{ data: string; dataIntegrityWarning?: DataIntegrityWarning }>;
}
