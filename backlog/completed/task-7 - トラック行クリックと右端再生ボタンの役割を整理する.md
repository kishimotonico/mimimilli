---
id: TASK-7
title: トラック行クリックと右端再生ボタンの役割を整理する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 09:48'
labels:
  - ui
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品詳細のトラック一覧は行全体クリックでも再生でき、右端にも再生ボタンがあるため、「行選択」と「再生」が別の意味を持つのかユーザーが判断しづらい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 行全体クリックを再生に統一し右端ボタンはhover/focus時のみ表示する案、または行クリック=選択/詳細表示・右端ボタン=再生に役割分担する案のいずれかを採用する
- [x] #2 採用した役割分担に応じて、選択状態と再生状態を視覚的に明確に区別する
- [x] #3 トラック数が多い作品での操作性が改善されていることを確認する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
行クリック=再生に統一、右端ボタンはhover/focus時のみ表示の案を採用
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェントがセッション制限で中断（途中差分あり・tsc通過状態）。Codexへ引き継ぎ、残実装を委譲。

Codexが引き継ぎ完成、Fable検証: 20trの作品でトラック行クリック=再生を確認、再生中行はアクセント背景+イコライザー表示。右端アイコンはhover/focus時のみの補助表示に整理。コミット 4f5cb51。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
トラック行全体クリック=再生に統一、右端ボタンは補助表示化、再生中の視覚区別を強化。
<!-- SECTION:FINAL_SUMMARY:END -->
