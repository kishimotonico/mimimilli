---
id: TASK-286
title: ScanJobManagerにshutdown後始末を実装する
status: To Do
assignee: []
created_date: '2026-08-09 19:14'
labels: []
dependencies: []
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
- [ ] #1 スキャン実行中のshutdownでWorkerとそのDB接続が確実に解放されること
- [ ] #2 実装がDlsiteJobManagerのshutdownと同じ設計になっていること
- [ ] #3 テストで担保されていること
<!-- AC:END -->
