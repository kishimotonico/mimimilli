---
id: TASK-309
title: user DBの自動再作成を廃止しバックアップをVACUUM INTO化する
status: Done
assignee:
  - '@codex'
created_date: '2026-08-12 11:28'
updated_date: '2026-08-12 12:45'
labels: []
dependencies: []
modified_files:
  - server/src/adapters/real/db.ts
  - server/src/adapters/real/dbBackup.ts
  - server/src/adapters/real/databaseReplacement.ts
  - server/tests/real/dbBackup.test.ts
priority: high
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
draft-54昇格。docs/application-architecture-review-2026-08-12.md 優先改善1。user DB（resume・bookmark・スマートフォルダー等）はsidecarから復元不可能な耐久正本だが、openVersionedDatabase（server/src/adapters/real/db.ts）のschema version不一致ガードがmigrationを試す前にファイルごと退避して空DBを作る。さらにuser再作成時にcatalogも連鎖再作成する非対称是正処理がある。バックアップ（dbBackup.ts）は開いたWAL DBの本体・WAL・SHMを素朴にファイルコピーしており一貫性リスクがある。drizzle forward-only migrationは両DB導入済みなので、破壊的ガードの廃止とバックアップ方式の置き換えが主作業。2DB構成は維持する（2026-08-12決定、ADR-0008の却下理由は有効）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 user DBがschema version不一致でも退避・空DB再作成されず、forward-only migrationのみで更新される
- [x] #2 user再作成に連動してcatalogを再作成する非対称是正処理が削除されている
- [x] #3 migration前バックアップがVACUUM INTOまたはSQLite Online Backup APIで作成される
- [x] #4 バックアップを別データルートで開きintegrity_checkと現行schemaでの読み出し確認をしてからmigrationを実行する
- [x] #5 migration失敗時は旧DBを保持したまま起動を停止し、原因がログで判別できる
- [x] #6 catalog DBは従来どおり削除・再構築可能なまま
- [x] #7 version不一致・migration成功・migration失敗の各経路にテストがある
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. DBのopen・migration・backup実装と既存テストを確認する。
2. user DBをforward-only migrationへ統一し、migration前の論理バックアップと検証を実装する。
3. version不一致、migration成功・失敗、catalog再構築のテストを追加する。
4. 変更範囲のテストを実行し、受け入れ条件を更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
user DBのmigrationはVACUUM INTOで作成・検証したスナップショットの候補DBで実行し、成功時だけ元パスを置換するようにした。version不一致、WAL snapshot、migration失敗時の保持、catalog再構築をdbBackup.test.tsで確認した。

統括レビューを反映し、候補DBとrollback DBを元DBと同じディレクトリ内の一意な名前で扱うreplace helperへ分離した。既存destinationを直接上書きせず、install失敗時は旧main/WALを戻してcandidateとrollbackを削除する。保持世代のpurgeはsnapshot検証後へ移し、backup検証はDB種別ごとの必須テーブルを明示して読み出すようにした。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
user DBのforward-only migrationを、VACUUM INTOで作成・検証した論理snapshotから同一ディレクトリ内の候補DBへ適用する方式に変更した。候補のinstallはrollback可能なrename手順で行い、失敗時は旧DBを復元する。catalogの再構築可能な扱いは維持し、user再作成に連動したcatalog退避は削除した。
<!-- SECTION:FINAL_SUMMARY:END -->
