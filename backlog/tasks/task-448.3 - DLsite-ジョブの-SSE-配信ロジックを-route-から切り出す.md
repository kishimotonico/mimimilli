---
id: TASK-448.3
title: DLsite ジョブの SSE 配信ロジックを route から切り出す
status: To Do
assignee: []
created_date: '2026-09-11 08:19'
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
<!-- AC:END -->
