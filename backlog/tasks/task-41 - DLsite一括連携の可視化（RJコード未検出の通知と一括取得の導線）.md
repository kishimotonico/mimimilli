---
id: TASK-41
title: DLsite一括連携の可視化（RJコード未検出の通知と一括取得の導線）
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-17 12:19'
updated_date: '2026-07-17 12:28'
labels: []
dependencies: []
priority: medium
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャン後のDLsite自動一括取得（TASK-37）は実装済みだが、対象は「rjCode検出済み（フォルダ名にRJコード）」の作品のみで、未検出の作品は静かに取り残され、ユーザーからは都度手動取得しか無いように見える。また「未連携をまとめて取得」ボタンが設定モーダルの奥にあり発見性が低い。

方針（スキャン・更新まわりのUI/機能は互換性を気にせず長期目線でベストな形に再設計してよい）:
- スキャン完了時に「◯件はRJコード未検出」を通知し、該当作品の一覧とコード入力への導線を出す
- 「未連携をまとめて取得」をライブラリ画面側（ツールバーや通知系UIなど）から起動できるようにする。DRAFT-6（通知ベル）との統合も検討してよい
- 一括取得の進捗・失敗の既存可視化（SSE・バッジ・失敗一覧）と整合させる

関連: server/src/routes/scan.ts:39-60（enqueueDlsiteJob）, server/src/routes/dlsite.ts, dlsiteProgress.ts, client SettingsModal.tsx:334-354, useDlsiteBulk.ts, server/src/adapters/real/index.ts runDlsiteBulk（適用方針の正典）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャン完了後、RJコード未検出の作品数が通知され、該当作品の一覧に到達できる
- [ ] #2 一覧から各作品のRJコード入力（→取得）へ迷わず進める
- [ ] #3 未連携の一括取得を設定モーダルを開かずにライブラリ画面から起動できる
- [ ] #4 一括取得の進捗・失敗の既存可視化と矛盾しない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 実装はSonnetサブエージェント（worktree隔離）に委譲、TASK-38のCodexと並行
2. スキャン完了通知にRJコード未検出件数を追加し、該当作品一覧＋コード入力導線を用意
3. 未連携一括取得をライブラリ画面（ヘッダーのスキャン/通知まわり）から起動可能に
4. pnpm check/testはエージェント側、ブラウザ検証とコミットはClaude側
<!-- SECTION:PLAN:END -->
