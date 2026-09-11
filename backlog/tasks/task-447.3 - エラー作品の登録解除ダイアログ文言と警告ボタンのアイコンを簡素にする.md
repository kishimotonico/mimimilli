---
id: TASK-447.3
title: エラー作品の登録解除ダイアログ文言と警告ボタンのアイコンを簡素にする
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
ordinal: 471000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうちエラー作品表示に関わる 428.5・428.21 を直す。ユーザー理由: 428.5「丁寧すぎてダイアログの文言が分かりづらい」、428.21「ゴミ箱→バツ・丸ボタン間引き」（WorkStatusWarnings.tsx / ErrorViewBulkUnregisterBanner.tsx のアイコン選択が原因。tmp/uiux-triage-2026-09-11/button-impact.md）。タイル左上の警告アイコンと「Filesで開く」導線は残す。Button.tsx は変更しない。メニュー項目内のアイコン（WorkMetadataActions.tsx）は対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 登録解除の確認ダイアログ（単体・一括）が「タイトル＋1文＋対象件数」の構成になり、削除範囲や再スキャン時の扱いの長い説明が無い
- [ ] #2 WorkStatusWarnings.tsx の登録解除ボタンからゴミ箱アイコンが外れ、テキストだけのボタンになっている
- [ ] #3 ErrorViewBulkUnregisterBanner.tsx のボタンからゴミ箱アイコンが外れている
- [ ] #4 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.3-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.3-after.jpg に置き、タスクメモから参照している
- [ ] #5 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->
