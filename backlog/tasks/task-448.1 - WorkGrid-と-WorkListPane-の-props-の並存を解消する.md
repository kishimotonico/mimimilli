---
id: TASK-448.1
title: WorkGrid と WorkListPane の props の並存を解消する
status: Done
assignee:
  - '@claude'
created_date: '2026-09-11 08:19'
updated_date: '2026-09-25 04:08'
labels:
  - refactor
  - triage
dependencies:
  - TASK-465
parent_task_id: TASK-448
priority: medium
ordinal: 497000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkGrid.tsx と WorkListPane.tsx がそれぞれ21個の props をほぼ同じ構成で持ち、軸・選択状態・再生状態・ページング・スマートフォルダー系のハンドラーがフラットに並ぶ。呼び出し元（LibraryView）の変更が両方へ波及する。関心ごとにまとまった形（props のグループ化か、モデルフック・atom から読む形）に作り直す。

2026-09-24追記: TASK-465（作品変更mutationとキャッシュ更新の責務をwork-managementモジュールへ集約する、architecture-review-2026-09-20.md R2）を先に行う。本タスクの分割設計は、TASK-465が作る共通work-managementモジュールを前提に見直す。TASK-465完了前に着手する場合、TASK-465の結論と矛盾しない範囲（props構造の整理のみ）に留める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WorkGrid と WorkListPane の props が関心ごとにまとまり、同じフィールドを両方へ手渡しする構成が無くなっている
- [x] #2 挙動は変わらず、既存テストの期待値を変えていない。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
現状: WorkGrid・WorkListPaneは同一構成の21propsをLibraryViewから受け取る。

方針:
- axis, selectedWorkId, hasSelectedTags, onWorkSelect, onDeselect, onClearAllFilters は
  すべてnav（useLibraryNavigation()の戻り値、LibraryViewState & LibraryViewActions）から
  導出可能。navを1propとして丸ごと渡す（LibraryViewは既にPreviewPaneSlideへnavを単一propで
  渡す前例がある。LibraryView.tsx:387）。WorkGrid/WorkListPane自身がuseLibraryNavigation()を
  呼び直す案は採らない（フックの多重インスタンス化を避け、値を渡すのはLibraryView・読むだけの
  子はpropsという既存の一方向データフローを崩さないため）。
- playingWorkId, isPlaybackActive はentities/player/model/atomsのグローバルatomで、
  LibraryViewが素通ししているだけ。WorkGrid/WorkListPane内でuseAtomValueして直接読む
  （挙動は変わらず同じatomを読むだけ）。
- 残りは関心ごとに以下へグループ化する:
  - pagination: { hasNextPage, worksTotal, isFetchingNextPage, onLoadMore }
  - emptyState: { searchQuery, isSmartFolder, onClearSearch, onEditSmartFolderRules }
  - トップレベルに残す: works, worksQueryKey, isPending, dockedBarActive, onWorkPlay

共通型: WorkGrid・WorkListPaneのpropsが完全一致するため、共通の型
`WorkResultsProps`（features/library/ui/workResultsProps.ts に定義）を1つ作り両方が
これを使う。LibraryViewはprops値を1回だけ組み立て（`const workResultsProps: WorkResultsProps = {...}`）、
showGridの分岐で `<WorkGrid {...workResultsProps} />` / `<WorkListPane {...workResultsProps} />`
を出し分ける。同じフィールドを2か所（WorkGrid用JSX・WorkListPane用JSX）に書く構成を残さない。

変更後のprops（WorkResultsProps、WorkGrid・WorkListPane共通）:
- nav: LibraryViewState & LibraryViewActions（型はuseLibraryNavigationの戻り値を再利用）
- works, worksQueryKey, isPending, dockedBarActive
- pagination: { hasNextPage, worksTotal, isFetchingNextPage, onLoadMore }
- emptyState: { searchQuery, isSmartFolder, onClearSearch, onEditSmartFolderRules }
- onWorkPlay
21props→8フィールド（nav・pagination・emptyStateで集約）の共通型に削減し、
LibraryView側もJSXの重複を無くす。

テストへの影響: WorkGrid.test.tsx・WorkListPane.test.tsxのレンダー呼び出しでprops渡し方が
変わる（個別propからnav/pagination/emptyStateのオブジェクトへ）。期待値（描画結果・
呼び出し引数）は変えない。変更点は完了報告で一覧化する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。commit 063bcadf（task/448.1、feat/work-managementから分岐）。
check/test/smoke すべて緑。統合取り込み後にTASK-448.2着手予定。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WorkGrid・WorkListPaneのpropsを共通型WorkResultsProps（nav/works/worksQueryKey/isPending/dockedBarActive/onWorkPlay/pagination/emptyState）に集約し、LibraryViewは1回組み立てて出し分ける形にした。再生状態はentities/playerのatomを直接読む。挙動不変。検証: pnpm check・pnpm test・pnpm test:smoke(28件)緑、Sonnetレビューで副作用なし。feat/work-management 063bcadf。
<!-- SECTION:FINAL_SUMMARY:END -->
