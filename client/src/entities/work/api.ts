// work entity の API。単一作品の取得・更新と、作品に紐づくリソース（カバー画像・音声・
// ファイル一覧・DLsite メタデータ）を扱う。
// 依存方向: shared/api/http と自 entity の model のみを参照する。

import {
  API_BASE,
  getParsed,
  patchParsed,
  postParsed,
  postVoid,
  deleteParsed,
} from "../../shared/api/http";
import {
  workSchema,
  worksPageSchema,
  dlsitePreviewSchema,
  dlsiteBulkStartResponseSchema,
  dlsiteBulkApplyMissingResultSchema,
  dlsiteBulkCancelResponseSchema,
  dlsiteBulkSnapshotSchema,
  createRandomSeed,
  type DlsiteBulkSnapshot,
  type Work,
  dlsiteNotificationPageSchema,
  dlsiteNotificationSummarySchema,
  type DlsiteNotificationKind,
  type DlsiteNotificationPage,
  type DlsiteNotificationSummary,
  type WorkPatchInput,
  type DlsitePreview,
  type DlsiteApplyBody,
  type DlsiteStatePatch,
  type ResumeBody,
  type WorksPage,
  type WorksQueryInput,
} from "@mimimilli/shared";

function appendTagsTagOp(
  params: URLSearchParams,
  filter: { tags?: string[]; tagOp?: "AND" | "OR" },
): void {
  for (const tag of filter.tags ?? []) params.append("tags", tag);
  if (filter.tagOp) params.set("tagOp", filter.tagOp);
}

/** クエリ文字列は「未指定」と「空配列」を区別できないため、ids:[] は空集合として
 *  リクエストせずに返す（core の filterByIds・real SQL と同じセマンティクス） */
function emptyIdsPage(params: WorksQueryInput): WorksPage {
  const stats = { trackCount: 0, durationSec: 0 };
  if (params.sort !== "random") return { items: [], total: 0, stats };
  const seed = params.seed === undefined ? createRandomSeed() : Number(params.seed);
  return { items: [], total: 0, stats, seed };
}

export async function searchWorks(
  params: WorksQueryInput,
  options?: { signal?: AbortSignal },
): Promise<WorksPage> {
  if (params.ids?.length === 0) return emptyIdsPage(params);
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  appendTagsTagOp(p, params);
  if (params.view) p.set("view", params.view);
  if (params.sort) p.set("sort", params.sort);
  if (params.seed !== undefined) p.set("seed", String(params.seed));
  if (params.page !== undefined) p.set("page", String(params.page));
  if (params.limit !== undefined) p.set("limit", String(params.limit));
  for (const id of params.ids ?? []) p.append("ids", id);
  const q = p.toString();
  return getParsed(worksPageSchema, `/works${q ? `?${q}` : ""}`, options);
}

/** GET /works/:id は存在しない場合404を返す契約。呼び出し側はnull分岐でなくエラー（TanStack QueryのisError等）で扱う */
export async function getWork(id: string): Promise<Work> {
  return getParsed(workSchema, `/works/${encodeURIComponent(id)}`);
}

export async function getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary> {
  return getParsed(dlsiteNotificationSummarySchema, "/dlsite/notifications");
}

export async function queryDlsiteNotifications(
  kind: DlsiteNotificationKind,
  params: { page: number; limit: number },
): Promise<DlsiteNotificationPage> {
  const query = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  return getParsed(dlsiteNotificationPageSchema, `/dlsite/notifications/${kind}?${query}`);
}

export async function patchWork(workId: string, body: WorkPatchInput): Promise<Work> {
  return patchParsed(workSchema, `/works/${encodeURIComponent(workId)}`, body);
}

/** カバー画像のURLを返す（<img src> で直接使用可）。
 *  width を指定すると `?w=` でサムネイル幅を要求する（サーバー側で許可幅へ正規化される） */
export function getCoverImageUrl(workId: string, width?: number): string {
  const query = width === undefined ? "" : `?w=${encodeURIComponent(width)}`;
  return `${API_BASE}/media/cover/${encodeURIComponent(workId)}${query}`;
}

/** 音声ファイルのURLを返す（<audio src> で直接使用可） */
export function getAudioUrl(workId: string, relativePath: string): string {
  const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE}/media/audio/${encodeURIComponent(workId)}/${encoded}`;
}

export async function updateLastPlayed(workId: string): Promise<void> {
  await postVoid(`/works/${encodeURIComponent(workId)}/last-played`);
}

export async function saveResumePosition(workId: string, resume: ResumeBody): Promise<void> {
  await postVoid(`/works/${encodeURIComponent(workId)}/resume`, resume);
}

export async function fetchDlsiteInfo(workId: string): Promise<DlsitePreview> {
  return postParsed(dlsitePreviewSchema, `/dlsite/${encodeURIComponent(workId)}/fetch`);
}

export async function applyDlsiteInfo(workId: string, body: DlsiteApplyBody): Promise<void> {
  await postVoid(`/dlsite/${encodeURIComponent(workId)}/apply`, body);
}

export async function updateDlsiteState(workId: string, body: DlsiteStatePatch): Promise<Work> {
  return patchParsed(workSchema, `/dlsite/${encodeURIComponent(workId)}`, body);
}

export async function startDlsiteBulk(): Promise<void> {
  await postParsed(dlsiteBulkStartResponseSchema, "/dlsite/bulk");
}

export async function applyDlsiteMissing(workIds?: string[]) {
  return postParsed(
    dlsiteBulkApplyMissingResultSchema,
    "/dlsite/apply-missing",
    workIds ? { workIds } : undefined,
  );
}

export async function getDlsiteBulkStatus(): Promise<DlsiteBulkSnapshot | null> {
  return getParsed(dlsiteBulkSnapshotSchema, "/dlsite/bulk", { noContentAsNull: true });
}

export async function cancelDlsiteBulk(): Promise<void> {
  await deleteParsed(dlsiteBulkCancelResponseSchema, "/dlsite/bulk");
}
