import type {
  DlsiteApplyBody,
  DlsiteBulkMode,
  DlsiteBulkApplyMissingResult,
  DlsiteBulkProgressEvent,
  DlsiteBulkResult,
  DlsiteFetchResult,
  DlsiteStatePatch,
  Work,
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
  ): Promise<boolean>;
  updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null>;
  dlsiteApplyMissing(workIds?: string[]): Promise<DlsiteBulkApplyMissingResult>;
  runDlsiteBulk(
    mode: DlsiteBulkMode,
    workIds: string[] | undefined,
    options?: {
      signal?: AbortSignal;
      onProgress?: (event: Extract<DlsiteBulkProgressEvent, { type: "progress" }>) => void;
    },
  ): Promise<DlsiteBulkResult>;
}
