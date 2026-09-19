---
id: TASK-447.26
title: DLsite の欠落差分計算を shared に一本化し、適用失敗の意味論を両 adapter の契約テストで縛る
status: Done
assignee: []
created_date: '2026-09-11 08:19'
updated_date: '2026-09-11 08:37'
labels:
  - refactor
  - server
  - triage
dependencies: []
parent_task_id: TASK-447
priority: medium
ordinal: 494000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
負債横断調査の反映 第4回（tmp/uiux-triage-2026-09-11/followup-4.md の3）。computeMissingDiff が fixture/real の dlsiteMethods.ts に同一実装で重複している。dlsiteApplyMissing の failed 計上は real にだけあり fixture は常に0なので、fixture で失敗ケースを表現できない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 computeMissingDiff が shared/src/dlsite.ts に1つだけあり、fixture/real の両 adapter がそれを使う
- [x] #2 fixture のシナリオに適用が失敗する作品を含むケースがあり、fixture/real の両方を通す契約テストで dlsiteApplyMissing の failed の意味論が縛られている
- [ ] #3 挙動は変わらず、既存テストの期待値を変えていない（変更したテストはタスクメモに列挙）。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
