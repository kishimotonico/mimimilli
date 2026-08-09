---
id: TASK-280
title: DLsiteジョブ状態を注入可能なマネージャへ移しshutdownで取消・排出する
status: Done
assignee: []
created_date: '2026-08-09 00:32'
updated_date: '2026-08-09 11:16'
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
- [x] #1 DLsiteジョブ状態がmodule-globalでなくなり、createApp単位で隔離されていること
- [x] #2 shutdownが実行中ジョブのcancelとpendingのdrainを行う終了順序になっていること
- [x] #3 テスト用のグローバルリセット関数が廃止されていること
- [x] #4 変更範囲のserverテストが通ること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
DlsiteJobManager は createApp ごとに new され（app.ts:54）、createApp が返す app.shutdown() が dlsiteJobs.shutdown() を呼ぶ形でライフサイクルが一対一に紐づく。module-scope の可変状態は残っていない。終了処理は実行中ジョブを打ち切り（cancel→abort）、pending は即時破棄、abort後にrunQueueが終了するまで待つ。drain中の失敗はログ後に呼び出し元へthrowし握りつぶさない。SSE購読者は cancelled イベントで正常にクローズされる。shutdown は shuttingDown フラグで冪等。SSEのイベント契約は shared/ と client/ の差分ゼロで維持。dlsiteProgress.test.ts は旧5件のアサーションを保ったままインスタンスベースへ移植し、隔離テストとshutdownテストの2件を追加した。\n\n後追い候補（本タスクではブロッカーではない）: shutdown() の実行中ジョブ待機に明示的なタイムアウトが無い。レビューが実アダプタ（dlsiteBulk・dlsiteFetch・dlsiteScheduler）とフィクスチャのabort応答性を調査し、HTTPリクエスト単位で AbortSignal.any をfetchへ連動させているため現状は数百ms以内に収束し無限ハングする箇所は無いことを確認済み。ただし将来アダプタ実装が変わった際に無限待機になりうる設計であることを記録しておく。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsiteジョブのキューと進捗を DlsiteJobManager のインスタンスへ移し createApp 単位で隔離した。shutdown は実行中ジョブの取消と pending 破棄を行い、終了順序を HTTP停止 → app.shutdown → adapter close に定めた。テスト用グローバルリセットは廃止しインスタンス生成で隔離。pnpm check と server 533 / client 781 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
