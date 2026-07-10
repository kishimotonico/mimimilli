---
id: TASK-20
title: SSE/WebSocketによるスキャン進捗のリアルタイム通知
status: In Progress
assignee:
  - '@fable'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 00:34'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. requirements-v4 §9.3とスキャン実装(real/fixture)・スキャンUIの現状把握 2. SSEエンドポイント設計(shared契約含む) 3. server実装(real=Scanner進捗、fixture=擬似進捗) 4. client購読とスキャンダイアログのリアルタイム更新 5. 切断・再接続挙動の定義 6. テスト・check
<!-- SECTION:PLAN:END -->
