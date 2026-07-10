---
id: TASK-31
title: スキャン進捗SSEの配信信頼性を修正する
status: Done
assignee:
  - '@sonnet'
created_date: '2026-07-10 13:40'
updated_date: '2026-07-10 13:55'
labels:
  - bug
  - scan
dependencies: []
references:
  - client/src/features/scan/useScanProgress.ts
  - server/src/routes/scan.ts
  - server/src/adapters/real/scanner.ts
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-20で追加したスキャン進捗通知には、realアダプタの同期walk中にNode.jsのイベントループを塞いでSSE接続・heartbeat・walking表示を処理できない問題がある。加えて、サーバーのlive listenerはwriteSSEを待たずに終了し、クライアントはSSEの名前付きerrorイベントとEventSource自体の接続errorを同じJSONハンドラーへ渡しているため、終了・切断時にJSON.parseで例外になり得る。大きな実ライブラリでも進捗チャンネルが安全に動くよう、配信ライフサイクル全体を修正する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 realアダプタのwalking中もSSE接続が確立し、heartbeatまたは進捗イベントを受信できる
- [x] #2 complete/errorイベントのwrite完了前にストリームを終了せず、同一接続へのwriteを安全に直列化する
- [x] #3 EventSourceの接続errorではJSONを解析せず、名前付きSSEイベントの不正JSONも未処理例外にしない
- [x] #4 遅い実走査・接続終了・再接続を含む自動テストで上記を検証する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnet実装、Fableレビュー・検証。walkをfs/promises readdirの非同期走査に書き換え50dirごとにwalking進捗をemit（120dirのテストで単調増加を検証）。scan.tsはenqueueWriteでwrite直列化しterminal write完了後にクローズ（curlでライブ購読6イベント+complete受信を実測）。クライアントはMessageEvent判定で接続エラーとJSON系エラーを分離しconsole.errorで可視化。check・server 97件・client 134件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SSE配信の3つの信頼性問題（同期walkのループ閉塞・write未await・接続エラーのparse例外）を修正。
<!-- SECTION:FINAL_SUMMARY:END -->
