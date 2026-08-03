---
id: TASK-179
title: ライブラリの「概要」面を廃止し発見ダッシュボードをホームビューへ独立させる
status: To Do
assignee: []
created_date: '2026-08-03 14:44'
labels: []
dependencies: []
priority: high
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0012 / DRAFT-50 のフェーズ1。軸を選んだだけの状態は「その軸の値一覧」を出すようになるため、値未選択時のプレースホルダーである概要面（axis-landing）は役割を失う。あわせて DiscoveryDashboard を軸選択と無関係な「ホーム」ビューとして軸レール最上部に独立させる。

対象: client/src/features/library/ui/preview/AxisLanding.tsx（削除）/ model/axisLandingPresentation.ts（削除）/ model/libraryPresentation.ts の computePreviewMode / ui/PreviewPane.tsx / ui/AxisColumn.tsx / ui/preview/DiscoveryDashboard.tsx

本タスクの時点ではまだドリル機構と ContentColumn は残る（フェーズ2の担当）。概要面が出ていた状態は、暫定的に発見ダッシュボードではなく空表示にしてよい。AxisLanding.tsx と DiscoveryDashboard.tsx に重複している .mll-related__card 相当のカード描画は共通コンポーネントへ抽出する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PreviewMode から axis-landing が消え、AxisLanding.tsx と axisLandingPresentation.ts がリポジトリから削除されている
- [ ] #2 軸レール最上部に「ホーム」行があり、選択すると結果面全幅に DiscoveryDashboard が表示される
- [ ] #3 ホームビューは軸の選択状態やタグ絞り込みに影響されず、URL からも復元できる
- [ ] #4 DiscoveryDashboard の「最近再生」は再生履歴が空のとき非表示という現行挙動を保っている
- [ ] #5 AxisLanding と DiscoveryDashboard で重複していた作品カード描画が単一のコンポーネントに統合されている
- [ ] #6 AxisLanding.test.tsx が削除され、DiscoveryDashboard.test.tsx がホームビューとしての表示を検証している
- [ ] #7 pnpm check と pnpm test が通る
<!-- AC:END -->
