---
id: TASK-470.1
title: scanJobManagerのイベント履歴・再生機構を廃止し現在状態同期にする
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 07:22'
updated_date: '2026-09-25 13:33'
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
- [x] #1 新しいADRで「進捗=現在状態」の定義、保持する要素(job ID・発見・取消・完了結果・heartbeat)、外す要素(イベント履歴・sequence・Last-Event-ID再生・reset)を記録している
- [x] #2 server/src/scanJobManager.tsのイベント履歴・sequence・Last-Event-ID再生・履歴切れ時resetが削除され、現在snapshotの配信のみになる
- [x] #3 server/src/routes/scan.tsのリプレイ用キュー・進捗圧縮処理が削除される
- [x] #4 接続・再接続時に現在状態へ再同期されることがclient/src/features/scan/model/useScanJob.tsで確認できる
- [x] #5 snapshotと購読の間で完了イベントが失われないこと、古い接続が新しい状態を上書きしないことがテストで確認されている
- [x] #6 既存のscan job関連テストが更新され、pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
方針はADR-0030（docs/adr/0030-job-progress-sse-current-state.md）。worktree .worktrees/TASK-470（task/470）。ADRを単独コミットしてから実装する。
shared の型変更は470.1では scanJobEventSchema のみで、DLsite 側スキーマ（470.2）とは重ならない。470.1 の各コミットは scan の server/client を一括追随し pnpm check が通る単位にする。

1. shared/src/scan.ts: scanJobEventSchema から全種の seq と reset 種別を削除（state/progress/completed/failed/cancelled の5種）。型追随は client/server 一括で行い、互換は残さない。
2. server/src/scanJobManager.ts: Job.history・nextSeq、historyLimit（コンストラクタ引数）、subscribe の lastEventId と差分再生・reset 判定を削除。emit は listener への配信のみ。subscribe(id, listener) は現在snapshotの取得とlistener登録を同期的に1手で行い {snapshot, unsubscribe} を返す。終端済みなら listener を登録せず snapshot だけ返す。コンストラクタは (adapter, terminalLimit, onCompleted) にし、呼び出し元（server/src/app.ts、テストの生成ヘルパー）を追随。terminalLimit による終端ジョブの pruning は維持。
3. server/src/routes/scan.ts: asLastEventId、再生用 queue・replayBoundarySeq・closeWhenDrained・pump の progress 圧縮を削除。接続時に subscribe の snapshot を state で1件書き、終端済みならその書き込み後に閉じる。live イベントは既存の writeSerialized で順に書き、終端イベントの書き込み後に閉じる。SSE フレームの id は付けない。heartbeat（15秒 ping）と onAbort・書き込み失敗時の stop は現状維持。
4. client/src/features/scan/model/useScanJob.ts: reset イベントの購読と分岐を削除（state だけで snapshot を反映）。generationRef の数値カウンタを sseTransport の createSseGeneration に置き換える（DLsite と共通化）。statusRank ガード、終端イベント・接続エラーでの GET /scan/:id 確定（refresh）は維持。469.2 の refresh 409 root_reconfiguring → reset() の経路はそのまま残す。
5. docs: ARCHITECTURE.md のスキャン節と HANDOFF.md の API 表から Last-Event-ID・reset の記述を外し、接続時 state snapshot の契約に書き換える。

テスト（変更範囲のみ実行、最後に pnpm check && pnpm test && pnpm test:smoke を1回）:
- server/tests/scanProgress.test.ts: 「job scoped SSEはprogressとterminalをseq付きで配信し、Last-Event-IDをreplayする」を「接続時に state snapshot を1件送り、以後 progress と terminal を id なしで配信する（Last-Event-ID は無視）」に書き換え。「history切詰時はresetし、terminal上限を超えたjobは404相当のnullになる」は reset 部分を削除して terminal 上限の検証として書き換え。「reset IDで即再接続すると古い履歴を再送せず…」は機能削除に伴い削除。追加: 終端済みジョブへの接続で終端 state を1件送って閉じる、subscribe 直後に完了しても listener が completed を受け取る（snapshot と購読の間で完了を失わない＝AC#5）。
- client/tests/unit/scanJob.test.ts: dispatch するイベントから seq を削除、reset を state に置換。追加: 再接続時に届く state snapshot で現在状態へ再同期する（AC#4）、attach し直した後に古い接続の state/progress/terminal が届いても新しいジョブの状態を上書きしない（AC#5）。既存の遅延GET系テスト（job Aの遅延GET、terminal後の遅延running GET）は期待値を変えない。
- client/tests/unit/ScanRuntime.test.tsx・runtimeEventSource.test.tsx: seq の削除のみ（期待値は変えない）。
- 469.2 挙動の維持確認: ScanRuntime.test.tsx「root再設定中の409（root_reconfiguring）でSSE再接続が失敗すると、追跡状態が初期化される」と reconfigurationExitEffect.test.tsx がそのまま通ること。
- smoke: scan 進捗表示の経路に触れるため最後に pnpm test:smoke を実行し結果を報告。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
470.1実装コミット 7f9cbc39（ADRは e44a9c36）。AC#6はタスク完了時のフルcheck/test後にチェック。

全体 pnpm check && pnpm test 緑（server 890 / client 1191）。smokeは29/30、失敗1件はworktreeパス由来のworker0 bunポート5004がWSLループバックでSYN不達（python http.serverでも再現、5005は正常）という環境要因。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scanの進捗SSEからイベント履歴・seq・Last-Event-ID再生・resetと、ルートのリプレイ用キュー・進捗圧縮を削除し、接続時に現在snapshotを1件送ってliveを流す現在状態同期にした（ADR-0030）。subscribeはsnapshot取得と購読を同期1手、終了済みジョブは終端stateで閉じる。useScanJobは接続世代をcreateSseGenerationへ。検証: scanProgress等のテスト書き換え・追加、pnpm check・test・smoke緑。master aa3b08c3。
<!-- SECTION:FINAL_SUMMARY:END -->
