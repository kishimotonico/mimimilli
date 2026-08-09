---
id: TASK-275
title: WorkGridを関心別に分割し到達不能なloading/error propsを削除する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
labels: []
dependencies: []
priority: medium
ordinal: 285000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。client/src/features/library/ui/WorkGrid.tsx（449行、本体約350行）に wheel zoom・escape/deselect・キーボードナビ・仮想行レンダリングが集中。関心ごとにhook/子コンポーネントへ分割する。
あわせて: LibraryView は常に isLoading={false}/isError={false} を渡しており（LibraryView.tsx:285-286）、loading/error は LibraryWorksBoundary の Suspense/ErrorBoundary が担当するため、WorkGrid の isLoading/isError/onRetryWorks 分岐（:382-385）は到達不能。propsごと削除して境界に一本化する。
仮想化の共通土台はTASK-208で扱うため、本タスクでは載せ替えを前提にした分割粒度（仮想化部分を独立させる）にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WorkGrid が関心別のhook・子コンポーネントに分割されていること
- [ ] #2 isLoading/isError/onRetryWorks props が削除され、loading/error は境界のみが扱うこと
- [ ] #3 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->
