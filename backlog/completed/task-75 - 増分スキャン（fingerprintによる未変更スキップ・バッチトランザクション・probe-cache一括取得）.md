---
id: TASK-75
title: 増分スキャン（fingerprintによる未変更スキップ・バッチトランザクション・probe cache一括取得）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 04:27'
updated_date: '2026-07-22 16:46'
labels: []
dependencies:
  - TASK-57
modified_files:
  - server/src/adapters/real/index.ts
  - server/src/adapters/real/meta.ts
  - server/src/adapters/real/probe.ts
  - server/src/adapters/real/scanner.ts
  - server/src/adapters/real/workRepo.ts
  - server/src/adapters/real/fingerprint.ts
  - server/tests/real/scanner.test.ts
  - shared/src/scan.ts
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
- [x] #1 fingerprint対象の設計（何の変更を検知するか）がタスクノートまたはADRに明文化されている
- [x] #2 完全未変更の作品でメタ検証・トラックプローブが省略される。メタ未変更でも音声削除時はstatus/error更新、音声mtime/size変更時はduration再計算される
- [x] #3 作品ディレクトリ移動を同一UUIDで追跡し、duplicate UUID検出を省略しない。seenIds登録とmissing判定が従来どおり動作する
- [x] #4 DB更新がバッチトランザクション化され件数上限がある。バッチ途中失敗時に不整合statusを残さない
- [x] #5 probe cacheが一括取得され、トラックごとの個別SELECTがなくなる
- [x] #6 進捗イベントのprocessed/totalが正しい。pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. fingerprint設計: メタ内容ハッシュ（createdAt/lastAttemptAt等の機械変動フィールド除外）+デフォルトPL各トラックのsize+mtimeMs+relativePath+カバー画像のsize+mtimeMs+relativePath+作品ルート絶対パスをJSON化しSHA-256。notesに明文化 2. registering開始時にrepo.getFingerprintMap()で全作品のid→fingerprintを一括取得、registerMetaFileでメタ読込後・プローブ前にfingerprint計算・比較。一致ならupsertWork+プローブをスキップしseenIds.add(id)のみ 3. probe cacheをfingerprint不一致作品の全トラックパスで一括SELECT→Map化しprobeDurationSecに渡す（個別SELECT廃止） 4. upsertWorkをN件ごとにdb.transactionでバッチflush（バッチ途中失敗はロールバックで不整合statusを残さない） 5. upsertWork(work,{fingerprint})でworks.fingerprint保存 6. 進捗: processedはスキップ含む完了作品数/total=全メタ数、ScanResultにskipped追加（optional、notesに記録） 7. テスト: 完全未変更でスキップ（プローブ省略・seenIds登録・missingにならない）・音声削除でstatus更新・mtime/size変更でduration再計算・ディレクトリ移動を同一UUID追跡・duplicate UUID検出・バッチ上限・probe cache一括取得（SQL発行数）・進捗processed/total 8. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-23: 中断された実装をCodexマルチエージェント運用で引き継ぎ。既存差分を保護し、並列レビュー後に修正・独立検証する。

並列レビュー結果: 未変更作品をskipする前にclearPlaybackRelationsで全関係表を削除するため、2回目scanでplaylists/tracksとresume解決が失われるCriticalを確認。全削除を廃止し回帰テストが必要。全件readMetaFileによりメタschema検証省略ACを未充足。変更作品ごとのgetWorkがresume解決経由でaudio_probe_cache個別SELECTを発行し得るため、一括のscan用既存状態Mapへ置換する。バッチ失敗rollback、不正batch size、probe cache chunk境界/重複pathのテストも補う。

Fingerprint仕様: メタはtitle/tags/playlists/urls/coverImage/dlsiteの既知フィールドを正規化し、createdAtやdlsite.lastAttemptAtなど機械変動値と未知キーを除外する。default playlistの各trackのrelativePath/size/mtimeMs、coverのrelativePath/size/mtimeMs、作品ルート絶対パスを含むJSONをSHA-256化する。欠損ファイルも専用値として含め、削除を検知する。\n\n最終実装では未変更作品のschema検証・probe・upsertを省略しつつrelations/resumeを保持。既存scan状態とprobe cacheを一括取得し、900件chunk・path重複排除を適用。有限正整数のbatch sizeとcatalog transaction rollbackを実装。並列レビューで発見したrelations全消去と未知meta fieldのfingerprint不一致を修正した。\n\n検証: pnpm check成功。scanner限定25件成功。pnpm test成功（server 231件、client 298件）。独立再レビューで未解決指摘なし。
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 05:08
---
調整(ADR-0008): fingerprint等のcatalog列追加はTASK-78の新catalogスキーマ初期版に含める予定。旧DDL(db.ts)への列追加は避け、TASK-78と実装を調整すること。ロジック部分（未変更スキップ・バッチ化）は継続OK。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fingerprintによる完全未変更作品の安全なスキップ、作品更新のバッチトランザクション化、probe cache一括取得を実装した。未変更再scanでも再生関係とresumeを保持し、変更・削除・移動・duplicate UUID・進捗を回帰テストで確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
