---
id: TASK-20
title: SSE/WebSocketによるスキャン進捗のリアルタイム通知
status: To Do
assignee: []
created_date: '2026-07-05 17:59'
labels:
  - dx
dependencies: []
references:
  - docs/requirements-v4.md
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
requirements-v4 §9.3で言及されているスキャン進捗のリアルタイム通知（SSEまたはWebSocket）が未実装。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャン進捗をSSEまたはWebSocketでクライアントにリアルタイム配信する
- [ ] #2 クライアント側でスキャン進捗表示がリアルタイムに更新される
- [ ] #3 接続断・再接続時の挙動が定義されている
<!-- AC:END -->
