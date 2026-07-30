// PATCH /works/:id 後にどのキャッシュ系統を再取得すべきか。
// 一覧 infinite query は invalidate すると蓄積全ページが順次再フェッチされるため、
// アクティブ一覧の直接更新/reset と非表示キャッシュの stale 化に棚分けする。

import type { WorkPatch } from "@mimimilli/shared";
import type { SortId } from "./types";
import { isFacetAxis, isSmartAxis } from "./axisDefinitions";

export interface LibraryListContext {
  activeAxis: string;
  sort: SortId;
  searchQuery: string;
  selectedTags: string[];
  drillValue: string | null;
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
  if (ctx.activeAxis === "tag" && ctx.selectedTags.length > 0) return true;
  if (isFacetAxis(ctx.activeAxis) && ctx.drillValue && ctx.activeAxis !== "year") return true;
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
  body: WorkPatch,
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
