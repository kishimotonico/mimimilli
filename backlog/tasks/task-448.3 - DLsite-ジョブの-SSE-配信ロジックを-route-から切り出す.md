---
id: TASK-448.3
title: DLsite ジョブの SSE 配信ロジックを route から切り出す
status: To Do
assignee: []
created_date: '2026-09-11 08:19'
updated_date: '2026-10-02 11:50'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-448
priority: medium
ordinal: 499000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/routes/dlsite.ts の GET /dlsite/events に、SSE イベントの直列化キュー（writeSerialized / writeChain）、購読解除・完了検知（stop / done / resolveDone）、リプレイイベントの終端判定が route 内に実装されている。他の route は30〜80行の純粋な委譲で、これだけ逸脱している。DlsiteJobManager 側（またはスキャンと共通の SSE ヘルパー）へ移し、route は購読の開始と委譲だけにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /dlsite/events の route が購読の開始と委譲だけになり、直列化・購読解除・終端判定のロジックが route の外にある
- [ ] #2 SSE の配信順序・リプレイ・切断時の後始末がテストで縛られている
- [ ] #3 挙動は変わらず、既存テストの期待値を変えていない。pnpm check・pnpm test が通る
- [ ] #4 DLsiteのSSEもscanと同じ間隔のheartbeatを送り、サーバーのidleTimeoutで切断されない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02点検: SSEのwriteChain/writeSerialized・stop/done・pingはserver/src/routes/scan.ts:156付近にもdlsite.ts:183と同一実装がある。切り出しはscan側も含めて共通化する範囲で検討する。

2026-10-02構造点検（doc-6・doc-7）より: DLsiteのSSE（GET /dlsite/events）にはheartbeatが無く、scan側（15秒ping）と違って無音が続くとサーバーのidleTimeout（90秒）で切れる。ADR-0030は共通原則としてheartbeatを挙げている。切り出す共通SSEヘルパーにheartbeatを持たせる。AC#3の「挙動は変わらず」はheartbeat以外の挙動を指す（doc-6 jobs-2）。
<!-- SECTION:NOTES:END -->
