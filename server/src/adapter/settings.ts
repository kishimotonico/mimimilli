import type {
  ScanDiagnostic,
  ScanCandidate,
  ScanCandidateRegisterItem,
  ScanCandidatesRegisterResponse,
  ScanProgressEvent,
  ScanResult,
  Settings,
} from "@mimimilli/shared";

export interface ScanOptions {
  /** true のとき fingerprint に関係なく全作品を再処理する（TASK-95） */
  full?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: ScanProgressEvent) => void;
}

/** 再設定状態はワークフローが合成するため、アダプタは永続値だけを返す。 */
export type StoredSettings = Omit<Settings, "rootReconfiguration">;

export interface SettingsAdapter {
  getSettings(): Promise<StoredSettings>;
  /** signal はジョブ取消用。 */
  scan(options?: ScanOptions): Promise<ScanResult>;
  listScanDiagnostics(): Promise<ScanDiagnostic[]>;
  listScanCandidates(): Promise<ScanCandidate[]>;
  registerScanCandidates(
    items: ScanCandidateRegisterItem[],
    onRegistered?: (workId: string) => void,
  ): Promise<ScanCandidatesRegisterResponse>;
  excludeScanCandidates(paths: string[]): Promise<void>;
  listScanCandidateExclusions(): Promise<string[]>;
  restoreScanCandidateExclusions(paths: string[]): Promise<void>;
}
