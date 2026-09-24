---
id: TASK-470.1
title: scanJobManagerのイベント履歴・再生機構を廃止し現在状態同期にする
status: To Do
assignee: []
created_date: '2026-09-24 07:22'
labels:
  - scan
  - server
dependencies: []
parent_task_id: TASK-470
priority: medium
ordinal: 526000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在のコード根拠: server/src/scanJobManager.ts（最大128件のイベント履歴、sequence、Last-Event-ID再生、履歴切れ時reset）、server/src/routes/scan.ts（リプレイ用キューと進捗圧縮処理）、client/src/features/scan/model/useScanJob.ts。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 新しいADRで「進捗=現在状態」の定義、保持する要素(job ID・発見・取消・完了結果・heartbeat)、外す要素(イベント履歴・sequence・Last-Event-ID再生・reset)を記録している
- [ ] #2 server/src/scanJobManager.tsのイベント履歴・sequence・Last-Event-ID再生・履歴切れ時resetが削除され、現在snapshotの配信のみになる
- [ ] #3 server/src/routes/scan.tsのリプレイ用キュー・進捗圧縮処理が削除される
- [ ] #4 接続・再接続時に現在状態へ再同期されることがclient/src/features/scan/model/useScanJob.tsで確認できる
- [ ] #5 snapshotと購読の間で完了イベントが失われないこと、古い接続が新しい状態を上書きしないことがテストで確認されている
- [ ] #6 既存のscan job関連テストが更新され、pnpm check && pnpm test が通る
<!-- AC:END -->
