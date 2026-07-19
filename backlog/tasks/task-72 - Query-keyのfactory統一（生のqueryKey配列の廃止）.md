---
id: TASK-72
title: Query keyのfactory統一（生のqueryKey配列の廃止）
status: To Do
assignee: []
created_date: '2026-07-19 04:07'
labels: []
dependencies: []
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(doc-1)指摘18,19の前倒し分（DRAFT-29から独立、優先順位レビューの推奨）。App.tsx等に生のQuery key（["works"]等）が散在し、player→libraryのLIBRARY_KEYS参照など依存方向も乱れている。

対応: Query key factoryをwork entity側（client/src/entities/work/）へ移し、全invalidateQueries/setQueryDataをfactory経由に統一。feature間のkey参照はentity経由になるよう整理する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 生のQuery key配列の直書きが排除され、全てfactory経由になっている
- [ ] #2 Query key factoryがentities側にあり、features間の直接参照が解消されている
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
