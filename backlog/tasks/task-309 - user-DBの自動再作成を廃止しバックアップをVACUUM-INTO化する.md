---
id: TASK-309
title: user DBの自動再作成を廃止しバックアップをVACUUM INTO化する
status: To Do
assignee: []
created_date: '2026-08-12 11:28'
labels: []
dependencies: []
priority: high
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
draft-54昇格。docs/application-architecture-review-2026-08-12.md 優先改善1。user DB（resume・bookmark・スマートフォルダー等）はsidecarから復元不可能な耐久正本だが、openVersionedDatabase（server/src/adapters/real/db.ts）のschema version不一致ガードがmigrationを試す前にファイルごと退避して空DBを作る。さらにuser再作成時にcatalogも連鎖再作成する非対称是正処理がある。バックアップ（dbBackup.ts）は開いたWAL DBの本体・WAL・SHMを素朴にファイルコピーしており一貫性リスクがある。drizzle forward-only migrationは両DB導入済みなので、破壊的ガードの廃止とバックアップ方式の置き換えが主作業。2DB構成は維持する（2026-08-12決定、ADR-0008の却下理由は有効）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 user DBがschema version不一致でも退避・空DB再作成されず、forward-only migrationのみで更新される
- [ ] #2 user再作成に連動してcatalogを再作成する非対称是正処理が削除されている
- [ ] #3 migration前バックアップがVACUUM INTOまたはSQLite Online Backup APIで作成される
- [ ] #4 バックアップを別データルートで開きintegrity_checkと現行schemaでの読み出し確認をしてからmigrationを実行する
- [ ] #5 migration失敗時は旧DBを保持したまま起動を停止し、原因がログで判別できる
- [ ] #6 catalog DBは従来どおり削除・再構築可能なまま
- [ ] #7 version不一致・migration成功・migration失敗の各経路にテストがある
<!-- AC:END -->
