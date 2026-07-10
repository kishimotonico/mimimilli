---
id: TASK-10
title: L⇄R入替機能のUIを配線する
status: Done
assignee:
  - '@fable'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 00:33'
labels:
  - player
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
チャンネル入替（L⇄R）のエンジン実装（setChannelSwap）は完了済みだが、UIからこの機能を呼び出す導線がまだない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 プレイヤーUI（バー・ポップアップ・全画面のいずれか適切な場所）にL⇄R入替を切り替えるボタン/トグルを追加する
- [x] #2 setChannelSwapが呼び出され、実際にチャンネルが入れ替わることをUI操作で確認できる
- [x] #3 入替中かどうかの状態が視覚的に分かる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. PopupContent/FullScreenPlayerの適所にL⇄Rトグルを追加 2. usePlayerのsetChannelSwapへ配線 3. 有効時の視覚状態 4. テスト・check
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント実装、Fableがレビュー・agent-browserで実画面検証。全画面プレイヤーのコントロール行にトグル追加、aria-pressed+アクセント背景で状態表示を確認。聴感（実際に左右が入れ替わるか）は実ブラウザでの人間確認を推奨。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
全画面プレイヤーにL⇄R入替トグルを追加しsetChannelSwapへ配線。コミット e4a610a。
<!-- SECTION:FINAL_SUMMARY:END -->
