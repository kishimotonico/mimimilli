---
id: TASK-286
title: ScanJobManagerにshutdown後始末を実装する
status: Done
assignee:
  - '@codex'
created_date: '2026-08-09 19:14'
updated_date: '2026-08-12 12:38'
labels: []
dependencies: []
modified_files:
  - server/src/scanJobManager.ts
  - server/src/app.ts
  - server/tests/scanProgress.test.ts
  - server/tests/real/scanWorker.test.ts
priority: medium
ordinal: 296000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-280でDlsiteJobManagerにはshutdown後始末が入ったが、ScanJobManagerには相当の処理が無い。スキャン実行中にプロセスが終了するとWorker側のDB接続が残りうる。

既存挙動でありTASK-280のスコープ外だったが、TASK-280と同じ設計をなぞれば安く実装できる。

あわせて、TASK-280のshutdown()に実行中ジョブ待機のタイムアウトが無い件も検討する（現アダプタ実装では数百ms以内に収束することは確認済み）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキャン実行中のshutdownでWorkerとそのDB接続が確実に解放されること
- [x] #2 実装がDlsiteJobManagerのshutdownと同じ設計になっていること
- [x] #3 テストで担保されていること
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ScanJobManagerとアプリ終了経路を調査する。 2. 実行中スキャンを取消して完了を待つshutdownをDlsiteJobManagerと同じ責務で実装する。 3. Worker解放を含むshutdownテストを追加し、受け入れ条件を更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ScanJobManagerに実行Promiseの追跡とshutdownを追加し、停止時はactive jobを取消して終了まで待機するようにした。createApp.shutdownはscan完了後にDLsiteジョブを終了する。実Workerを同期停止させた統合テストでshutdown待機とcancelled終端を確認した。現行WorkerはAbortSignalでSharedArrayBufferの待機を解除し、finallyでWorker側DBをcloseするため、TASK-280と同じく待機タイムアウトは追加しない。

検証: pnpm --filter server exec bun test tests/scanProgress.test.ts（16件）と pnpm --filter server exec bun test tests/real/scanWorker.test.ts（3件）が成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ScanJobManagerのshutdownで実行中スキャンを取消し、完了を待機するようにした。createAppの終了処理へ組み込み、実Worker停止中の終了待機を含むテストで確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
