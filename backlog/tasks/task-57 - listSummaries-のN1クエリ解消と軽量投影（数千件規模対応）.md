---
id: TASK-57
title: listSummaries のN+1クエリ解消と軽量投影（数千件規模対応）
status: In Progress
assignee:
  - '@kimi'
created_date: '2026-07-19 02:01'
updated_date: '2026-07-19 15:41'
labels: []
dependencies: []
priority: high
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
数千〜数万作品を想定すると、ほぼ全APIが経由する listSummaries()（server/src/adapters/real/workRepo.ts:166）のコストが支配的になる。現状は (1) works全列SELECT (2) タグ全件SELECT (3) 作品ごとに work_dlsite を1件ずつSELECT（N+1）で、30,000作品なら1リクエスト約30,002クエリ。さらに trackCount 算出のためだけに playlists_json を全件JSONパースしており、30,000件で生JSON約30MB・オブジェクト化後60〜120MBの復元コストがかかる。

2026-07-19のパフォーマンス調査（Codex読み取り調査+裏取り）で最優先と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 work_dlsite の取得がJOINまたは一括取得になり、listSummaries のSQL発行数が作品数に比例しない（定数本）
- [x] #2 listSummaries が playlists_json を読まない（track_count を works テーブルに保存しスキャン/更新時に維持する等）
- [x] #3 既存のユニットテスト・pnpm check がすべて通る
- [x] #4 SQL発行本数が作品数に依存しない（N=1とN=100で同本数になるテスト）
- [x] #5 track_count が既存仕様（default_playlist指定ありは指定PLのトラック数、指定なしは先頭PL、PLなしは0）と一致し、insert/update双方で更新される
- [x] #6 work_dlsite 行がない作品は emptyDlsiteState() になる。DLsite一括取得のN+1（real/index.ts:348 の getWork 逐次呼び）も解消する
- [x] #7 スキーマ変更時のuser_version更新とDB再構築の扱いを明示する（fingerprint列を追加するTASK-75と時期を調整し、短期間に複数回バージョンを上げない）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. catalogSchemaのworksにtrack_count+fingerprint追加、catalog v5へ、db:generateでマイグレーション生成 2. upsertWorkでtrack_count維持（defaultPlaylistOf流用、insert/update双方） 3. rowToSummaryをtrack_count列使用に変更、queryWorksのSELECTからplaylists_json除去、listSummariesをdlsite LEFT JOINの専用クエリ化（SQL2本）、tagMap生SQL化 4. runDlsiteBulkの全件getWork廃止（listSummariesベース、fetch失敗時のみ個別getWork） 5. テスト: track_count insert/update維持・SQL発行数N=1/N=100同一（queryフック計測）・dlsite行なしemptyDlsiteState 6. AC#7の扱いをnotesに記録 7. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
スキーマ変更の扱い（AC#7）: catalog v5 で track_count（本タスク）と fingerprint（TASK-75 先行分）を同時追加し、バージョン更新を1回に集約（TASK-75 では列追加しない）。本プロジェクトは user_version 不一致時に DB を再作成する設計のため既存データの移行コードは持たず、v4 DB は起動時に再作成されスキャンで再構築される。drizzle/catalog/0004_far_red_skull.sql を生成済み。
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): DB分離(DRAFT-27)着手が決まったため、N+1解消の投影設計・契約テストは継続でOKだが、旧DDL(db.ts)への列追加(track_count等)は保留推奨。新catalogスキーマ初期版(TASK-71のADR後)に含める方針。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
listSummariesをdlsite LEFT JOINの専用クエリ化しSQL定数2本化（N+1解消）。works.track_count列を新設しupsertWorkで維持、rowToSummaryはplaylists_jsonを読まない。runDlsiteBulkの全件getWorkもlistSummariesベースに解消。スキーマはcatalog v5でTASK-75のfingerprint列と同時追加。テスト7件追加（track_count仕様・SQL発行数N=1/N=100同一・playlists_json非読・emptyDlsiteState）。pnpm check・pnpm test(server200/client273)すべてパス
<!-- SECTION:FINAL_SUMMARY:END -->
