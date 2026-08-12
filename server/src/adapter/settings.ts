import type {
  ScanDiagnostic,
  ScanProgressEvent,
  ScanResult,
  Settings,
  SettingsUpdate,
} from "@mimimilli/shared";

export interface ScanOptions {
  /** true のとき fingerprint に関係なく全作品を再処理する（TASK-95） */
  full?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: ScanProgressEvent) => void;
}

export interface SettingsAdapter {
  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsUpdate): Promise<Settings>;
  /** signal はジョブ取消用。 */
  scan(options?: ScanOptions): Promise<ScanResult>;
  listScanDiagnostics(): Promise<ScanDiagnostic[]>;
}
