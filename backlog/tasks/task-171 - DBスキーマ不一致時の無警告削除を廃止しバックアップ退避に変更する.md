---
id: TASK-171
title: DBスキーマ不一致時の無警告削除を廃止しバックアップ退避に変更する
status: To Do
assignee: []
created_date: '2026-08-02 06:59'
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
- [ ] #1 スキーマ不一致時にDBファイルが無言で削除されず、バックアップ退避とerrorログを経て再作成される
- [ ] #2 マイグレーション実行前にDBの自動バックアップが取られる
- [ ] #3 バックアップの保存先・世代数の方針がタスクノートまたはdocsに明記されている
- [ ] #4 起動時のDB例外がログに記録される
- [ ] #5 pnpm checkとpnpm testが通る
<!-- AC:END -->
