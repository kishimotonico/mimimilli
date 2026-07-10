---
id: TASK-31
title: スキャン進捗SSEの配信信頼性を修正する
status: To Do
assignee: []
created_date: '2026-07-10 13:40'
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
- [ ] #1 realアダプタのwalking中もSSE接続が確立し、heartbeatまたは進捗イベントを受信できる
- [ ] #2 complete/errorイベントのwrite完了前にストリームを終了せず、同一接続へのwriteを安全に直列化する
- [ ] #3 EventSourceの接続errorではJSONを解析せず、名前付きSSEイベントの不正JSONも未処理例外にしない
- [ ] #4 遅い実走査・接続終了・再接続を含む自動テストで上記を検証する
<!-- AC:END -->
