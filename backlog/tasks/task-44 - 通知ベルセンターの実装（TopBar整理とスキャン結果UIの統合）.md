---
id: TASK-44
title: 通知ベルセンターの実装（TopBar整理とスキャン結果UIの統合）
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-17 13:49'
updated_date: '2026-07-17 13:51'
labels: []
dependencies: []
priority: high
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリの健康状態に関する通知・操作を通知ベルのパネルに集約し、TopBarを整理する（DRAFT-6「通知ベルの実装」をこの形で実現）。

方針:
- 通知ベルクリックでパネル（ポップオーバー or モーダル）を開き、以下を集約:
  - RJコード未検出◯件 → 一覧（既存RjCodeMissingModalの内容）
  - DLsite取得失敗（status error/not_found）◯件 → 一覧→作品詳細導線
  - DLsite未連携◯件 → 「まとめて取得」実行ボタン（mode:"existing"）
  - 直近のスキャン結果サマリ（登録済み/新規/エラー/行方不明）
- TopBarの常設「DLsite未連携をまとめて取得」ボタンは撤去。実行中の進捗表示（SSE）はベルまたはTopBarのインライン表示で維持
- スキャン完了ポップアップ（NewWorkPopup）は新規作品が0件なら表示しない。新規>0のときは従来どおり表示（タイトルその場編集の価値があるため）し、内容はベルからも再確認できる
- ベルのバッジは「要対応件数」（RJ未検出＋取得失敗）の合算

関連: client/src/app/ui/TopBar.tsx, App.tsx, features/scan/ui/NewWorkPopup.tsx, features/library/ui/RjCodeMissingModal.tsx, app/model/useDlsiteBulk.ts, docs/design-system.md（モーダルはuseDialogModal基盤）。完了時はDRAFT-6をアーカイブ
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 通知ベルからRJ未検出一覧・取得失敗一覧・未連携一括取得・直近スキャン結果に到達できる
- [ ] #2 TopBarに常設の一括取得ボタンがなくなり、実行中の進捗は引き続き視認できる
- [ ] #3 新規0件のスキャンでは完了ポップアップが出ず、新規>0では従来どおり表示される
- [ ] #4 ベルのバッジが要対応件数を反映する
- [ ] #5 ビジュアルベースラインが更新される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Sonnetサブエージェント（worktree/task44）に委譲。ベルパネルへの通知集約とTopBar整理。検証・ベースライン更新・コミットはClaude側
<!-- SECTION:PLAN:END -->
