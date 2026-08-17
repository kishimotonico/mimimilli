---
id: TASK-345
title: Windows並列realテストのtemp・DB削除EBUSYを解消する
status: To Do
assignee: []
created_date: '2026-08-14 18:33'
updated_date: '2026-08-17 17:58'
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
- [ ] #1 EBUSYの最有力原因の機構・根拠と、実測で棄却した仮説がタスクnotesに記録されている
- [ ] #2 テストのDB・ファイルハンドルは、個々のテストでの登録順に依存せず、tempディレクトリ削除より前に必ず解放される構造になっている
- [ ] #3 server/tests/real 配下をLinuxで10回連続実行して全て成功する
- [ ] #4 次回Windowsドッグフーディングで、並列real-testsのtemp・DB削除にEBUSYが再発しないことを確認する（実機確認待ち）
<!-- AC:END -->
