---
id: TASK-86
title: 増分スキャンのID移行チェックを全件フルread+parseから軽量判定へ
status: Done
assignee: []
created_date: '2026-07-23 05:58'
updated_date: '2026-07-23 10:22'
labels: []
dependencies: []
priority: high
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanner.scan()冒頭で毎回 migrateMetaIds が全.meta.jsonを readFileSync+JSON.parse する(server/src/adapters/real/metaIdMigration.ts:161-176, 321-333、呼び出しは scanner.ts:370-380)。fingerprint一致でスキップされるはずの作品まで毎回フルI/O+パースが走り、TASK-75/76の増分最適化(fingerprint・probe cache一括・TEMPテーブル化)の効果を律速する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 libraryCompleted判定/hasCompleteUniqueIds が fingerprint(またはmtime/size)ベースの軽量チェックになり、内容が前回と変わっていないメタは中身を読まずに済む
- [ ] #2 ID移行が必要なファイルの検知漏れ・誤検知が無いことをテストで担保している
- [ ] #3 既存のscanner/metaIdMigrationテストが通る
<!-- AC:END -->
