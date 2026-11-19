import type {
  ScanDiagnostics,
  ScanCandidate,
  ScanCandidateRegisterItem,
  ScanCandidatesRegisterResponse,
  ScanProgressEvent,
  ScanResult,
  Settings,
} from "@mimimilli/shared";

export interface ScanOptions {
  /** true のとき fingerprint に関係なく全作品を再処理する */
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
  listScanDiagnostics(): Promise<ScanDiagnostics>;
  /** DLsite状態は「取得中」を含まない（取得ジョブの状態はサーバー層が重ねる） */
  listScanCandidates(): Promise<ScanCandidate[]>;
  /** 候補のRJコードを直す。nullはRJコードなしの明示。候補が一覧に無ければ CandidatePoolChangedError */
  setScanCandidateRjCode(path: string, rjCode: string | null): Promise<ScanCandidate>;
  registerScanCandidates(
    items: ScanCandidateRegisterItem[],
  ): Promise<ScanCandidatesRegisterResponse>;
  excludeScanCandidates(paths: string[]): Promise<void>;
  listScanCandidateExclusions(): Promise<string[]>;
  restoreScanCandidateExclusions(paths: string[]): Promise<void>;
}
