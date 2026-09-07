---
id: TASK-428.24
title: スマートフォルダーの空状態とタグ条件表示を改善する
status: To Do
assignee: []
created_date: '2026-09-07 09:09'
updated_date: '2026-09-07 15:35'
labels:
  - ui
  - smart-folder
  - empty-state
dependencies:
  - TASK-428.11
  - TASK-428.7
modified_files:
  - client/src/features/library/ui/SmartFolderEditorModal.tsx
  - client/src/features/library/ui/preview/SmartFolderView.tsx
parent_task_id: TASK-428
priority: medium
ordinal: 451000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
smart-folders-A-14/A-15/A-16/A-20とB重複。0件時に条件編集へ進めず、prefix表示と未知タグの扱いがエディタと結果で異なり、未確定入力も黙って消える。

決定（DRAFT-74 Q-03, 2026-09-07）: 「＋絞り込み」候補の件数は、スマートフォルダー表示中はフォルダー条件を適用した後の件数にする。実装後に large 相当（1000件規模）の実データで性能を測り、結果を本タスクの実装メモへ記録する。結果バナーの件数分割とライブ件数プレビューは TASK-428.11 で扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 0件時に条件編集と、絞り込み中だけ全解除の操作を表示する
- [x] #2 prefixのラベルと色がエディタ・結果バナーで一致する
- [x] #3 現存しないタグへ警告と説明を出し、条件保存機能は維持する
- [x] #4 未確定文字列を保存時に黙って破棄せず、確定または入力欄へ戻す
- [ ] #5 pnpm test:smokeに新規失敗がない
- [ ] #6 スマートフォルダー表示中の「＋絞り込み」候補件数がフォルダー条件適用後の件数になる
- [ ] #7 1000件規模の実データで候補件数の性能を測り、結果を実装メモに記録する
<!-- AC:END -->
