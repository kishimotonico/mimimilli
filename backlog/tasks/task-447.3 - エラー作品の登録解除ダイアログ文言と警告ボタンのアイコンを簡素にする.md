---
id: TASK-447.3
title: エラー作品の登録解除ダイアログ文言と警告ボタンのアイコンを簡素にする
status: To Do
assignee: []
created_date: '2026-09-11 00:52'
updated_date: '2026-09-11 01:26'
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
- [x] #1 登録解除の確認ダイアログ（単体・一括）が「タイトル＋1文＋対象件数」の構成になり、削除範囲や再スキャン時の扱いの長い説明が無い
- [x] #2 WorkStatusWarnings.tsx の登録解除ボタンからゴミ箱アイコンが外れ、テキストだけのボタンになっている
- [x] #3 ErrorViewBulkUnregisterBanner.tsx のボタンからゴミ箱アイコンが外れている
- [x] #4 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.3-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.3-after.jpg に置き、タスクメモから参照している
- [x] #5 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。変更ファイル: WorkDetail.tsx（単体ダイアログ文言）、ErrorViewBulkUnregisterBanner.tsx（一括ダイアログ文言・ボタンアイコン除去・未使用import除去）、WorkStatusWarnings.tsx（ボタンアイコン除去）。
書き換えたテスト期待値: WorkDetail.test.tsx（alertdialog名を「作品登録を解除」→「登録を解除」）、library.smoke.spec.ts（同）。仕様変更（AC#1）に伴う辻褄合わせ。
スクリーンショット: tmp/uiux-triage-2026-09-11/shots-intake/447.3-before.jpg/-before-2.jpg/-before-3.jpg/-before-3-dialog.jpg、対応する -after 系。
check/unit/smoke すべて成功。
<!-- SECTION:NOTES:END -->
