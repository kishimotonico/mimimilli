---
id: TASK-150
title: 検索プリセット機能をサーバー実装ごと削除する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 15:28'
updated_date: '2026-07-30 15:48'
labels: []
dependencies:
  - TASK-130
priority: medium
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-07-30の全体レビューと仕様検討で「使わない: 削除」に決定（DRAFT-30の検索プリセット部分の決着。ユーザー承認済み）。サーバー側だけフル実装されクライアント利用ゼロ、requirements-v4（全446行）に「プリセット」の記述なし、保存検索のニーズはスマートフォルダー（ルールビルダー）が構造的に上位互換で満たす。

削除対象（2エージェントで裏取り済み）:
- server/src/routes/presets.ts（36行）と app.ts のマウント
- server/src/adapter.ts:139-141 の listPresets/createPreset/deletePreset
- server/src/adapters/real/workRepo.ts:1585-1645 の実装、userSchema.ts:43-49 の search_presets テーブル（要drizzle再生成）
- server/src/adapters/fixture/index.ts:548-568・data.ts・scenarios.ts の SEED_PRESETS 系
- shared/src/library.ts:103-119 の searchPresetSchema と関連型・export
- client/src/features/library/model/types.ts:6 の SearchPreset 死んだ再エクスポート
- 関連テスト（fixtureScenarios.test.ts・dbSeparation.test.ts・workRepoPersistence.test.ts の該当アサーション）
- docs/HANDOFF.md のAPI表の presets 行

概算200〜250行の削減。TASK-130（旧DB取り込み削除）を先に済ませると legacyDbMigration 側の考慮が不要になる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 presets のルート・adapter・スキーマ・テーブル・fixture・shared型・client再エクスポートが削除され、rg で search_preset / SearchPreset / listPresets のヒットがない
- [x] #2 HANDOFFのAPI表から presets 行が消えている
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. routes/presets.tsとapp.tsのマウント削除
2. adapter.ts・real(workRepo/userSchema)・fixture(index/data/scenarios)のプリセット実装削除、drizzle再生成
3. shared/src/library.tsのsearchPresetSchema系とclientの死んだ再エクスポート削除
4. 関連テストの該当アサーション除去
5. HANDOFFのAPI表からpresets行削除
6. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。USER_SCHEMA_VERSIONを5へbumpし、drizzle/userに0004(DROP search_presets)を追加。ADR-0003/0008のsearch_presets言及も現在の状態に合わせて削除（テーブル自体が消えたため）。shared/server check + test:server 338件を統括側でも再実行、rgで参照残存ゼロを確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
検索プリセット機能をルート・DataAdapter・real/fixture実装・search_presetsテーブル・sharedスキーマ・clientの死んだ型再エクスポートごと削除（-225行）。HANDOFFのAPI表とADRの該当言及も更新。
<!-- SECTION:FINAL_SUMMARY:END -->
