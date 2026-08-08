---
id: TASK-253
title: serverテストの並列実行時フレーキー（busy_timeoutのロック待ち）を解消する
status: To Do
assignee: []
created_date: '2026-08-08 10:25'
labels: []
dependencies: []
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-252の検証中に pnpm test（run-p でserver/clientを同時実行）でserver側が1件失敗した。server単独で再実行すると505件全通過するため、並列実行時のリソース競合によるフレーキーと判断した。

該当は busy_timeout のロック待ちタイムアウト系テスト。clientのvitestと同時に走ることでSQLiteのロック待ちが想定より延びていると推測される。TASK-252の変更とは無関係。

pnpm test を並列のまま安定させるか、当該テストをロック競合に影響されない形にするかを決めて対応する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm test（server/client同時実行）を連続3回実行してserver側が安定して通る
- [ ] #2 フレーキーの原因が特定されタスクのnotesに記録されている
<!-- AC:END -->
