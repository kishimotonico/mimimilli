---
id: TASK-75
title: 増分スキャン（fingerprintによる未変更スキップ・バッチトランザクション・probe cache一括取得）
status: To Do
assignee: []
created_date: '2026-07-19 04:27'
updated_date: '2026-07-19 05:08'
labels: []
dependencies:
  - TASK-57
priority: high
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー（2026-07-19）による旧TASK-62の分割2つ目（62B相当）。

前提としてfingerprint対象の設計が必要: 「mtime/size一致」だけでは、参照音声の削除・音声差替・duration変化・カバー更新・作品ディレクトリ移動・同一UUID重複を見逃す。メタファイルと参照トラック群のどこまでを変更検知に含めるかを先に決める。

内容: (1) fingerprint（mtime/size等）をDBに保存し、完全未変更の作品はメタJSON検証・トラックプローブを省略。(2) DB更新のバッチトランザクション化（件数上限を設け、30,000件を単一長大トランザクションにしない）。(3) audio_probe_cache のトラック単位SELECT（probe.ts）を一括取得+Map化に変更。

注意: fingerprint列の追加はDBスキーマ変更を伴う。このプロジェクトはスキーマバージョン変更時にDBを作り直す設計（db.ts）のため、TASK-57のtrack_count列追加と時期を調整し、短期間に複数回バージョンを上げない（列追加をまとめるか、データ消失の扱いを決める）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 fingerprint対象の設計（何の変更を検知するか）がタスクノートまたはADRに明文化されている
- [ ] #2 完全未変更の作品でメタ検証・トラックプローブが省略される。メタ未変更でも音声削除時はstatus/error更新、音声mtime/size変更時はduration再計算される
- [ ] #3 作品ディレクトリ移動を同一UUIDで追跡し、duplicate UUID検出を省略しない。seenIds登録とmissing判定が従来どおり動作する
- [ ] #4 DB更新がバッチトランザクション化され件数上限がある。バッチ途中失敗時に不整合statusを残さない
- [ ] #5 probe cacheが一括取得され、トラックごとの個別SELECTがなくなる
- [ ] #6 進捗イベントのprocessed/totalが正しい。pnpm check と pnpm test が通る
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 05:08
---
調整(ADR-0008): fingerprint等のcatalog列追加はTASK-78の新catalogスキーマ初期版に含める予定。旧DDL(db.ts)への列追加は避け、TASK-78と実装を調整すること。ロジック部分（未変更スキップ・バッチ化）は継続OK。
---
<!-- COMMENTS:END -->
