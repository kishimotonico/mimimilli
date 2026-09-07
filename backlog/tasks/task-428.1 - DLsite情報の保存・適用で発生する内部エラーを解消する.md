---
id: TASK-428.1
title: DLsite情報の保存・適用で発生する内部エラーを解消する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 16:25'
labels:
  - ui
  - bug
  - dlsite
dependencies: []
references:
  - tmp/uiux-audit-2026-09-04/HANDOFF.md
modified_files:
  - client/src/features/library/ui/preview/DlsiteEditor.tsx
  - client/src/entities/work/dlsitePreview.ts
parent_task_id: TASK-428
priority: high
ordinal: 428000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
work-detail-A-01/A-11。DLsite情報の保存・適用が成功した後に本番minified画面へ n is not a function が表示される。成功経路の型・呼び出しを修正し、差分なし・適用不可も操作可能な差分として見せない。

決定（DRAFT-74 Q-04, 2026-09-07）: 「未設定項目をまとめて適用」は既存値を上書きしない。適用前に対象の差分を一覧表示し、ユーザーが適用する項目を選んでから実行する。「上書きしない」と説明しながらサークル名を書き換える挙動を無くす。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 fixtureの保存・適用成功時に画面とconsoleへ内部エラーが出ない
- [x] #2 変更あり・変更なし・適用不可が見た目と操作で区別される
- [x] #3 差分0件では確認ダイアログを開かず結果を通知する
- [x] #4 成功・失敗・画像なしの回帰テストがある
- [x] #5 pnpm test:smokeに新規失敗がない
- [x] #6 「未設定項目をまとめて適用」が既存値を上書きせず、適用前の差分一覧から対象を選択して適用できる
<!-- AC:END -->
