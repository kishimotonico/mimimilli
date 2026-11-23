---
id: TASK-519
title: ランダムの並びを seed ごとに十分に混ざる形にする
status: To Do
assignee: []
created_date: '2026-11-23 14:08'
labels:
  - server
  - library
dependencies: []
priority: medium
ordinal: 634000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
real adapter のランダムの並び（server/src/adapters/real/workQuerySql.ts:38-47、core/japaneseSortKey.ts:27。TASK-79 からの実装）は、作品 ID（UUIDv4）の16進文字列を seed % 72 だけ回転した文字列で並べている。並びは72通りしかなく、隣り合う offset には相関がある。fixture の ID（RJ501001 のような連番）では offset の大半で ID 順とほぼ同じになり、ランダムに見えない。既定の「ランダム」のスマートフォルダーに直接効く。seed から決まり、同じ seed で再現し、ページを連結すると全件になる性質（TASK-517.8 のテスト）は保ったまま、seed ごとに十分に混ざる並びにする。fixture と real で同じ考え方にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 異なる seed の並びが seed の数に比例して多様で、72通りのような周期が無いことをテストが確かめる（例: 1000個の seed で並びの重複がほぼ無い）
- [ ] #2 連番の ID（fixture の RJ501001 形式）でも、seed を変えると先頭の数件が ID 順から十分に外れる
- [ ] #3 同じ seed で同じ順になり、ページを連結すると全件が重複・欠落なく並ぶ（fixture と real の両方）
- [ ] #4 並べ替えのキーの計算がページングのたびに全件の再計算で重くならない（1万件で既存の他の並びと同程度の応答時間）
<!-- AC:END -->
