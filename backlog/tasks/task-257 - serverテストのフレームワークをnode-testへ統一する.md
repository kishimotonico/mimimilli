---
id: TASK-257
title: 'serverテストのフレームワークをnode:testへ統一する'
status: To Do
assignee: []
created_date: '2026-08-08 13:35'
labels: []
dependencies: []
ordinal: 267000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/tests は node:test + node:assert/strict が既存規約（29ファイル）だが、TASK-209で追加された server/tests/real/classificationMethods.test.ts のみ bun:test を使っており規約から浮いている。node:test へ書き換えて統一する。bunランナーは両APIを実行できるため動作上の問題はなく、規約統一のみが目的。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server/tests 配下から bun:test の import が消え、全テストが node:test + node:assert/strict に統一されていること
- [ ] #2 変更範囲のserverテストが通ること
<!-- AC:END -->
