---
id: TASK-447.5
title: DLsite適用ダイアログの状態表現と未登録候補のタイトル編集を直す
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
ordinal: 473000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうち 428.1・428.19 を直す。428.1 のユーザー理由「変更意図はOK、UIが文字に頼り過ぎで分かりづらい」（対象は「取得結果を確認」で開く DLsite 適用ダイアログ）。428.19 のユーザー理由「ESCの挙動は取り込みOK。未スキャンのタイトルをその場で編集できるのは微妙（編集したいのはDLsite連携後）」。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DLsite 適用ダイアログの「変更なし」「適用不可」の行が減光とチェック不可で区別され、説明文の行が無い。行末に短い1語（「同一」「対象外」）を残し、詳しい理由はツールチップ等で見られる
- [ ] #2 スキャンの未登録タブで候補のタイトルをその場で編集できない（master と同じ表示）
- [ ] #3 RJコード欄の Escape で編集だけが取り消されモーダルが開いたままの挙動と、DLsite 一括適用の非破壊・差分選択式は残っている
- [ ] #4 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.5-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.5-after.jpg に置き、タスクメモから参照している
- [ ] #5 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->
