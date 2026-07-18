---
id: TASK-8
title: 並び替えメニューの選択中マークを明確にする
status: Done
assignee:
  - '@claude'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-06 03:24'
labels:
  - ui
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
並び替えメニューは機能しているが、選択中マークが小さく、チェックなのか装飾なのか判別しづらい。メニュー自体が小さいため選択状態をもっと明快にしたい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 専用のチェックアイコンを使用する
- [x] #2 選択中行の背景色または文字色を軽く変更する
- [x] #3 現在の並び替え名をボタン横またはtooltipに表示する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 並び替えメニューの実装箇所を特定し、選択中マークを専用チェックアイコンに変更
2. 選択中行に軽い背景/文字色を付与（design-systemのトークン準拠）
3. 現在の並び替え名をボタンのtooltip（title）または横に表示
4. 実装はCodexへ委譲、agent-browserで見た目検証、コミットはClaude
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装はCodexへ委譲、レビュー・検証・コミットはClaude。

- 旧実装はI.xアイコンを45度回転させてチェック代用していた暫定的なもの。既存のI.checkに置換
- 選択状態の色はセマンティックトークン（acc-soft/acc-ink/acc）準拠、ダークテーマにも追従
- AC#3はボタンtitle（tooltip）で対応。横への常時表示はツールバーレイアウトを崩すため不採用
- agent-browserで検証: menuitemradioのchecked状態が選択切替で移動すること、tooltipが「並び替え: タイトル（A→Z）」のように更新されることを確認。pnpm check・clientテスト73件通過
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
並び替えメニューの選択中項目にI.checkアイコン+acc-soft背景を適用し、ボタンtooltipに現在の並び順名を表示。aria属性も整備（コミットは直前のfixコミット）
<!-- SECTION:FINAL_SUMMARY:END -->
