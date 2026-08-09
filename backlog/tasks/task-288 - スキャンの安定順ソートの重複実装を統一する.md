---
id: TASK-288
title: スキャンの安定順ソートの重複実装を統一する
status: Done
assignee: []
created_date: '2026-08-09 19:14'
updated_date: '2026-08-09 19:23'
labels: []
dependencies: []
priority: low
ordinal: 298000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/adapters/real/scanWalk.ts:120 が localeCompare(a, b, "ja", { numeric: true, sensitivity: "base" }) を直書きしており、同一ロジックが server/src/adapters/real/scanAudio.ts:25 の naturalCompare として別途exportされている。

ADR-0008の重複ID修復は安定順が所有者判定の根拠になっているため、片方だけ変更されると作品の帰属がずれる。scanWalk側をnaturalCompareのimportへ統一する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scanWalk.tsがnaturalCompareをimportして使い、比較ロジックの直書きが無いこと
- [x] #2 pnpm check と変更範囲のserverテストが通ること
<!-- AC:END -->
