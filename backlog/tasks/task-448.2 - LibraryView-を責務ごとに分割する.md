---
id: TASK-448.2
title: LibraryView を責務ごとに分割する
status: To Do
assignee: []
created_date: '2026-09-11 08:19'
updated_date: '2026-09-24 07:23'
labels:
  - refactor
  - triage
dependencies:
  - TASK-465
parent_task_id: TASK-448
priority: medium
ordinal: 498000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
LibraryView.tsx が約445行あり、ナビゲーション状態の解釈・クエリ・結果面の組み立て・プレビューの開閉・バナー等が1ファイルに同居している。ロジックはモデルフックへ、UI ブロックはサブコンポーネントへ分ける。

2026-09-24追記: TASK-465（作品変更mutationとキャッシュ更新の責務をwork-managementモジュールへ集約する、architecture-review-2026-09-20.md R2）を先に行う。本タスクのロジック（モデルフック）分割は、TASK-465が作る共通work-managementモジュールの呼び出し方に合わせて設計する。TASK-465完了前に着手する場合、キャッシュ更新ロジックの分割・移動は最小限にし、TASK-465完了後に共通モジュールへ差し替える前提で進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LibraryView の責務が分割され、各モジュールの責務がタスクメモに一覧されている
- [ ] #2 挙動は変わらず、既存テストの期待値を変えていない。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
