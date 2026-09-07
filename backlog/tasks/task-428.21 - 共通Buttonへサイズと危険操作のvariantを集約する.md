---
id: TASK-428.21
title: 共通Buttonへサイズと危険操作のvariantを集約する
status: To Do
assignee: []
created_date: '2026-09-07 09:09'
updated_date: '2026-09-07 14:13'
labels:
  - ui
  - design-system
  - component
dependencies:
  - TASK-428.20
modified_files:
  - client/src/shared/ui/Button.tsx
  - client/src/shared/ui/ConfirmDialog.tsx
parent_task_id: TASK-428
priority: medium
ordinal: 448000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VIS-03。設定・確認・スキャン画面に高さ、角丸、focus、危険色の異なる生buttonが散在する。共通Buttonへsizeとdangerを追加し、操作階層を揃える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Buttonがsm・md・lgとdanger variantを提供する
- [x] #2 設定・確認・スキャン・登録ダイアログの対象buttonが共通部品を使う
- [x] #3 キャンセルはquiet、閉じるはIconButtonに統一される
- [x] #4 danger・quiet・各sizeのfocus-visibleと文字が判別できる
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
