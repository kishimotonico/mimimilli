---
id: TASK-447.11
title: ビュー一覧のエラー行の警告アイコンを他の行と縦に揃える
status: To Do
assignee: []
created_date: '2026-09-11 04:27'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 479000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機確認フィードバック第1回（tmp/uiux-triage-2026-09-11/followup-1.md の1）。左サイドバー「ビュー」の「エラー」行（AxisColumn.tsx の ax.id === "error"）の三角アイコンが他の行のアイコンと縦位置が揃っていない。原因を計測で特定してから直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 エラー行と他のビュー行のアイコンの縦中心の位置が、計測値（getBoundingClientRect）で揃っている
- [ ] #2 原因（viewBox・サイズ・line-height・余白など）が計測値とともにタスクメモに記録されている
- [ ] #3 着手前後のスクリーンショット（fixture、1440x900、ビュー一覧付近の切り出し）を tmp/uiux-triage-2026-09-11/shots-intake/447.11-before.jpg と -after.jpg に置いている
- [ ] #4 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で消した・書き換えたテストはタスクメモに列挙）
<!-- AC:END -->
