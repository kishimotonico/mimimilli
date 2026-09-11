---
id: TASK-447.7
title: 再生速度が1.0×のとき速度ボタンを目立たせない
status: To Do
assignee: []
created_date: '2026-09-11 00:52'
labels:
  - ui
  - ux
  - triage
dependencies:
  - TASK-447.1
parent_task_id: TASK-447
priority: high
ordinal: 475000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうち 428.16 を直す。ユーザー理由「1倍速のときにも速度表示が出ていると違和感。倍速は使用頻度が低いので通常時は目立たせない」。速度ボタンは PlaybackRatePicker.tsx でポップアップ・再生中タブ（通常/没入）の3箇所共用。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 1.0× のとき速度ボタンのラベルが周囲の操作ボタンより弱い色で表示され、1.0 以外では通常のボタン文字色で数値が表示される
- [ ] #2 ポップアップ・再生中タブ（通常/没入）の3箇所で同じ見え方になっている
- [ ] #3 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.7-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.7-after.jpg に置き、タスクメモから参照している
- [ ] #4 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->
