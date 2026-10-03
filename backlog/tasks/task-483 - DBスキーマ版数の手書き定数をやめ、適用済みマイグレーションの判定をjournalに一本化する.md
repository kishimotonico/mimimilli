---
id: TASK-483
title: DBスキーマ版数の手書き定数をやめ、適用済みマイグレーションの判定をjournalに一本化する
status: To Do
assignee: []
created_date: '2026-10-02 11:46'
labels:
  - server
  - db
dependencies: []
documentation:
  - backlog/docs/doc-6
  - docs/adr/0023-in-place-migration-simplification.md
priority: medium
ordinal: 541000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
db.ts の CATALOG_SCHEMA_VERSION=9・USER_SCHEMA_VERSION=8 は手書きで、drizzle journal の件数（catalog 13・user 7）と合っていない。各マイグレーションで PRAGMA user_version に定数を書くため、user_version は適用数でもスキーマ世代でもない値になり、「DBがアプリより新しい」のfail-fastが形骸化している。user_versionをjournalから導出するか、適用済みhash集合とjournalの照合に一本化する。方式を変える場合はADR-0023を書き換え、既存DBに必要な手動手順があればADRに残す。詳細は doc-6 の srv-data-2。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキーマ版数の手書き定数が無い
- [ ] #2 未適用マイグレーションの判定と「DBがアプリより新しい」判定が同じ情報源（journal）から導かれる
- [ ] #3 アプリより新しいDBで起動するとfail-fastすることがテストで確認されている
- [ ] #4 ADR-0023が新しい判定方式を説明している
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->
