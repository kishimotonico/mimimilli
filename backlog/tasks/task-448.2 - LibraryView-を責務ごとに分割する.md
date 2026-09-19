---
id: TASK-448.2
title: LibraryView を責務ごとに分割する
status: To Do
assignee: []
created_date: '2026-09-11 08:19'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-448
priority: medium
ordinal: 498000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
LibraryView.tsx が約445行あり、ナビゲーション状態の解釈・クエリ・結果面の組み立て・プレビューの開閉・バナー等が1ファイルに同居している。ロジックはモデルフックへ、UI ブロックはサブコンポーネントへ分ける。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LibraryView の責務が分割され、各モジュールの責務がタスクメモに一覧されている
- [ ] #2 挙動は変わらず、既存テストの期待値を変えていない。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
