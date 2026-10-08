---
id: TASK-483
title: DBスキーマ版数の手書き定数をやめ、マイグレーションの判定の情報源をjournalに揃える
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:46'
updated_date: '2026-10-08 05:31'
labels:
  - server
  - db
dependencies: []
documentation:
  - backlog/docs/doc-6
  - docs/adr/0023-in-place-migration-simplification.md
priority: low
ordinal: 541000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
db.ts の CATALOG_SCHEMA_VERSION=9・USER_SCHEMA_VERSION=8 は手書きの定数で、各マイグレーションで PRAGMA user_version にこの値を書く。「DBがアプリより新しい」の判定は、user_version と定数の比較（sqliteMigrationExecutor.ts）と、__drizzle_migrations の created_at を journal と照合して journal より新しい未知の履歴を拒否する判定の2系統になっている。後者が既にテストされている（dbBackup.test.ts）ので未来のmigrationは止まるが、定数は更新漏れを検出できず、判定の情報源が2つある。手書き定数をやめ、判定を journal 由来の1系統に揃える。未知の古い時刻・履歴の穴・同一時刻の異なるSQLまで拒否するかは設計時に決め、拒否するならそれぞれを別のテストケースにする。方式を変える場合はADR-0023を書き換え、既存DBに必要な手動手順があればADRに残す。詳細は doc-6 の srv-data-2。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキーマ版数の手書き定数が無い
- [x] #2 未適用マイグレーションの判定と「DBがアプリより新しい」判定が同じ情報源（journal）から導かれる
- [x] #3 ADR-0023が新しい判定方式を説明している
- [x] #4 pnpm check && pnpm test が通る
- [x] #5 journalより新しい未知のmigration履歴を持つDBで起動するとfail-fastする既存の挙動が維持され、テストで縛られている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: 当初の説明「fail-fastが形骸化している」は、ledgerとjournalの時刻照合（sqliteMigrationExecutor.ts:130付近、dbBackup.test.ts:283でテスト済み）を見落としていたので訂正した。単なる情報源の整理なのでlowに下げた。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PRAGMA user_version と手書きの版数定数を廃止し、ledger と journal の突き合わせ1関数で未適用・未知の created_at（新旧）・重複・履歴の穴を判定。hash 照合はしない。ADR-0023・0021 を書き換え。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージ（衝突解消込み）で pnpm check・test（server 953 / client 1247）・smoke 30 全通過。15013618 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
