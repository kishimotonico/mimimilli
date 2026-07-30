---
id: TASK-76
title: スキャンのサーバー側ジョブ化（202+job ID・再接続・キャンセル）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 04:27'
updated_date: '2026-07-22 18:31'
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
- [x] #1 POST /scan が即時に202+job IDを返し、スキャン本体はサーバー側ジョブとして継続する
- [x] #2 ジョブ状態の取得・キャンセルAPIがあり、ページ再読込後に実行中ジョブへ再接続できる
- [x] #3 スキャン実行中も他のAPI（一覧・メディア配信）が応答する
- [x] #4 fixture/real 契約一致、pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sharedにScanJobSnapshot/status/start/terminal/SSE event schemaを定義する 2. app単位のScanJobManagerを導入し、POST /scan=202、GET /scan/active、GET/DELETE /scan/:id、job scoped SSEを実装する。単一active、状態遷移、seq付きreplay、terminal履歴を管理する 3. DataAdapter.scanをAbortSignal+progress options化し、fixture/real Scannerに安全なcancel checkpointを追加する。cancel時は未完了batch/finalize/missing/lastScanTime/GC/DLsite enqueueを行わない 4. file DBのreal scanはBun Workerへ隔離し、Worker内で独自DB接続・後処理・closeを完結する。SharedArrayBuffer tokenで同期区間中もcancel可能にし、親HTTPは一覧/メディアへ応答する 5. clientにuseScanJobを追加し、mount時active discovery、job scoped SSE再接続、terminal side effectの冪等処理、start/cancelを実装する。既存TopBar/設定/セットアップを移行し、TASK-56モーダルは触らない 6. server job state/SSE/cancel/競合、real abort整合、Worker停止中のAPI応答、client reload再接続/cache invalidationをテストする 7. pnpm check、pnpm test、ブラウザで開始・reload再接続・cancel・再実行を別検証担当が確認する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-23: 前提の性能改善タスク完了後にCodexマルチエージェント運用で着手。サーバージョブ状態機械、SSE再接続、キャンセル、実行中API応答性を並列調査する。

実装: app単位のScanJobManager、202+job ID、状態取得/取消、seq付きSSE replay/reset、bounded progress、terminal履歴を追加。file DBのreal scanはBun WorkerとSharedArrayBuffer cancel tokenで隔離し、fixture/real共通のAbortSignal/progress契約へ統一。キャンセル時は未完了batch、missing化、last scan更新、resume移行、thumbnail GC、DLsite enqueueを安全なcheckpointで抑止。clientはactive discovery、再接続、競合応答のgeneration guard、terminal/cancelling吸収、404/410 detach、5xx再接続、開始/取消エラー表示へ移行。TASK-63のThumbnailCache FIFO競合も呼出順admission chainで補正した。検証: pnpm check成功、pnpm testはserver 253/client 293件成功、Worker before-finalize反復・SSE reset watermark・client競合テスト成功。ブラウザでPOST 202、SSE/GET 200、進捗/取消表示、実行中Files遷移、console errorなしを確認。fixtureが短いためreload/cancel完了は統合テストで担保。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スキャンをHTTP接続から分離したサーバージョブへ移行し、状態取得・取消・SSE再接続・Worker実行を実装。実行中の一覧/Range media応答、取消後の整合性、再スキャン、クライアント競合を自動テストで検証し、checkと全テストを通過した。
<!-- SECTION:FINAL_SUMMARY:END -->
