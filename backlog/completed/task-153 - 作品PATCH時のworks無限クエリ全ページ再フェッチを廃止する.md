---
id: TASK-153
title: 作品PATCH時のworks無限クエリ全ページ再フェッチを廃止する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:53'
updated_date: '2026-07-30 19:33'
labels: []
dependencies: []
priority: high
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/features/library/model/useLibraryQueries.ts:184-194のpatchWorkMutation.onSuccessがinvalidateQueries({queryKey:["works"]})を呼び、無限スクロールで蓄積した全ページ（200件×N）の順次再フェッチと["works","total"]の無効化が起きる。詳細側（WORK_QUERY_KEYS.detail）には既にsetQueryDataによる直接更新パターンがあるため、一覧側にも展開する。ただしタグ・ブックマーク等の変更はフィルタ所属・ソート順に影響しうるため、「DTOの差し替え（直接更新）」と「所属・順序の再評価（限定的invalidate）」を棚分けする設計が必要（Codexレビュー指摘）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 フィルタ・ソート結果に影響しないPATCH（例: タイトル編集）では一覧クエリの再フェッチが発生せず、キャッシュ内DTOが直接更新される
- [x] #2 フィルタ所属・ソート順に影響しうるPATCHの扱いが設計として明示され、必要な範囲だけ再評価される（全ページ順次再フェッチには戻さない）
- [x] #3 総件数（total）が不必要に無効化されない
- [x] #4 pnpm check と pnpm test が通る（挙動の退行テストを追加）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. PATCH内容ごとの影響分類（DTO差し替えのみ/所属・順序再評価要）を設計
2. 一覧infinite queryをsetQueryData直接更新へ、限定invalidateの棚分け
3. 退行テスト
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codexレビュー2巡（P1×3+P2×3）を経て3層設計に確定: (1)アクティブ一覧のみDTO差し替え（影響なし時）orexact:true reset（影響あり時）、(2)非表示一覧はobserver数0判定+refetchType:none でstale化のみ、(3)totalはPATCHで不変のため無効化自体を廃止。検索はタグにも照合・スマート軸はnav.sort不使用の保守的判定を反映。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
['works']前方一致invalidate（蓄積全ページ順次再フェッチ）を廃止。workPatchInvalidation.tsをLibraryListContext判定に拡張し、workPatchListCache.ts（infinite queryキャッシュDTO差し替え+非表示stale化）を新設。client 408テスト・pnpm check通過。実装Cursor委譲、Codexレビュー2巡で6件対応。
<!-- SECTION:FINAL_SUMMARY:END -->
