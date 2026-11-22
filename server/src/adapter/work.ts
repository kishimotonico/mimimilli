import type {
  AxisFacetItem,
  Condition,
  DataIntegrityWarning,
  IdentityConflictReassignBody,
  NormalizedTag,
  ResumeBody,
  Work,
  WorkBookmarkPatch,
  WorkBookmarkResult,
  WorkCreateBody,
  WorkCreateResponse,
  WorkEditSnapshot,
  WorkRegisterPreview,
  WorkSourceMutationResult,
  WorkSourcePatch,
  WorkspacePath,
  WorksPage,
  UnregisterMissingWorksResult,
} from "@mimimilli/shared";
import type { ConditionGroupQuery, ConditionWorksQuery, EvalContext } from "./condition.ts";

export interface WorkAdapter {
  /** 条件の木に一致する作品の一覧（ADR-0040）。now は route が1リクエストにつき1回作る */
  queryWorks(query: ConditionWorksQuery, ctx: EvalContext): Promise<WorksPage>;
  /** 条件に一致する作品を、グループ分けの値ごとに集計する */
  groupWorks(query: ConditionGroupQuery, ctx: EvalContext): Promise<AxisFacetItem[]>;
  /** 条件ごとの一致件数。入力と同じ順で返す */
  countByConditions(conditions: Condition[], ctx: EvalContext): Promise<number[]>;
  getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview | null>;
  createWork(body: WorkCreateBody): Promise<WorkCreateResponse | null>;
  reassignIdentityConflict(
    body: IdentityConflictReassignBody,
  ): Promise<WorkSourceMutationResult | null>;
  projectWorkSource(path: WorkspacePath): Promise<WorkSourceMutationResult | null>;
  /** 作品情報ファイルからこの作品だけを読み直して catalog を作り直す。存在しなければ false。直らないときは例外 */
  reloadWork(id: string): Promise<boolean>;
  /** 作品を DB とメタファイルから削除する。物理ファイルは触らない。存在しなければ false */
  deleteWork(id: string): Promise<boolean>;
  /** status === "missing" の作品数 */
  countMissingWorks(): Promise<number>;
  /** status === "missing" の作品を全件登録解除する。一部失敗しても残りを続行する */
  unregisterMissingWorks(): Promise<UnregisterMissingWorksResult>;
  /** 指定IDのうち、いま存在する作品のstatus。存在しないIDは含まない */
  getWorkStatuses(ids: readonly string[]): Promise<Map<string, Work["status"]>>;
  getWork(id: string): Promise<Work | null>;
  /** 再生準備。対象作品を live probe し、総時間を catalog へ公開する。存在しなければ null */
  prepareWorkPlayback(id: string): Promise<Work | null>;
  getWorkEditSnapshot(id: string): Promise<WorkEditSnapshot | null>;
  /** 正本の部分更新。存在しなければ null */
  patchWorkSource(id: string, patch: WorkSourcePatch): Promise<WorkSourceMutationResult | null>;
  patchWorkBookmark(id: string, patch: WorkBookmarkPatch): Promise<WorkBookmarkResult | null>;
  addWorkTag(id: string, tag: NormalizedTag): Promise<WorkSourceMutationResult | null>;
  removeWorkTag(id: string, tag: NormalizedTag): Promise<WorkSourceMutationResult | null>;
  saveResume(id: string, body: ResumeBody): Promise<boolean>;
  touchLastPlayed(id: string): Promise<boolean>;
  listTags(): Promise<string[]>;
  exportLibrary(): Promise<{ data: string; dataIntegrityWarning?: DataIntegrityWarning }>;
}
