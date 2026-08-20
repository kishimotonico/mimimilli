---
id: TASK-356
title: DBマイグレーションをin-place適用へ簡素化し、バックアップ検証の設計矛盾を解消する
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 13:28'
updated_date: '2026-08-20 14:29'
labels:
  - server
  - bug
dependencies: []
priority: high
ordinal: 357000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dev:real 起動不能の根本修正と、外部ベストプラクティス調査・Codexレビュー2回（2026-08-20）に基づくマイグレーション機構の簡素化。

## 背景・原因

user DBマイグレーション0005（scan_candidate_exclusions追加、commit 7404ba8）以降、既存の実データDBで起動すると verifyDatabaseBackup が「必須テーブルがありません」で失敗しFATAL終了する。原因は dbBackup.ts の REQUIRED_TABLES 固定リストが現行（マイグレーション後）スキーマを pre-migration スナップショット（旧スキーマ）に要求している設計矛盾。テーブル追加のたびに既存DB環境だけが起動不能になる再発構造。

さらにレビューで現行の潜在バグが判明: catalog migration 0006/0007/0011 は `PRAGMA foreign_keys=OFF/ON` を含むが、executorが全体を BEGIN で包むためトランザクション内ではno-op（SQLite仕様）。FK有効のままテーブル再作成が走っており、DROP TABLE時のcascade等の危険がある。

## 調査結果（方針の根拠）

- drizzle-orm 0.45.2（最新）でもbun-sqlite migratorのstatement finalize漏れは未修正。ADR-0021の自前executor（drizzle-kit生成SQL＋__drizzle_migrations互換ledger）は維持が妥当
- drizzle公式の想定は「起動時にin-place適用、失敗はトランザクションロールバック」。バックアップ・リカバリの公式機構はない
- 著名OSSデスクトップアプリ（Anki, Signal Desktop, Joplin, Zotero, beets, Navidrome）は全てin-place＋トランザクション適用＋失敗時fail-fast。candidate copy→swap方式の採用例なし。事前バックアップはZotero・beetsが採用（手動リストア用）
- SQLite公式12-step手順も「foreign_keys=OFF（トランザクション外）→ BEGIN〜COMMIT → foreign_keys=ON」で単一DBファイル内・in-placeで完結する設計

## 方針

「事前バックアップ＋in-place適用＋失敗時fail-fast（手動リストア可能）」構成へ簡素化する。

- candidate swap機構（databaseReplacement.ts と db.ts のuser分岐）を削除し、catalog / user とも in-place で適用する。Windowsファイルロック回帰（TASK-344）やrename部分失敗の原子性問題は機構ごと消滅する
- executorは migration 1件ごとに原子的に適用する: DDL・ledger追記・user_version 更新を同一トランザクションに含める（現行はledger作成がBEGIN前、user_versionがCOMMIT後で原子性が欠けている）。途中クラッシュ時は「旧状態または各migration完了境界の一貫した状態」になる
- migration SQL中の `PRAGMA foreign_keys=OFF/ON` はトランザクション外で適用する。無効化中にDDLを適用した場合はCOMMIT前に `PRAGMA foreign_key_check` を実行し、成功・失敗どちらの経路でも接続の foreign_keys 設定を元へ戻す
- forward-onlyを明記する。DBがアプリより新しい場合（user_version > アプリ版、またはledgerにjournal外の新しいエントリ）は、バックアップ作成もuser_version書換えもせずfail-fastする。catalogのversion-mismatch再作成分岐は削除する（ledgerを正とする）
- pre-migrationバックアップ（VACUUM INTO＋保持5世代）は維持。検証は独立接続での PRAGMA integrity_check のみとし、REQUIRED_TABLES は削除する
- VACUUM INTO失敗・検証NG時は出力ファイルを削除し、失敗バックアップの蓄積を防ぐ。起動失敗経路では主DB接続を必ずcloseする（Windowsのロック残り防止）
- purgeOldBackups は連番付きファイル名も対象に含め、タイムスタンプ＋連番を生成順として世代管理する
- バックアップ・検証のスキップは user_version=0 かつテーブルゼロの新規DBに限る
- マイグレーション失敗時はfatalで起動失敗（自動リストア・自動リセットはしない）
- ADRを新規作成: in-place化の決定・candidate swap廃止の根拠・手動リストア手順（server完全停止→本体と -wal/-shm を退避または削除→バックアップ配置→互換バージョンで起動、のコマンド例）。ADR-0008のバックアップ節とADR-0021の関連記述も現状に合わせて更新

## Codexレビューの経緯

- 1回目: 検証のintegrity_check縮退・失敗バックアップ削除・purge連番バグ・新規DB判定を採用。候補DB検証とrename巻き戻しはswap削除で発展的解消
- 2回目（最終計画レビュー）: foreign_keys制御の確定（P1）・forward-only fail-fast（P1）・ledger/user_versionのトランザクション内包（P1）・手動リストアのWAL/SHM手順（P1）・失敗時close（P2）・連番の生成順世代管理（P2）を全て採用
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 0004時点相当（scan_candidate_exclusions未作成）のuser DBからdev:real起動でマイグレーションが成功し、サーバーが起動する（テストで再現）
- [x] #2 candidate swap機構が削除され、catalog / user ともin-placeで適用される。migration 1件ごとにDDL・ledger追記・user_version更新が同一トランザクションで原子的に適用され、適用途中でプロセスをkillして再openすると旧状態または各migration完了境界の状態になる（WAL実ファイルテスト）
- [x] #3 migration SQL中のPRAGMA foreign_keys=OFF/ONはトランザクション外で適用され、無効化中の適用ではCOMMIT前にforeign_key_checkが実行され、成功・失敗どちらでも接続のforeign_keys設定が元へ戻る（テストで確認）
- [x] #4 DBがアプリより新しい場合（user_version超過またはledgerにjournal外エントリ）はバックアップ作成もuser_version書換えもせずfail-fastし、catalogのversion-mismatch再作成分岐は削除される
- [x] #5 マイグレーション失敗時は旧スキーマのまま起動失敗して主DB接続がcloseされ、pre-migrationバックアップが手動リストア用に残る。VACUUM INTO失敗・検証NGの出力ファイルは削除される（テストで確認）
- [x] #6 REQUIRED_TABLESが削除され検証はintegrity_checkのみになる。バックアップ・検証のスキップはuser_version=0かつテーブルゼロの新規DBに限り、purgeOldBackupsは連番付きバックアップをタイムスタンプ＋連番の生成順で世代管理する（同一タイムスタンプ境界のテスト含む）
- [x] #7 in-place化と手動リストア手順（-wal/-shm退避含む）のADRが作成され、ADR-0008/0021の関連記述が更新され、pnpm check と pnpm test がパスする
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. .worktrees/task-356（task/356-inplace-migration）でCursor Agent（composer-2.5）が実装
2. candidate swap削除・executor原子性修正・foreign_keysトランザクション外適用・forward-only fail-fast・検証縮退・purge修正・ADR-0023作成
3. 完了後に統括が差分レビュー＋レビュー担当の副作用レビュー＋実データ相当の起動確認
4. masterへマージ（コミットは統括）
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor（composer-2.5）が.worktrees/task-356で実装、2ラウンド。統括の検証結果:
- pnpm check / pnpm test 全緑（824件）を統括側でも再実行して確認
- 実データDBのコピー（scratchpad）に対しworktree版serverを起動し、user migration 0005-0006が適用されscan_candidate_exclusions作成・既存work_states 14件保持・pre-migrationバックアップ生成を実測（起動不能バグの解消を実環境相当で確認）
- 負の検証: migration 0005スキップ→AC1赤、assertDatabaseNotNewerThanApp無効化→AC4赤をCursorが実施
- レビュー担当（Sonnet）の副作用レビュー: 削除exportの残参照なし、docs正典（ARCHITECTURE.md）の旧方式記述を修正済み
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
candidate swap機構を削除しin-placeマイグレーションへ簡素化。REQUIRED_TABLES起因の起動不能を解消し、executorの原子性（DDL/ledger/user_version同一トランザクション）とPRAGMA foreign_keysのトランザクション外適用を修正。ADR-0023作成。
<!-- SECTION:FINAL_SUMMARY:END -->
