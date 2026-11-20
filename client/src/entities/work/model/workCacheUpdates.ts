// 作品を変更する操作ごとの必須キャッシュ更新（ADR-0028）。画面はこの集合を知らずに済むよう、
// 変更の入口は workMutations.ts の hook か、ここの関数を直接呼ぶ。

import { hashKey, type Query, type QueryClient, type QueryKey } from "@tanstack/react-query";
import {
  canonicalDlsiteProductCode,
  type ScanCandidatesResponse,
  type Work,
  type WorkEditSnapshot,
  type WorkSourceMutationResult,
} from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../tag/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../file-system/queryKeys";
import { SCAN_QUERY_KEYS } from "../../scan/queryKeys";
import { refreshScanCandidates, SCAN_CANDIDATES_QUERY_KEY } from "../../scan/scanCandidatesCache";

async function invalidateLibraryViews(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() }),
    queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() }),
    queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.all() }),
    queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() }),
  ]);
}

async function invalidateRegistrationViews(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateLibraryViews(queryClient),
    queryClient.invalidateQueries({ queryKey: FILE_SYSTEM_QUERY_KEYS.all() }),
    queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.diagnostics() }),
    queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.last() }),
    refreshScanCandidates(queryClient).catch(() => {}),
  ]);
}

function invalidateWorkDetail(queryClient: QueryClient, workId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.detail(workId), exact: true });
}

function invalidateAllWorkDetails(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allDetails() });
}

function rememberSource(queryClient: QueryClient, snapshot: WorkEditSnapshot): void {
  queryClient.setQueryData(WORK_QUERY_KEYS.source(snapshot.id), snapshot);
}

async function updateCachesAfterSourceMutation(
  queryClient: QueryClient,
  result: WorkSourceMutationResult,
): Promise<void> {
  rememberSource(queryClient, result.snapshot);
  await Promise.all([
    invalidateWorkDetail(queryClient, result.snapshot.id),
    invalidateLibraryViews(queryClient),
    queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.diagnostics() }),
  ]);
}

function isWorkListQuery(query: Query): boolean {
  const [root, params] = query.queryKey;
  if (root === SMART_FOLDER_QUERY_KEYS.allWorks()[0]) return true;
  return root === WORK_QUERY_KEYS.all()[0] && typeof params === "object" && params !== null;
}

/** meta 編集（一括保存・タグ追加/削除・インラインタイトル・投影の再試行）の成功後 */
export function updateCachesAfterSourceEdit(
  queryClient: QueryClient,
  result: WorkSourceMutationResult,
): Promise<void> {
  return updateCachesAfterSourceMutation(queryClient, result);
}

/** 正本変更の失敗後。CAS 不一致なら最新の詳細を読み直す */
export function updateCachesAfterSourceEditFailure(
  queryClient: QueryClient,
  workId: string,
): Promise<void> {
  return invalidateWorkDetail(queryClient, workId);
}

export async function updateCachesAfterPlaybackPrepared(
  queryClient: QueryClient,
  work: Work,
): Promise<void> {
  queryClient.setQueryData(WORK_QUERY_KEYS.detail(work.id), work);
  await invalidateLibraryViews(queryClient);
}

/** excludedListKey は画面が apply で揃え済みの一覧。その key だけ無効化しない */
export async function updateCachesAfterBookmark(
  queryClient: QueryClient,
  change: { workId: string; bookmarked: boolean },
  excludedListKey: QueryKey | null = null,
): Promise<void> {
  queryClient.setQueryData<Work>(WORK_QUERY_KEYS.detail(change.workId), (prev) =>
    prev ? { ...prev, bookmarked: change.bookmarked } : prev,
  );
  const excludedHash = excludedListKey === null ? null : hashKey(excludedListKey);
  await queryClient.invalidateQueries({
    predicate: (query) => isWorkListQuery(query) && query.queryHash !== excludedHash,
  });
}

/** 登録（候補一括・Files 単体）の成功後 */
export function updateCachesAfterRegistration(queryClient: QueryClient): Promise<void> {
  return invalidateRegistrationViews(queryClient);
}

export async function updateCachesAfterLibraryScan(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateRegistrationViews(queryClient),
    invalidateAllWorkDetails(queryClient),
  ]);
}

export async function updateCachesAfterUnregistration(
  queryClient: QueryClient,
  workId: string,
): Promise<void> {
  await invalidateRegistrationViews(queryClient);
  // 表示中の詳細 observer が再描画で再取得しないよう、画面の後処理（選択解除）の直前に削除する
  queryClient.removeQueries({ queryKey: WORK_QUERY_KEYS.detail(workId) });
}

/** 作品単位の読み直し（データ不整合の解消）の成功後 */
export async function updateCachesAfterWorkReload(
  queryClient: QueryClient,
  workId: string,
): Promise<void> {
  await Promise.all([
    invalidateRegistrationViews(queryClient),
    invalidateWorkDetail(queryClient, workId),
    queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.source(workId), exact: true }),
  ]);
}

export async function updateCachesAfterMissingUnregistration(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    invalidateRegistrationViews(queryClient),
    invalidateAllWorkDetails(queryClient),
  ]);
}

export async function updateCachesAfterIdentityReassign(
  queryClient: QueryClient,
  result: WorkSourceMutationResult,
): Promise<void> {
  rememberSource(queryClient, result.snapshot);
  await Promise.all([
    invalidateAllWorkDetails(queryClient),
    invalidateRegistrationViews(queryClient),
  ]);
}

/** DLsite 単体（コード保存・連携しない切替・情報適用）の成功後 */
export function updateCachesAfterDlsiteLinkageChange(
  queryClient: QueryClient,
  result: WorkSourceMutationResult,
): Promise<void> {
  return updateCachesAfterSourceMutation(queryClient, result);
}

function isWorkDetailQuery(query: Query): boolean {
  const key = query.queryKey;
  return key[0] === WORK_QUERY_KEYS.allDetails()[0] && key.length === 2;
}

/** DLsite取得ジョブの終端後。同じRJコードの作品の詳細と、ライブラリ一覧（RJコードで絞れないので一式）を無効化する */
export async function updateCachesAfterDlsiteFetch(
  queryClient: QueryClient,
  productCodes: readonly string[],
): Promise<void> {
  if (productCodes.length === 0) return;
  const codes = new Set(productCodes.map(canonicalDlsiteProductCode));
  await Promise.all([
    queryClient.invalidateQueries({
      predicate: (query) => {
        if (!isWorkDetailQuery(query)) return false;
        const rjCode = (query.state.data as Work | undefined)?.dlsite?.rjCode;
        return typeof rjCode === "string" && codes.has(canonicalDlsiteProductCode(rjCode));
      },
    }),
    invalidateLibraryViews(queryClient),
    queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.diagnostics() }),
  ]);
}

/** DLsiteの同期取得（作品詳細の取得・Filesの取得）の終了後。成否にかかわらず、同じRJコードの作品を無効化し、
 *  キャッシュ済みの候補一覧にそのRJコードの候補があるときだけ候補一覧を取り直す */
export async function updateCachesAfterDlsiteSyncFetch(
  queryClient: QueryClient,
  rjCode: string,
): Promise<void> {
  const code = canonicalDlsiteProductCode(rjCode);
  const cached =
    queryClient.getQueryData<ScanCandidatesResponse>(SCAN_CANDIDATES_QUERY_KEY)?.candidates ?? [];
  const hasCandidate = cached.some(
    (candidate) =>
      candidate.rjCode !== null && canonicalDlsiteProductCode(candidate.rjCode) === code,
  );
  await Promise.allSettled([
    hasCandidate ? refreshScanCandidates(queryClient) : Promise.resolve(),
    updateCachesAfterDlsiteFetch(queryClient, [rjCode]),
  ]);
}
