---
id: TASK-130
title: 旧単一DB取り込み機構（persistence_meta系）を削除する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:28'
updated_date: '2026-07-30 15:43'
labels: []
dependencies: []
priority: medium
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-78（2026-07-19、単一DB→catalog/user 2DB分離）の一度きりの移行のためのコードが恒久コードとして残留している。アプリは未公開でDBは壊してよい方針のため、移行機構は用済み。resume v1（旧単一DB時代のposition+track_index形式）の変換機構も、供給元が旧DB取り込みだけなので丸ごと削除できる（resume_v1_pendingへINSERTする本番コードは db.ts の取り込み処理のみ。2026-07-30 レビューで確認済み）。

削除対象:
- server/src/adapters/real/db.ts の migrateLegacyUserData / assertLegacyTable / completedLegacyImportSource / LEGACY_IMPORT_MARKER（db.ts:81-198,296-317）
- 同 db.ts:200-261 の migrateResumeV1 と、呼び出し元 server/src/adapters/real/index.ts:638・scanWorker.ts:65 のスキャン後再試行フック
- server/src/adapters/real/userSchema.ts の persistenceMeta（:4-7）と resumeV1Pending（:21-25）テーブル（要drizzle再生成。user DBはuser_version不一致で再作成される）
- server/src/adapters/real/dataRoot.ts:16-34 の resolveLegacyDbPath と MIMIMILLI_DB 環境変数（server/src/index.ts:34,40）
- server/tests/real/legacyDbMigration.test.ts（全体）と server/tests/real/resumeV2.test.ts 内のv1変換系テスト（resume解決自体のテストは残す）

背景: ユーザー方針として、捨てた旧実装由来の v1/v2 世代区別を今後のノイズにしたくない。呼称の一掃は別タスク参照。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 persistence_meta・resume_v1_pending テーブル、migrateLegacyUserData・migrateResumeV1・resolveLegacyDbPath・MIMIMILLI_DB、スキャン後の再試行フックが削除されている
- [x] #2 legacyDbMigration.test.ts が削除され、resume系テストからv1変換ケースが除去され、pnpm check・pnpm test:server が通る
- [x] #3 user DB再作成後の通常スキャン・resume保存/復元が動作する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. db.tsからmigrateLegacyUserData/assertLegacyTable/completedLegacyImportSource/LEGACY_IMPORT_MARKER/migrateResumeV1を削除
2. userSchema.tsからpersistenceMeta/resumeV1Pendingを削除しdrizzle再生成
3. dataRoot.tsのresolveLegacyDbPathとindex.tsのMIMIMILLI_DBを削除
4. index.ts/scanWorker.tsのmigrateResumeV1呼び出し除去
5. legacyDbMigration.test.ts削除、resumeV2.test.tsからv1変換ケース除去
6. pnpm check + pnpm test:server
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。USER_SCHEMA_VERSIONを3→4にbump（既存v3 user DBは再作成）し、drizzle履歴には0003のDROP migrationを追加。server check(tsc)とtest:server 338件を統括側でも再実行し通過。rgでMIMIMILLI_DB/persistence_meta/resume_v1系の残存参照ゼロを確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
旧単一DB取り込み（migrateLegacyUserData/persistence_meta/MIMIMILLI_DB/resolveLegacyDbPath）とresume v1変換（resume_v1_pending/migrateResumeV1/スキャン後再試行フック）を全削除。legacyDbMigration.test.ts削除、resumeV2.test.tsのv1ケース除去。差分は+37/-621行。
<!-- SECTION:FINAL_SUMMARY:END -->
