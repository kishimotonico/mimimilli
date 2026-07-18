---
id: TASK-46
title: 作品詳細の情報表示の整理（異常のみバッジ表示＋作品情報モーダル）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-17 13:49'
updated_date: '2026-07-17 17:22'
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
- [x] #1 正常な作品のkickerにバッジ・日付が表示されず、異常時のみバッジが出る
- [x] #2 「…」メニューの「作品の情報」から追加日・最終再生・物理パス・DLsite状態等を確認できる
- [x] #3 ビジュアルベースラインが更新される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Sonnetサブエージェント（worktree/task46）に委譲。kicker整理と作品情報モーダル。検証・ベースライン更新・コミットはClaude側
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント（worktree/task46）実装をレビューしマージ（92489df）。kickerは異常時（missing/error）のみレンダリング、正常時はdiv自体を出さずレイアウト崩れ回避。WorkInfoDialog新設（useDialogModal基盤、基本情報＋DLsite連携の2セクション、読み取り専用）。「…」メニューを常時表示化し先頭に「作品の情報」を追加。実機確認: 正常作品でkicker非表示・メニュー→情報モーダル表示OK。check/test/visualベースライン更新済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
kickerを異常バッジのみに整理し、登録済/DLsite連携済みバッジと日付表示を廃止。詳細情報は「…」メニューの「作品の情報」モーダル（useDialogModal基盤）へ退避。実機検証・ベースライン更新済み。
<!-- SECTION:FINAL_SUMMARY:END -->
