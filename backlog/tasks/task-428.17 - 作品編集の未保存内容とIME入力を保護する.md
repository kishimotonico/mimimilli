---
id: TASK-428.17
title: 作品編集の未保存内容とIME入力を保護する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 14:30'
labels:
  - ui
  - editing
  - validation
dependencies:
  - TASK-428.2
modified_files:
  - client/src/features/library/ui/preview/WorkTagEditor.tsx
  - client/src/features/library/ui/preview/WorkEditDialog.tsx
parent_task_id: TASK-428
priority: high
ordinal: 444000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
work-detail-A-02/A-04/A-09/A-12/A-13、states-feedback-A-09。IME確定Enterがタグ追加になり、未保存編集がEscape・×・背景クリックで確認なく失われる。保存失敗時も入力状態を維持する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 IME composition中のEnterでタグを確定しない
- [x] #2 dirty状態でEscape・×・背景クリックを行うと保存・破棄・取消を選べる
- [x] #3 保存失敗時に入力値とfocus対象が維持される
- [x] #4 登録解除成功と編集失敗を共通通知規約で確認できる
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
