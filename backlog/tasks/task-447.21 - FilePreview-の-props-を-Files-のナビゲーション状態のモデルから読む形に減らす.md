---
id: TASK-447.21
title: FilePreview の props を Files のナビゲーション状態のモデルから読む形に減らす
status: To Do
assignee: []
created_date: '2026-09-11 08:05'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 489000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上 第3回（tmp/uiux-triage-2026-09-11/followup-3.md の3）。FilePreview が master の 8 props から 18 props に増え、FilesView が nav 状態・クエリ・再生状態をばらして手渡ししている。2段で進める: 設計案を tmp/uiux-triage-2026-09-11/filepreview-design.md に書き、アドバイザーのレビューを経てから実装する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 設計案（18項目の分類、ナビゲーション状態のモデルの置き場所と API、再生状態のまとめ方、FilePreviewWorkActions の見直し）が filepreview-design.md にあり、アドバイザーの承認を得ている
- [ ] #2 Files のナビゲーション状態が features/files/model の単一のモデル（例: useFilesNavigation）に置かれ、FilesView と FilePreview が同じものを読み、二重管理がない
- [ ] #3 FilePreview の props が6個以下になり、FilePreviewWorkActions の props も同じ観点で減っている
- [ ] #4 ファイル移動だけのコミットと中身を変えるコミットが分かれている
- [ ] #5 挙動は変わらず、既存テストの期待値を変えていない（テストの統合・名前変更だけ許容し、タスクメモに列挙）。pnpm check（レイヤー境界含む）・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
