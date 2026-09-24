---
id: TASK-470
title: ジョブ進捗SSEを現在状態の同期に統一する
status: To Do
assignee: []
created_date: '2026-09-24 07:22'
labels:
  - scan
  - dlsite
  - architecture
dependencies: []
priority: medium
ordinal: 524000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: docs/specification-review-2026-09-20.md S2。ユーザー決定（2026-09-24）: ジョブ進捗SSEを「現在状態」と定義し、イベント履歴・sequence・Last-Event-IDによる差分再生・履歴切れ時のresetをやめる。job ID、実行中ジョブの発見、取消、完了結果、heartbeatは残す。DLsite一括取得側（DlsiteBulkRuntimeのfreshStartRef/missedProgress等の受信履歴管理）も対象に含め、progressは表示専用、完了・取消後は一定の方針でキャッシュ更新する。詳細の選択更新が必要なら終端結果にサーバー確定の対象IDを載せる。

DRAFT-76（一括取得結果API・失敗内訳・個別再取得導線）とは別軸。S2.2は進捗SSEの受信整合性のみを扱い、結果APIの契約拡張（失敗内訳など）はDRAFT-76に委ねる。終端結果にサーバー確定の対象Work IDを載せる変更は、DRAFT-76が決める拡張と重複させない最小限の追加とする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 子タスク(S2.1・S2.2)がすべて完了している
<!-- AC:END -->
