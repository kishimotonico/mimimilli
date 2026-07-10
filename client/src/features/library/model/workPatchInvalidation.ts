// PATCH /works/:id 後にどのキャッシュ系統を再取得すべきか。
// 以前は変更フィールドに関わらず全作品・総件数・全ファセット・全スマートフォルダー・
// 作品詳細・タグ一覧の6系統を毎回再取得していた。
// フィールドごとの実際の影響範囲に基づいて絞り込む。

import type { WorkPatch } from "@mimimilli/shared";

export interface WorkPatchInvalidationTargets {
  /** 作品一覧（リスト/グリッド、全軸）。タイトル表示・タグによる絞り込み・お気に入り表示に影響 */
  works: boolean;
  /** ファセット集計（サークル/CV/シリーズ/カテゴリ/年）。構造化タグの増減に依存 */
  facets: boolean;
  /** スマートフォルダーの評価結果。ルールは「タグ」条件のみを持つ（bookmarked条件は存在しない） */
  smartFolderWorks: boolean;
  /** フラット/構造化タグの一覧 */
  tags: boolean;
}

export function getWorkPatchInvalidationTargets(body: WorkPatch): WorkPatchInvalidationTargets {
  const changesTags = body.tags !== undefined;
  const changesBookmarked = body.bookmarked !== undefined;
  const changesTitle = body.title !== undefined;

  return {
    works: changesTitle || changesTags || changesBookmarked,
    facets: changesTags,
    smartFolderWorks: changesTags,
    tags: changesTags,
  };
}
