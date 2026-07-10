---
id: TASK-20
title: SSE/WebSocketによるスキャン進捗のリアルタイム通知
status: Done
assignee:
  - '@fable'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 01:18'
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
- [x] #1 スキャン進捗をSSEまたはWebSocketでクライアントにリアルタイム配信する
- [x] #2 クライアント側でスキャン進捗表示がリアルタイムに更新される
- [x] #3 接続断・再接続時の挙動が定義されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. requirements-v4 §9.3とスキャン実装(real/fixture)・スキャンUIの現状把握 2. SSEエンドポイント設計(shared契約含む) 3. server実装(real=Scanner進捗、fixture=擬似進捗) 4. client購読とスキャンダイアログのリアルタイム更新 5. 切断・再接続挙動の定義 6. テスト・check
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント実装、Fableがレビュー・検証。設計: POST /scanは同期のまま維持し、GET /scan/events を並行配信の副チャンネルとする（202移行はコスト過大で不採用、shared/src/scan.tsのコメントを最終設計に更新）。検証: curlでライブprogress配信・完了後のterminal replay即クローズ・二重POSTの409を確認、ブラウザ(mimi.localhost:1355)でスキャンボタン押下→「作品を登録中 (1/4)→(4/4)→仕上げ中」のリアルタイム表示をMutationObserverで捕捉。pnpm check・server 91件・client 86件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GET /api/scan/events(SSE)を追加。再接続挙動3パターン（実行中replay+live/完了後terminal replay/未実行即クローズ）を定義・テスト。クライアントはEventSourceの都度接続でTopBar/SettingsModal/SetupScreenに進捗ラベル表示。コミット e6dd340。
<!-- SECTION:FINAL_SUMMARY:END -->
