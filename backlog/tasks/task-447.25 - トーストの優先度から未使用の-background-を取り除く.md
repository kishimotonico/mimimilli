---
id: TASK-447.25
title: トーストの優先度から未使用の background を取り除く
status: Done
assignee: []
created_date: '2026-09-11 08:18'
updated_date: '2026-09-11 08:37'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-447
priority: medium
ordinal: 493000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
負債横断調査の反映 第4回（tmp/uiux-triage-2026-09-11/followup-4.md の2）。ToastPriority の background は使用0件。型・コメント・design-system.md の優先順位表・GlobalToast の PRIORITY_ORDER から削除し、error > action > notice の3段にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ToastPriority・PRIORITY_ORDER・コメント・design-system.md から background が消え、優先順位の記述と実装が一致している
- [ ] #2 挙動は変わらず、既存テストの期待値を変えていない（変更したテストはタスクメモに列挙）。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
