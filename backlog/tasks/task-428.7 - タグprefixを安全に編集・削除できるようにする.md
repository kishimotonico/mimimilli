---
id: TASK-428.7
title: タグprefixを安全に編集・削除できるようにする
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 13:10'
labels:
  - ui
  - settings
  - tags
dependencies: []
modified_files:
  - client/src/features/settings/ui/TagPrefixSettings.tsx
  - shared/src/tagPrefix.ts
parent_task_id: TASK-428
priority: high
ordinal: 434000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
settings-setup-errors-A/B-01/02。保護中のprefixにも即時削除ボタンが出ており、ラベル・色・並び順も編集できない。prefix設定を一つの編集モデルに揃える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 削除は確認ダイアログを経由し、タグ自体は削除されないことを明記する
- [x] #2 保護中のprefixは削除できず理由を確認できる
- [x] #3 ラベル・色・並び順を新規作成時と編集時に設定できる
- [x] #4 保存・削除成功後に設定一覧とタグ表示が更新される
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
