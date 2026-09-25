import type {
  DlsiteApplyBody,
  DlsiteApplyMissingPreview,
  DlsiteBulkMode,
  DlsiteBulkApplyMissingResult,
  DlsiteBulkProgressSnapshot,
  DlsiteBulkResult,
  DlsiteFetchResult,
  DlsiteStateUpdateBody,
  WorkSourceMutationResult,
} from "@mimimilli/shared";

export interface DlsiteAdapter {
  /** force=true はキャッシュを無視して明示的に再取得する。 */
  dlsiteFetch(
    workId: string,
    force?: boolean,
    options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult>;
  /** 作品未登録時のプレビュー用。RJ/VJコードを直接指定して取得する。 */
  dlsiteFetchByCode(
    rjCode: string,
    force?: boolean,
    options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult>;
  dlsiteApply(
    workId: string,
    body: DlsiteApplyBody,
    options?: { signal?: AbortSignal },
  ): Promise<WorkSourceMutationResult | null>;
  updateDlsiteState(
    workId: string,
    body: DlsiteStateUpdateBody,
  ): Promise<WorkSourceMutationResult | null>;
  dlsiteApplyMissing(workIds?: string[]): Promise<DlsiteBulkApplyMissingResult>;
  /** dlsiteApplyMissing のdry-run。書き込みはせず、対象作品ごとの差分だけを返す */
  dlsiteApplyMissingPreview(workIds?: string[]): Promise<DlsiteApplyMissingPreview>;
  runDlsiteBulk(
    mode: DlsiteBulkMode,
    workIds: string[] | undefined,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: DlsiteBulkProgressSnapshot) => void;
    },
  ): Promise<DlsiteBulkResult>;
}
