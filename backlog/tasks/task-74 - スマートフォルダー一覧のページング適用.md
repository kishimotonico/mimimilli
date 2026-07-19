---
id: TASK-74
title: スマートフォルダー一覧のページング適用
status: To Do
assignee: []
created_date: '2026-07-19 04:26'
updated_date: '2026-07-19 05:08'
labels: []
dependencies: []
priority: high
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
旧TASK-58の分割3つ目（58C相当、Codexレビュー2026-07-19）。routes/smartFolders.ts:42 は現状ページング契約がなく全件返却。evalSmartFolder() の戻り値をページエンベロープ化し、fixture/real両方の契約を変更、クライアントは追加読み込みに対応する。totalはページング前の評価結果件数。スマートフォルダー固有のsortは維持。ルート・アダプタメソッド・React Query keyが通常一覧と別系統のため独立タスクとして実施できる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマートフォルダーAPIがページングエンベロープ（items/total）+ page/limit（サーバーデフォルトあり）で応答する
- [ ] #2 クライアントのスマートフォルダー表示が追加読み込みで全件に到達できる
- [ ] #3 スマートフォルダー固有のソート順が維持される
- [ ] #4 fixture/real 契約一致、pnpm check と pnpm test が通る
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 05:08
---
調整(ADR-0008): TASK-73と同様。real側SQL実装はTASK-79に統合。
---
<!-- COMMENTS:END -->
