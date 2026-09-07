---
id: TASK-428.24
title: スマートフォルダーの空状態とタグ条件表示を改善する
status: To Do
assignee: []
created_date: '2026-09-07 09:09'
updated_date: '2026-09-07 15:45'
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

決定（DRAFT-74 Q-03, 2026-09-07）: 結果バナーの件数分割とライブ件数プレビューは TASK-428.11 で実装済み。「＋絞り込み」候補件数をフォルダー条件適用後にする件と性能計測は、変更範囲が軸ファセットAPIとサーバー側の評価経路に及ぶため TASK-432 へ切り出した（2026-09-08）。本タスクは空状態とタグ条件表示に絞る。

0件空状態の表示のため WorkGrid.tsx / WorkListPane.tsx / LibraryView.tsx へ変更範囲を拡大した。0件空状態に関わる部分のみで、一覧のキーボード操作や描画ロジックには触れていない（TASK-428.12 の担当範囲）。TagCombobox.tsx への commitPendingInput / createLabel 追加は既存呼び出し元に非破壊（TASK-428.23 の担当範囲へ申し送り済み）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 0件時に条件編集と、絞り込み中だけ全解除の操作を表示する
- [x] #2 prefixのラベルと色がエディタ・結果バナーで一致する
- [x] #3 現存しないタグへ警告と説明を出し、条件保存機能は維持する
- [x] #4 未確定文字列を保存時に黙って破棄せず、確定または入力欄へ戻す
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
