import type {
  DlsiteCoverSkipReason,
  DlsiteRegistrationApply,
  ScanCandidateDlsite,
  ScanCandidateFolder,
  ScanCandidateMissingWork,
  ScanDiagnostics,
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

/** スキャン実行の戻り値。候補プールは HTTP 契約の ScanResult とは分離する。 */
export type ScanExecutionResult = {
  result: ScanResult;
  candidatePool: ScanCandidateFolder[];
};

/** 公開するスキャンの結果。rootIdentity は走査したrootの同一性（candidateRootIdentity と同じ表現） */
export type ScanExecution = ScanExecutionResult & { rootIdentity: string };

/** 一覧・操作の対象にできる候補か。除外・登録済み（祖先を含む）・作品情報ファイルの有無を見る */
export type CandidateAvailability = (folder: ScanCandidateFolder) => boolean;

/** RJコードから、候補に載せるDLsite状態と行方不明作品を導く。DLsite状態は「取得中」を含まない */
export type CandidateDescriber = (rjCode: string | null) => {
  dlsite: ScanCandidateDlsite;
  missingWorks: ScanCandidateMissingWork[];
};

export interface SettingsAdapter {
  getSettings(): Promise<StoredSettings>;
  /** signal はジョブ取消用。 */
  scan(options?: ScanOptions): Promise<ScanExecution>;
  listScanDiagnostics(): Promise<ScanDiagnostics>;
  /** 現在のrootの同一性。root未設定・消失はnull */
  candidateRootIdentity(): Promise<string | null>;
  candidateAvailability(): Promise<CandidateAvailability>;
  describeCandidates(): Promise<CandidateDescriber>;
  /**
   * 候補フォルダー1件を作品として登録する。失敗は例外。
   * rjCode は登録に使うコード。空文字はRJコードなしの明示、nullは未指定。
   */
  registerCandidateFolder(
    folder: ScanCandidateFolder,
    rjCode: string | null,
    apply: DlsiteRegistrationApply,
  ): Promise<{ workId: string; coverSkipped: DlsiteCoverSkipReason | null }>;
  excludeScanCandidates(paths: string[]): Promise<void>;
  listScanCandidateExclusions(): Promise<string[]>;
  restoreScanCandidateExclusions(paths: string[]): Promise<void>;
}
