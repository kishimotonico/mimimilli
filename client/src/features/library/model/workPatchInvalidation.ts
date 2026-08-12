// PATCH /works/:id 後にどのキャッシュ系統を再取得すべきか。
// 一覧 infinite query は invalidate すると蓄積全ページが順次再フェッチされるため、
// アクティブ一覧の直接更新/reset と非表示キャッシュの stale 化に棚分けする。

import type { NormalizedTag, Work, WorkPatch, WorkPatchInput } from "@mimimilli/shared";
import type { SortId } from "../../../entities/library/types";
import { isSmartAxis } from "../../../entities/library/axisDefinitions";
import { computeResultsPaneKind } from "./libraryPresentation";

export interface LibraryListContext {
  activeAxis: string;
  sort: SortId;
  searchQuery: string;
  selectedTags: NormalizedTag[];
}

export interface WorkPatchInvalidationTargets {
  /** ファセット集計（サークル/CV/シリーズ/カテゴリ/年）。構造化タグの増減に依存 */
  facets: boolean;
  /** フラット/構造化タグの一覧 */
  tags: boolean;
  /** 表示中の一覧を reset（page=1 から再評価） */
  resetActiveWorksList: boolean;
  /** 表示中の一覧キャッシュ内 DTO を setQueryData で差し替え（再フェッチなし） */
  patchActiveListCache: boolean;
  /** 非表示の一覧キャッシュを stale 化（refetchType: none。次回表示時に再取得） */
  staleInactiveListCaches: boolean;
}

function tagsChangeAffectsActiveList(ctx: LibraryListContext): boolean {
  if (isSmartAxis(ctx.activeAxis)) return true;
  if (ctx.searchQuery.length > 0) return true;
  if (computeResultsPaneKind(ctx.activeAxis) === "works" && ctx.selectedTags.length > 0)
    return true;
  return false;
}

function titleChangeAffectsActiveList(ctx: LibraryListContext): boolean {
  if (isSmartAxis(ctx.activeAxis)) return true;
  return ctx.sort === "title-asc" || ctx.sort === "title-desc" || ctx.searchQuery.length > 0;
}

function bookmarkedChangeAffectsActiveList(ctx: LibraryListContext): boolean {
  if (isSmartAxis(ctx.activeAxis)) return true;
  return ctx.activeAxis === "fav";
}

export function getWorkPatchInvalidationTargets(
  body: WorkPatchInput,
  ctx: LibraryListContext,
): WorkPatchInvalidationTargets {
  const changesTags = body.tags !== undefined;
  const changesBookmarked = body.bookmarked !== undefined;
  const changesTitle = body.title !== undefined;
  const changesListFields = changesTags || changesBookmarked || changesTitle;

  let resetActiveWorksList = false;
  let patchActiveListCache = false;

  if (changesTags) {
    const affectsActive = tagsChangeAffectsActiveList(ctx);
    resetActiveWorksList = affectsActive;
    patchActiveListCache = !affectsActive;
  }

  if (changesBookmarked) {
    if (bookmarkedChangeAffectsActiveList(ctx)) {
      resetActiveWorksList = true;
    } else {
      patchActiveListCache = true;
    }
  }

  if (changesTitle) {
    if (titleChangeAffectsActiveList(ctx)) {
      resetActiveWorksList = true;
    } else {
      patchActiveListCache = true;
    }
  }

  if (resetActiveWorksList) {
    patchActiveListCache = false;
  }

  return {
    facets: changesTags,
    tags: changesTags,
    resetActiveWorksList,
    patchActiveListCache,
    staleInactiveListCaches: changesListFields,
  };
}

/**
 * PATCH /works/:id のレスポンスはサーバー側でWorkを毎回丸ごと再構築して返すため、
 * bodyで指定していないフィールド（resumeなど）もその時点のDB最新値に置き換わって
 * 返ってくる。resumeは高頻度更新のため PATCH とは別エンドポイント
 * （POST /works/:id/resume）に意図的に分離されている契約（shared/api.ts）にも
 * かかわらず、レスポンスを丸ごとキャッシュへ上書きすると、bookmarked/tags/title の
 * ような無関係なPATCHのたびに「続きから再生」の経過時間表示が実際の再生位置へ
 * 予告なく飛ぶ（再生中は resume がクライアントキャッシュへ同期されないため、
 * このPATCHが唯一の同期経路になってしまっていた）。
 *
 * body で実際に指定したフィールドだけをサーバーの正として取り込み、
 * それ以外（resume・lastPlayedAt等）は既存キャッシュの値をそのまま維持する。
 * 既存キャッシュが無い（初回取得前など）場合はレスポンスをそのまま採用する。
 */

// WorkPatch の全フィールドをここに列挙する。下の WorkPatchKeysAreExhaustive が
// keyof WorkPatch とこの配列の要素を型レベルで突き合わせるため、shared側の
// workPatchSchema（＝WorkPatch）にフィールドを追加してこの配列の更新を忘れると
// コンパイルエラーになる（「PATCHは成功するのにキャッシュへ反映されない」という
// 静かな不整合を機械的に検出する。Codexレビュー指摘）。
const WORK_PATCH_KEYS = [
  "sourceRevision",
  "title",
  "tags",
  "bookmarked",
] as const satisfies readonly (keyof WorkPatch)[];

/** 2つの型が完全に一致するかを判定する型（distributive条件型の罠を避けるため
 *  関数型で包む定番のイディオム。単純な `A extends B ? B extends A : never` は
 *  Aがユニオン型のとき各メンバーへ分配されて誤判定することがある）。 */
export type IfEquals<A, B, Y = unknown, N = never> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? Y : N;

// コンパイル時網羅性チェック本体。WORK_PATCH_KEYS の要素の集合（ユニオン型）と
// keyof WorkPatch が完全一致しなければ IfEquals は never になり、下の
// `true` 代入が型エラーになる。
type WorkPatchKeysAreExhaustive = IfEquals<(typeof WORK_PATCH_KEYS)[number], keyof WorkPatch>;
const _workPatchKeysAreExhaustive: WorkPatchKeysAreExhaustive = true;
void _workPatchKeysAreExhaustive;

function assignPatchedField<K extends keyof WorkPatch & keyof Work>(
  next: Work,
  response: Work,
  key: K,
): void {
  next[key] = response[key];
}

export function mergeWorkPatchResponse(
  prev: Work | undefined,
  body: WorkPatchInput,
  response: Work,
): Work {
  if (!prev) return response;
  const next: Work = { ...prev };
  for (const key of WORK_PATCH_KEYS) {
    if (body[key] !== undefined) assignPatchedField(next, response, key);
  }
  return next;
}
