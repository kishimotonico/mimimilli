---
id: TASK-275
title: WorkGridを関心別に分割し到達不能なloading/error propsを削除する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 00:29'
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
- [ ] #1 WorkGrid が関心別のhook・子コンポーネントに分割されていること
- [ ] #2 isLoading/isError/onRetryWorks props が削除され、loading/error は境界のみが扱うこと
- [ ] #3 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->
