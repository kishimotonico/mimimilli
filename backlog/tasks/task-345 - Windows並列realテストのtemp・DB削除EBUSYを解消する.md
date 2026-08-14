---
id: TASK-345
title: Windows並列realテストのtemp・DB削除EBUSYを解消する
status: To Do
assignee: []
created_date: '2026-08-14 18:33'
labels:
  - bug
  - server
  - test
  - windows
dependencies: []
references:
  - TASK-344
priority: medium
ordinal: 355000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-344の最終pnpm-testで、多数のreal-testsがteardown時のtempディレクトリまたはDB削除にWindows-EBUSYで失敗した。TASK-341が扱うDLsite系2テストのSQLITE_BUSY・タイムアウトとは別に、未解放のDB・ファイルハンドルとcleanup順序を特定し、Windows並列実行でも決定的に削除できるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 EBUSYを起こす未解放ハンドルまたはcleanup競合の原因が特定され、タスクnotesに記録されている
- [ ] #2 影響するreal-testsはteardown前にDB・ファイルハンドルを解放し、tempディレクトリとDBをEBUSYなしで削除できる
- [ ] #3 再現対象のreal-testsをWindowsで並列実行して10回連続で安定して通る
- [ ] #4 pnpm-testをWindowsで3回連続実行し、real-testsのtemp・DB削除にEBUSYが発生しない
<!-- AC:END -->
