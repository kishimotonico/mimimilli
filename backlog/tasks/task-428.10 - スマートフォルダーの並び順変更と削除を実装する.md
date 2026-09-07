---
id: TASK-428.10
title: スマートフォルダーの並び順変更と削除を実装する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:02'
labels:
  - ui
  - smart-folder
dependencies: []
modified_files:
  - client/src/features/library/ui/SmartFolderEditorModal.tsx
  - client/src/features/library/model/smartFolderEditor.ts
parent_task_id: TASK-428
priority: high
ordinal: 437000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
smart-folders-A-01/A-02およびB重複。作成済みスマートフォルダーを削除できず、表示が設定準拠と示す並び順も編集できない。既存APIとSORT_OPTIONSをUIへ接続する。

前提（統合済みの変更）: TASK-428.11 が SmartFolderEditorModal.tsx に保存失敗時のscroll/focus・aria-invalid・件数のライブプレビュー（useSmartFolderRuleMatchCountQuery、POST /smart-folders/preview）を追加済み。TASK-428.24 が同ファイルへ prefixラベル・色の統一（resolveSmartFolderTagChip 経由で shared の resolveTagPrefix を使用）、未知タグ警告、未確定タグ入力の保存前確定（TagCombobox の commitPendingInput）を追加済み。削除確認は ConfirmDialog（確定ボタンは danger のsolid）を使い、TASK-428.5 が確定させた用語ルール（ライブラリからの操作は「登録解除」、「削除」は物理ファイルの文脈のみ）に従うこと。ただしスマートフォルダー自体の削除は物理ファイルでもライブラリ登録でもないため「削除」で正しい。並び順の永続化は TASK-428.7 が TagPrefix に order を追加して一括reorder API（PUT /tag-prefixes/order）で実装した形が参考になる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 作成・編集時に並び順を選択でき、再表示後も保持される
- [x] #2 編集時だけ削除操作を表示し、確認文で作品は削除されないと明記する
- [x] #3 削除成功後に軸行を消し、すべての作品へ移動する
- [x] #4 取消時はフォルダーと編集内容を変更しない
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
