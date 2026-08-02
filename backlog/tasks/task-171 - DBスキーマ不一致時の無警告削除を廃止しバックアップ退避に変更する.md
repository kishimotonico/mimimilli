---
id: TASK-171
title: DBスキーマ不一致時の無警告削除を廃止しバックアップ退避に変更する
status: Done
assignee: []
created_date: '2026-08-02 06:59'
updated_date: '2026-08-02 07:26'
labels: []
dependencies:
  - TASK-169
priority: high
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実運用前のデータ保護（設計方針の詳細3・最優先課題）。openVersionedDatabase(server/src/adapters/real/db.ts:59-73)はuser_version不一致かつマイグレーション対象外のとき、警告もバックアップもなしにDBファイルを削除して再作成する。catalog/user非対称ケース(db.ts:107-111)も無警告でcatalogを道連れにする。これを「バックアップ退避＋明示エラーログ＋再作成」に変更し、drizzleマイグレーション実行前の自動バックアップも導入する。起動時のDB系例外はログに記録されてから終了すること（TASK-169のログ基盤を利用）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキーマ不一致時にDBファイルが無言で削除されず、バックアップ退避とerrorログを経て再作成される
- [x] #2 マイグレーション実行前にDBの自動バックアップが取られる
- [x] #3 バックアップの保存先・世代数の方針がタスクノートまたはdocsに明記されている
- [x] #4 起動時のDB例外がログに記録される
- [x] #5 pnpm checkとpnpm testが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor委譲(1回差し戻し)で実装、統括レビュー・検証済み。
- dbBackup.ts新設: 退避(move)とpre-migrationコピーを分離。バックアップ先はdataRoot/backup/、命名は <kind>-<timestamp>-<reason>.sqlite
- 世代管理はpre-migrationのみ5世代(DB_BACKUP_RETENTION_COUNT)。version-mismatch/catalog-user-asymmetryの退避バックアップは自動削除しない(差し戻し修正1)
- pre-migrationコピーは未適用マイグレーションがあるときだけ実行(meta/_journal.jsonと__drizzle_migrationsの件数比較、差し戻し修正2)
- 全退避・バックアップはdbカテゴリのログ(error/warn)に記録。無言削除経路は全廃(ファイルDBでバックアップ先未指定はthrow)
- 起動時DB例外はTASK-169のuncaughtハンドラで最終ログが残る構成を確認
- 検証: pnpm check合格、server/clientテスト全パス(dbBackup.test.ts追加)、lockfile健全性確認済み
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DBスキーマ不一致時の無警告削除を廃止し、バックアップ退避(自動削除なし)＋dbカテゴリのログ記録に変更。未適用マイグレーション検知付きのpre-migrationバックアップ(5世代)も導入
<!-- SECTION:FINAL_SUMMARY:END -->
