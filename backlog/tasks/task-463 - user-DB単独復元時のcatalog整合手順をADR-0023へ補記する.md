---
id: TASK-463
title: user DB単独復元時のcatalog整合手順をADR-0023へ補記する
status: Done
assignee: []
created_date: '2026-09-21 13:44'
updated_date: '2026-09-23 22:17'
labels: []
dependencies: []
documentation:
  - docs/adr/0023-in-place-migration-simplification.md
ordinal: 517000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
user.sqlite だけを復元した場合に catalog との整合をどう取るかの手順が記載されていない。自動補完はしない方針のため、ユーザーが実行する手順として残す。TASK-460（DLsiteの最終取得失敗の寿命）から分割したもので、独立して完了できる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 user DB単独復元時にcatalogとの整合を取る手順がADR-0023に記載されている
- [x] #2 userの不足値を自動で補完しない
- [x] #3 手順がADR-0008・ADR-0017・ADR-0023と整合している
<!-- AC:END -->
