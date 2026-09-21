---
id: TASK-460
title: DLsiteの最終取得失敗の寿命を確定し、user DB単独復元の案内を補記する
status: To Do
assignee: []
created_date: '2026-09-21 10:49'
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
- [ ] #1 最終取得失敗の表示が catalog 再構築で失われることが仕様として記述されている
- [ ] #2 cache の TTL と結果表示の保持が別の寿命として説明されている
- [ ] #3 user DB 単独復元時に catalog との整合を取る手順が ADR-0023 に記載されている
- [ ] #4 user の不足値を自動で補完しない
<!-- AC:END -->
