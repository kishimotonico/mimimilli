---
id: TASK-514
title: 契約テストのshared構築を最初のテストのタイムアウトから外す
status: To Do
assignee: []
created_date: '2026-11-20 21:18'
labels: []
dependencies: []
priority: medium
ordinal: 597000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
defineContract(..., { shared: true }) は最初のテストの中でrealアダプタ（DB・マイグレーション・110件seed）を構築するため、その構築時間が最初のテストの30秒タイムアウトに含まれる。pnpm testでclientとserverが同時に走るなどCPU負荷が高いと、worksPagination.test.ts:16 の (real) 版などが timed out after 30000ms で落ちる（TASK-513.8の作業中に1回発生、負荷再現で12本中2本）。masterと同じ仕組みで、ブランチ起因ではない。再現手順とログは調査時のscratchpad（flaky/load-1b.log）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 shared構築がテスト本体のタイムアウトに含まれず、構築に専用の上限がある
- [ ] #2 CPU負荷下（bun test tests --parallel を3並列＋CPU負荷12本）を4ラウンド流してもshared利用の最初のテストがタイムアウトで落ちない
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
