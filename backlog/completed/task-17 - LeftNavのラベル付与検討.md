---
id: TASK-17
title: LeftNavのラベル付与検討
status: Done
assignee:
  - '@fable'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 00:36'
labels:
  - dx
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
LeftNavの各項目にアクセシブルなラベル付与が検討課題として残っている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LeftNavの各ナビ項目にaria-labelまたは適切なテキストラベルを検討・付与する
- [x] #2 スクリーンリーダーでナビ項目の意味が判別できることを確認する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 現状確認（aria-label付与状況） 2. 不足分の補完 3. アクセシビリティツリーで検証
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
検討の結果: 各ボタンのaria-label/title/aria-pressedはTASK-3時代に付与済みで不足なし。残っていたのはランドマークで、aside(complementary)をnav+aria-label=メインナビゲーションに変更。アクセシビリティツリー実測で全7項目の名前・disabled・pressed状態が判別できることを確認（agent-browser snapshot/eval）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LeftNavは既にラベル付与済みと確認し、navランドマーク化のみ追加。コミット 6be〜（fix: LeftNavをnavランドマーク化）。
<!-- SECTION:FINAL_SUMMARY:END -->
