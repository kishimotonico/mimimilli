---
id: TASK-46
title: 作品詳細の情報表示の整理（異常のみバッジ表示＋作品情報モーダル）
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-17 13:49'
updated_date: '2026-07-17 13:51'
labels: []
dependencies: []
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品詳細のkicker行を「正常は語らず、異常だけ語る」方針で整理する。

方針:
- 「登録済」バッジ（work.status==="ok"）を廃止。「ファイル欠損」「メタ読み込みエラー」の異常バッジのみ残す
- 「DLsite連携済み」バッジも通常表示から廃止（連携状態は編集ダイアログ内で確認できる）
- 追加日・最終再生はkickerから退避し、「…」メニューに「作品の情報」を追加してモーダル（useDialogModal基盤）で表示。モーダルには追加日・最終再生・物理パス・DLsite状態・RJコード・トラック数/総時間など詳細情報をまとめる

関連: client/src/features/library/ui/preview/WorkDetail.tsx:60-92（kicker）, WorkMetadataActions.tsx（…メニュー）, docs/design-system.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 正常な作品のkickerにバッジ・日付が表示されず、異常時のみバッジが出る
- [ ] #2 「…」メニューの「作品の情報」から追加日・最終再生・物理パス・DLsite状態等を確認できる
- [ ] #3 ビジュアルベースラインが更新される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Sonnetサブエージェント（worktree/task46）に委譲。kicker整理と作品情報モーダル。検証・ベースライン更新・コミットはClaude側
<!-- SECTION:PLAN:END -->
