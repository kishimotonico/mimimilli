---
id: TASK-150
title: 検索プリセット機能をサーバー実装ごと削除する
status: To Do
assignee: []
created_date: '2026-07-30 15:28'
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
- [ ] #1 presets のルート・adapter・スキーマ・テーブル・fixture・shared型・client再エクスポートが削除され、rg で search_preset / SearchPreset / listPresets のヒットがない
- [ ] #2 HANDOFFのAPI表から presets 行が消えている
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->
