---
id: TASK-460
title: DLsiteの最終取得失敗の寿命を確定する
status: Done
assignee: []
created_date: '2026-09-21 10:49'
updated_date: '2026-09-23 22:17'
labels: []
dependencies: []
documentation:
  - docs/adr/0023-in-place-migration-simplification.md
ordinal: 514000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
最後に取得へ失敗したという表示は一時的な観測として扱い、catalog 再構築で失われてよいものとする。cache の TTL（再取得の可否）と結果表示の保持は別の寿命として記述する。あわせて user DB だけを復元したときに catalog との整合をどう取るかの案内を ADR-0023 へ補記する。user の不足値を自動で補完しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 cache の TTL と結果表示の保持が別の寿命として説明されている
- [x] #2 最終取得失敗の表示について、catalog再構築後の保持を保証しないことが仕様として記述されている
- [x] #3 有効なcacheから同じ失敗表示が再び得られることを禁止していない
<!-- AC:END -->
