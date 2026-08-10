---
id: TASK-275
title: WorkGridを関心別に分割し到達不能なloading/error propsを削除する
status: Done
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 11:34'
labels: []
dependencies: []
priority: medium
ordinal: 285000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。client/src/features/library/ui/WorkGrid.tsx（449行、本体約350行）に wheel zoom・escape/deselect・キーボードナビ・仮想行レンダリングが集中。関心ごとにhook/子コンポーネントへ分割する。
あわせて: LibraryView は常に isLoading={false}/isError={false} を渡しており（LibraryView.tsx:285-286）、loading/error は LibraryWorksBoundary の Suspense/ErrorBoundary が担当するため、WorkGrid の isLoading/isError/onRetryWorks 分岐（:382-385）は到達不能。propsごと削除して境界に一本化する。
Codexレビュー反映: TASK-208（仮想化共通土台）がWorkGridの仮想化境界を変更するため、本タスクを先にやると再度hook境界を動かす手戻りになる。TASK-208 を先に完了させ、その後に wheel・dismiss・keyboard・row rendering を分割する（実施順は統括が管理）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WorkGrid が関心別のhook・子コンポーネントに分割されていること
- [x] #2 isLoading/isError/onRetryWorks props が削除され、loading/error は境界のみが扱うこと
- [x] #3 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
WorkGrid.tsx 449行→208行。ui/workGrid/ 配下へ WorkGridVirtualContent.tsx(105)・useWorkGridJustifiedLayout.ts(77)・useWorkGridKeyboardNav.ts(66)・useWorkGridDismiss.ts(44)・justifiedRows.ts(31)・useWorkGridWheelZoom.ts(22)・constants.ts(5) を分割。ロジックは一字一句変更なしの抽出移動であることをレビューが移動前コードと突き合わせて確認済み（wheel zoomのctrlKey判定と0.1係数、Escapeのdialog/フォーム要素チェックとwindow購読、キーボードナビのrequestAnimationFrameリトライ最大20回まで一致）。分割先は features/library/ui/workGrid/ に閉じており shared/ への昇格なし、TASK-114 の ContentColumn 型は再生産していない。TASK-208 との境界（justified/square の分岐判定と computeJustifiedLayout 呼び出しは WorkGrid 側）も維持。isLoading/isError/onRetryWorks は LibraryWorksBoundary の Suspense と WorksErrorBoundary により構造的に到達不能だったことを確認して削除。テストが781→780に減ったのは削除した onRetryWorks 分岐のテスト1件のみで、他の空状態テストは残存。検証: pnpm check 成功、client 780テスト全パス、smoke 10件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WorkGrid を wheel zoom・dismiss・キーボードナビ・justifiedレイアウト・仮想行レンダリングへ分割し449行を208行にした。到達不能だった isLoading/isError/onRetryWorks を props ごと削除し loading/error を境界へ一本化。pnpm check と client 780 テスト・smoke 10件で検証。
<!-- SECTION:FINAL_SUMMARY:END -->
