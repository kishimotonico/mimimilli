---
id: TASK-78
title: 'DB分離の実装（bun:sqlite移行・catalog/user 2DB・ATTACH・devランタイムBun化）'
status: To Do
assignee: []
created_date: '2026-07-19 05:07'
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
- [ ] #1 catalog.sqlite/user.sqliteに分離され、ATTACHによるJOIN読み取りが動く
- [ ] #2 bun:sqliteで全serverテストが通り、devサーバーがBunで起動する
- [ ] #3 catalog.sqliteを削除して再スキャンしても、user系データ（ブックマーク・レジューム・設定等）が失われない（テストで検証）
- [ ] #4 スキーマ定義の二重管理が解消されている
- [ ] #5 pnpm check と pnpm test が通る
<!-- AC:END -->
