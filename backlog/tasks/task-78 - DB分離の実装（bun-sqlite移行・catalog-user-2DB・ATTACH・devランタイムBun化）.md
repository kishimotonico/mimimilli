---
id: TASK-78
title: 'DB分離の実装（bun:sqlite移行・catalog/user 2DB・ATTACH・devランタイムBun化）'
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 05:07'
updated_date: '2026-07-19 07:28'
labels: []
dependencies: []
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0008（docs/adr/0008-persistence-topology-query-ownership-playback-ids.md）の実装第1弾。前提知識ゼロでも ADR-0008・ADR-0007・scripts/spike/bun-distribution/README.md を読めば着手できる。

やること:
- server のDB層を better-sqlite3 から bun:sqlite へ移行（Drizzleのbun:sqlite adapter。ADR-0007でbetter-sqlite3はBun実行不可と実証済み）。devのserver実行ランタイムをBunへ切替（package.jsonのdevスクリプト）
- ADR-0008の分類表に従い catalog.sqlite / user.sqlite へ物理分離。catalog接続をmainとし userをATTACH。DB間外部キー・cascade delete禁止。書き込み所有者分離（スキャン=catalog、設定/ブックマーク/再生状態=user）
- スキーマ正本の一本化（現状のdb.ts手書きDDLとschema.tsの二重管理を解消。生成済みmigration SQL方式を推奨）
- 開発フェーズ中は両DBともスキーマ世代不一致で再作成を許容（migration基盤は配布前の前提条件、今は入れない。ADR-0008修正版参照）
- 旧単一DBからの移行は簡略版でよい: user系データ（bookmarked/lastPlayedAt/addedAt/resume v1/設定/プリセット/スマートフォルダー/タグprefix）を新user DBへ移す。catalogは再スキャンで再構築
- データ配置は ADR-0007 のデータルート（MIMIKAGO_DATA_DIRで上書き可）に従う
- TASK-75（増分スキャンfingerprint）等が要求するcatalog列は新スキーマ初期版に含めてよい（該当タスクと重複実装しないよう確認）

注意: server/tests のreal系はDB層の変更で大きく影響を受ける。fixtureアダプタは変更不要。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 catalog.sqlite/user.sqliteに分離され、ATTACHによるJOIN読み取りが動く
- [x] #2 bun:sqliteで全serverテストが通り、devサーバーがBunで起動する
- [x] #3 catalog.sqliteを削除して再スキャンしても、user系データ（ブックマーク・レジューム・設定等）が失われない（テストで検証）
- [x] #4 スキーマ定義の二重管理が解消されている
- [x] #5 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 現行DB依存とテスト利用パターンを調査し、Bun上のnode:test互換性を確認する
2. bun:sqlite + drizzle-orm/bun-sqliteへ移行し、catalog/userスキーマをDrizzle定義から生成したSQLで初期化する
3. catalog=main・user=ATTACH構成と書き込み所有者分離をWorkRepo/Scannerへ反映する
4. 旧単一DBのuserデータ簡易移行とADR-0007準拠データルートを実装する
5. catalog削除・再スキャン後のuserデータ保持、ATTACH JOIN、schema一致、旧DB移行をテストする
6. Bun dev/test実行へ切り替え、pnpm checkとpnpm testを通してBacklogを完了更新する
7. 旧DB移行の完了マーカーと冪等再開を実装し、中断状態からの再起動テストを追加する
8. MIMIMILLI_DB明示指定時の不存在エラーを実装し、既定パスへフォールバックしないことをテストする
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装判断:
- serverの実行・テストランナーをBun 1.3.14へ変更した。既存テストはnode:test APIのままBunランナーで動くため、テスト記述は維持した。
- Drizzle定義をcatalogSchema.ts/userSchema.tsへ分け、drizzle-kit生成SQLを起動時に適用する。db.tsの手書きDDLは削除した。
- catalogをmain、user.sqliteをuserとしてATTACHする。作品読出しはworksとuser.work_statesをJOINし、user状態欠損は起動時の整合性エラーにする。
- resume v2とPlaylist/Track IDは別段階の仕様変更なので、今回は既存APIのresume v1をuser.work_statesへ保持した。
- TASK-75のfingerprint列は対象設計が同タスクの未完了ACであり列仕様が未確定のため、先行追加していない。
- 旧単一DBは削除せず、user所有データだけを新user DBへトランザクションでコピーする。last_scan_timeは派生状態なので移行対象外。

検証:
- pnpm check: 成功
- pnpm test: 成功（server 158件、client 243件）
- pnpm --filter @mimimilli/server db:generate: No schema changes
- MIMIMILLI_ADAPTER=fixtureでBun dev entryの起動を確認

詳細レビュー対応を開始: 旧DB移行の中断再開と、MIMIMILLI_DB明示指定時の不存在エラーを修正する。

詳細レビュー対応完了:
- user.persistence_metaにlegacy_import_completedマーカーを追加。userデータのupsertと同一トランザクションで記録し、user.sqliteの存在ではなくマーカーで完了判定する。マーカーなしの中断状態から再起動して移行が完遂されるテストを追加した。
- MIMIMILLI_DBの解決をresolveLegacyDbPathへ分離。明示指定時はそのパスだけを検証し、不存在なら既定のdata/mimimilli.dbへフォールバックせず診断エラーにするテストを追加した。
- 再検証: pnpm check成功、pnpm test成功（server 160件、client 243件）、db:generateはNo schema changes。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
bun:sqlite・catalog/user 2DB分離に加え、旧DB移行をuser DB内の完了マーカーで中断再開できるよう修正した。MIMIMILLI_DB明示指定時の暗黙フォールバックも廃止し、両レビュー指摘の回帰テストを追加した。pnpm checkとpnpm testを通過。
<!-- SECTION:FINAL_SUMMARY:END -->
