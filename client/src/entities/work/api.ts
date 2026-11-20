// work entity の API。単一作品の取得・更新と、作品に紐づくリソース（カバー画像・音声・
// ファイル一覧・DLsite メタデータ）を扱う。
// 依存方向: shared/api/http と自 entity の model のみを参照する。

import {
  API_BASE,
  getParsed,
  patchParsed,
  postParsed,
  postVoid,
  putParsed,
  deleteParsed,
  deleteVoid,
} from "../../shared/api/http";
import {
  workSchema,
  worksPageSchema,
  dlsitePreviewSchema,
  missingWorksCountSchema,
  dlsiteApplyResponseSchema,
  workCreateResponseSchema,
  identityConflictReassignResponseSchema,
  SCAN_CANDIDATE_REGISTER_MAX_PATHS,
  scanCandidatesRegisterRequestSchema,
  scanCandidatesRegisterResponseSchema,
  type DlsiteApplyResponse,
  type DlsiteRegistrationApply,
  type ScanCandidatesRegisterResponse,
  type WorkCreateBodyInput,
  type WorkCreateResponse,
  unregisterMissingWorksResultSchema,
  type Work,
  workBookmarkResultSchema,
  workEditSnapshotSchema,
  workSourceMutationResultSchema,
  type WorkBookmarkPatch,
  type WorkBookmarkResult,
  type WorkEditSnapshot,
  type WorkSourceMutationResult,
  type WorkSourcePatchInput,
  type DlsitePreview,
  type DlsiteApplyBodyInput,
  type DlsiteStateUpdateBody,
  type ResumeBody,
  type UnregisterMissingWorksResult,
  type WorksPage,
  type WorksQueryInput,
  type WorkspacePath,
} from "@mimimilli/shared";

function appendTagsTagOp(
  params: URLSearchParams,
  filter: { tags?: string[]; tagOp?: "AND" | "OR" },
): void {
  for (const tag of filter.tags ?? []) params.append("tags", tag);
  if (filter.tagOp) params.set("tagOp", filter.tagOp);
}

export async function searchWorks(
  params: WorksQueryInput,
  options?: { signal?: AbortSignal },
): Promise<WorksPage> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  appendTagsTagOp(p, params);
  if (params.view) p.set("view", params.view);
  if (params.sort) p.set("sort", params.sort);
  if (params.seed !== undefined) p.set("seed", String(params.seed));
  if (params.page !== undefined) p.set("page", String(params.page));
  if (params.limit !== undefined) p.set("limit", String(params.limit));
  if (params.scanRecord) p.set("scanRecord", params.scanRecord);
  if (params.scanChange) p.set("scanChange", params.scanChange);
  const q = p.toString();
  return getParsed(worksPageSchema, `/works${q ? `?${q}` : ""}`, options);
}

/** GET /works/:id は存在しない場合404を返す契約。呼び出し側はnull分岐でなくエラー（TanStack QueryのisError等）で扱う */
export async function getWork(id: string): Promise<Work> {
  return getParsed(workSchema, `/works/${encodeURIComponent(id)}`);
}

export async function prepareWorkPlayback(id: string): Promise<Work> {
  return postParsed(workSchema, `/works/${encodeURIComponent(id)}/playback-preparation`);
}

export async function getWorkEditSnapshot(id: string): Promise<WorkEditSnapshot> {
  return getParsed(workEditSnapshotSchema, `/works/${encodeURIComponent(id)}/source`);
}

export async function projectWorkSource(path: WorkspacePath): Promise<WorkSourceMutationResult> {
  return postParsed(workSourceMutationResultSchema, "/works/projection", { path });
}

export async function patchWorkSource(
  workId: string,
  body: WorkSourcePatchInput,
): Promise<WorkSourceMutationResult> {
  return patchParsed(workSourceMutationResultSchema, `/works/${encodeURIComponent(workId)}`, body);
}

export async function patchWorkBookmark(
  workId: string,
  body: WorkBookmarkPatch,
): Promise<WorkBookmarkResult> {
  return patchParsed(
    workBookmarkResultSchema,
    `/works/${encodeURIComponent(workId)}/bookmark`,
    body,
  );
}

export function encodeWorkTagPath(tag: string): string {
  return encodeURIComponent(tag);
}

export async function addWorkTag(workId: string, tag: string): Promise<WorkSourceMutationResult> {
  return putParsed(
    workSourceMutationResultSchema,
    `/works/${encodeURIComponent(workId)}/tags/${encodeWorkTagPath(tag)}`,
  );
}

export async function removeWorkTag(
  workId: string,
  tag: string,
): Promise<WorkSourceMutationResult> {
  return deleteParsed(
    workSourceMutationResultSchema,
    `/works/${encodeURIComponent(workId)}/tags/${encodeWorkTagPath(tag)}`,
  );
}

/** フォルダーを作品として登録する */
export async function createWork(body: WorkCreateBodyInput): Promise<WorkCreateResponse> {
  return postParsed(workCreateResponseSchema, "/works", body);
}

export type ScanCandidatesRegisterOutcome = ScanCandidatesRegisterResponse & {
  /** 途中で止まった原因。最後まで送れたらnull */
  interruptedBy: Error | null;
};

/** 上限ごとに分けて順に送る。途中で失敗したらそこで止め、それまでに追加できた分は返す */
export async function registerScanCandidates(
  paths: string[],
  apply: DlsiteRegistrationApply,
): Promise<ScanCandidatesRegisterOutcome> {
  const outcome: ScanCandidatesRegisterOutcome = {
    registered: [],
    failures: [],
    interruptedBy: null,
  };
  for (let start = 0; start < paths.length; start += SCAN_CANDIDATE_REGISTER_MAX_PATHS) {
    try {
      const response = await postParsed(
        scanCandidatesRegisterResponseSchema,
        "/scan/candidates/register",
        scanCandidatesRegisterRequestSchema.parse({
          paths: paths.slice(start, start + SCAN_CANDIDATE_REGISTER_MAX_PATHS),
          apply,
        }),
      );
      outcome.registered.push(...response.registered);
      outcome.failures.push(...response.failures);
    } catch (error) {
      outcome.interruptedBy = error instanceof Error ? error : new Error(String(error));
      break;
    }
  }
  return outcome;
}

export async function reassignIdentityConflict(
  path: WorkspacePath,
): Promise<WorkSourceMutationResult> {
  return postParsed(identityConflictReassignResponseSchema, "/works/identity-conflicts/reassign", {
    path,
  });
}

/** 作品情報ファイルからこの作品だけを読み直して一覧へ反映する */
export async function reloadWork(workId: string): Promise<void> {
  await postVoid(`/works/${encodeURIComponent(workId)}/reload`);
}

/** 作品を登録解除する（DB・メタファイルのみ。物理ファイルは残す） */
export async function deleteWork(workId: string): Promise<void> {
  await deleteVoid(`/works/${encodeURIComponent(workId)}`);
}

/** status === "missing" の作品数（一括登録解除の確認ダイアログ用） */
export async function getMissingWorksCount(): Promise<number> {
  const { count } = await getParsed(missingWorksCountSchema, "/works/missing-count");
  return count;
}

/** status === "missing" の作品を一括で登録解除する（DB・メタファイルのみ。物理ファイルは残す） */
export async function unregisterMissingWorks(): Promise<UnregisterMissingWorksResult> {
  return postParsed(unregisterMissingWorksResultSchema, "/works/unregister-missing");
}

/** カバー画像のURLを返す（<img src> で直接使用可）。
 *  version は DTO の cover.version。width を指定すると `?w=` でサムネイル幅を要求する。 */
export function getCoverImageUrl(workId: string, version: string, width?: number): string {
  const params = new URLSearchParams({ v: version });
  if (width !== undefined) params.set("w", String(width));
  return `${API_BASE}/media/cover/${encodeURIComponent(workId)}?${params}`;
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

/** 結果を待って押す取り直しなので、失敗の記録を無視して取得する */
export async function fetchDlsiteInfo(workId: string): Promise<DlsitePreview> {
  return postParsed(dlsitePreviewSchema, `/dlsite/${encodeURIComponent(workId)}/fetch?force=true`);
}

export async function applyDlsiteInfo(
  workId: string,
  body: DlsiteApplyBodyInput,
): Promise<DlsiteApplyResponse> {
  return postParsed(dlsiteApplyResponseSchema, `/dlsite/${encodeURIComponent(workId)}/apply`, body);
}

export async function updateDlsiteState(
  workId: string,
  body: DlsiteStateUpdateBody,
): Promise<WorkSourceMutationResult> {
  return patchParsed(workSourceMutationResultSchema, `/dlsite/${encodeURIComponent(workId)}`, body);
}
