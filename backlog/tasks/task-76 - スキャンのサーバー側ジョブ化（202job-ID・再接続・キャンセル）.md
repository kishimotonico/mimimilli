---
id: TASK-76
title: スキャンのサーバー側ジョブ化（202+job ID・再接続・キャンセル）
status: To Do
assignee: []
created_date: '2026-07-19 04:27'
labels: []
dependencies: []
priority: high
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー（2026-07-19）で未タスク化と指摘された項目。POST /api/scan（server/src/routes/scan.ts:39）は完了までHTTPリクエストを保持する同期実行で、TASK-56（スキャンモーダル）はUI上のバックグラウンド継続にすぎず、サーバー側の真のジョブ化を受け入れ条件に含んでいない。

内容: POST /scan はジョブ開始のみ行い202+job IDを即時返却。ジョブ状態のGET・キャンセルAPI。ページ再読込後に実行中ジョブへ再接続できる（SSE進捗との統合）。HTTP接続断とスキャン実行を分離。同期FS+同期SQLiteの連続区間でイベントループが止まる問題はWorker Thread/別プロセス分離を検討。

TASK-56のUI実装と連携して進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 POST /scan が即時に202+job IDを返し、スキャン本体はサーバー側ジョブとして継続する
- [ ] #2 ジョブ状態の取得・キャンセルAPIがあり、ページ再読込後に実行中ジョブへ再接続できる
- [ ] #3 スキャン実行中も他のAPI（一覧・メディア配信）が応答する
- [ ] #4 fixture/real 契約一致、pnpm check と pnpm test が通る
<!-- AC:END -->
