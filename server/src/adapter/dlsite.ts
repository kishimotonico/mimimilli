import type {
  DlsiteCachedCover,
  DlsiteApplyBody,
  DlsiteProductFetchOutcome,
  DlsiteFetchResult,
  DlsiteStateUpdateBody,
  DlsiteWorkFetchResult,
  WorkSourceMutationResult,
} from "@mimimilli/shared";

export interface DlsiteAdapter {
  /** force=true は失敗の記録と解析できないsnapshotを無視して取り直す。TTL内の解析できるsnapshotは使う */
  dlsiteFetch(
    workId: string,
    force?: boolean,
    options?: { signal?: AbortSignal },
  ): Promise<DlsiteWorkFetchResult>;
  /** 作品未登録時のプレビュー用。RJ/VJコードを直接指定して取得する。 */
  dlsiteFetchByCode(
    rjCode: string,
    force?: boolean,
    options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult>;
  /** キャッシュ済みのDLsite情報を適用する。DLsiteへは通信しない。使えるキャッシュが無い・版が違うときは DlsiteRefetchRequiredError */
  dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<WorkSourceMutationResult | null>;
  updateDlsiteState(
    workId: string,
    body: DlsiteStateUpdateBody,
  ): Promise<WorkSourceMutationResult | null>;
  /** DLsiteへ通信しない設定か。取得ジョブの開始可否に使う */
  isDlsiteOffline(): boolean;
  /** 取得ジョブが1コードずつ呼ぶ取得の本体。HTML取得・カバー先取り・同じRJコードの作品の投影更新まで行う */
  fetchDlsiteProduct(
    productCode: string,
    options: { force: boolean; signal?: AbortSignal },
  ): Promise<DlsiteProductFetchOutcome>;
  /** カバーURLに対応するキャッシュ済みカバー。キャッシュに無ければnull。DLsiteへは通信しない */
  lookupDlsiteCachedCover(coverUrl: string | null): DlsiteCachedCover | null;
  /** キャッシュ済みカバーの配信用。キャッシュに無ければnull。DLsiteへは通信しない */
  getCachedDlsiteCover(
    coverKey: string,
  ): { body: Uint8Array; contentType: string; version: number } | null;
}
