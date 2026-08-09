---
id: TASK-280
title: DLsiteジョブ状態を注入可能なマネージャへ移しshutdownで取消・排出する
status: To Do
assignee: []
created_date: '2026-08-09 00:32'
labels: []
dependencies:
  - TASK-259
priority: medium
ordinal: 290000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビューで検出、Sonnet検証済みの未起票課題。server/src/routes/dlsiteProgress.ts:21-28 の currentJob・lastTerminal・pendingJobs・processingQueue がmodule-scopeの可変状態で、複数createApp間の隔離がない（テスト用 resetDlsiteProgressStateForTest の存在がその証左）。server/src/index.ts:71-102 の shutdown() は adapter.close / server.stop / dispose のみで、実行中DLsiteジョブの cancel やpendingの drain を行わず放置する。
- 注入可能な DlsiteJobManager へ移し、createApp 単位で隔離する（TASK-259でroutes外へ移した配置を前提に設計する）
- 終了順序を定義する: HTTP停止 → ジョブcancel/drain → adapter close
- resetDlsiteProgressStateForTest を廃止し、テストはインスタンス生成で隔離する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DLsiteジョブ状態がmodule-globalでなくなり、createApp単位で隔離されていること
- [ ] #2 shutdownが実行中ジョブのcancelとpendingのdrainを行う終了順序になっていること
- [ ] #3 テスト用のグローバルリセット関数が廃止されていること
- [ ] #4 変更範囲のserverテストが通ること
<!-- AC:END -->
