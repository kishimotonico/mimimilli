---
id: TASK-344
title: Windowsでuser候補DBのmigration後入替と失敗時cleanupを保証する
status: Done
assignee:
  - '@codex'
created_date: '2026-08-14 18:15'
updated_date: '2026-08-14 20:28'
labels:
  - bug
  - server
  - database
dependencies: []
priority: high
ordinal: 354000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-309で導入したuser候補DBのforward-only-migration後の入替処理が、Windowsでは開いたDBハンドルによるファイルロックを残して失敗し、サーバーが起動できない回帰を修正する。成功経路ではmigration済み候補DBを確実にcloseしてから入れ替え、失敗経路では一次例外を保持したまま旧DBを復元し、一時DBとsidecarを残さない。広範なmigration-ledger再設計は別件とし、本タスクには含めない。参照:TASK-309。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 user候補DBはmigration完了後にすべてのDBハンドルがcloseされ、Windowsでもファイルロックなしで現行DBとの入替に成功する
- [x] #2 migration失敗時は候補DBをcloseしてからcleanupされ、呼び出し元には元のmigration例外が保持されたまま返る
- [x] #3 replace処理中のcleanup失敗は一次例外を上書きせず、旧DBが復元されて引き続き利用可能である
- [x] #4 成功経路と各失敗経路の完了後にcandidate、rollback、およびWAL・SHM等のsidecarファイルが残存しない
- [x] #5 Windowsのファイルロックを再現するmigration成功、migration失敗、replace・cleanup失敗の関連テストが追加され安定して通る
- [x] #6 実装により現行DB設計の説明が変わる場合は該当文書を現在の設計へ更新し、広範なmigration-ledger再設計を含めない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 候補DB migration用の実行境界を設け、Drizzle/Bunの一時statementを含めてclose完了を保証する。 2. DB置換を一次例外の保持と復元最優先の設計へ整理する。 3. Windows実ファイルの成功・失敗経路、およびcleanup失敗を対象に回帰テストを追加する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
候補DB用にstatementを都度finalizeするSQLite migration executorを追加し、close完了後だけcleanup・置換するよう変更。置換失敗では復元を先行しcleanup例外を抑制して一次例外を保持する。検証: pnpm --filter @mimimilli/server exec bun test tests/real/dbBackup.test.ts (20 pass)、pnpm --filter @mimimilli/server check。

独立レビュー指摘を反映: ROLLBACK失敗を一次migration例外のsuppressed情報として保持し、旧DB復元に失敗した場合はrollback一式を削除せず残すよう修正。注入operationsによる復元失敗、およびrollback失敗の回帰テストを追加。再検証: pnpm --filter @mimimilli/server exec bun test tests/real/dbBackup.test.ts (22 pass)、pnpm --filter @mimimilli/server check、git diff --check。

最終pnpm checkで検出されたserver/tests/real/dbBackup.test.tsのoxfmt指摘を、同ファイルのみ標準formatterで修正。pnpm exec oxfmt --check server/tests/real/dbBackup.test.tsおよびgit diff --checkを通過。

最終検証:pnpm-checkはpass。対象のdbBackupテストは22-pass。全pnpm-testは476-pass/147-fail/26-errorsで、失敗は既存のWindows並列問題によるreal-testsのEBUSY、dlsiteCacheのEEXIST、loggerテストのパス期待値不一致であり、TASK-344の差分起因ではない。フォローアップとしてTASK-345、TASK-346、TASK-347へ起票した。

独立レビュー指摘を反映: 候補DBのclose保証範囲をPRAGMA設定を含む全体へ復元、migration実行をexecuteSqliteMigrationsへ1系統化しdrizzle migrator依存を削除、insertMigrationをDatabase.runへ簡素化。fix/task-344-windows-db-replacementブランチでmaster最新へ再ベース。

外部レビュー反映: 入替成功後cleanupのbest-effort化、install/restore両例外の保持、pending判定のexecutor統一、journal解析のreadMigrationFiles委譲、二次障害のログ整備。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Windowsで候補DBのmigration後入替を成功させ、migration・cleanup・rollback失敗時も一次例外と旧DBまたは復旧用DBを保持するよう修正した。pnpm-checkと対象22テストはpass。全pnpm-testで検出した差分外のWindows並列問題はTASK-345〜347へ分離した。
<!-- SECTION:FINAL_SUMMARY:END -->
