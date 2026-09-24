---
id: TASK-470.2
title: DlsiteBulkRuntimeの受信履歴管理をprogress表示専用化する
status: To Do
assignee: []
created_date: '2026-09-24 07:22'
labels:
  - dlsite
  - ui
dependencies: []
parent_task_id: TASK-470
priority: medium
ordinal: 527000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在のコード根拠: client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx（freshStartRef/missedProgressによる受信履歴管理）、client/src/features/dlsite/model/dlsiteInvalidation.ts（ID指定によらない無効化と、作品詳細のみのID選択性）。

新しいADRはS2.1側で記録する「進捗=現在状態」の原則を引用し、本タスク固有の追加決定があればここに記録する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DlsiteBulkRuntime.tsxのfreshStartRef/missedProgressなど受信履歴管理が削除され、progressは表示専用になる
- [ ] #2 完了・取消後のキャッシュ更新が受信履歴の完全性に依存しない一定の方針で行われる
- [ ] #3 作品詳細の選択的無効化が必要な場合、終端結果にサーバー確定の対象Work IDが含まれ、それを使って行われる
- [ ] #4 進捗イベントの一部欠落時でも、完了・取消の最終結果が正しく反映されることをテストで確認する
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->
