---
id: TASK-57
title: listSummaries のN+1クエリ解消と軽量投影（数千件規模対応）
status: To Do
assignee: []
created_date: '2026-07-19 02:01'
updated_date: '2026-07-19 04:07'
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
- [ ] #1 work_dlsite の取得がJOINまたは一括取得になり、listSummaries のSQL発行数が作品数に比例しない（定数本）
- [ ] #2 listSummaries が playlists_json を読まない（track_count を works テーブルに保存しスキャン/更新時に維持する等）
- [ ] #3 既存のユニットテスト・pnpm check がすべて通る
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): DB分離(DRAFT-27)着手が決まったため、N+1解消の投影設計・契約テストは継続でOKだが、旧DDL(db.ts)への列追加(track_count等)は保留推奨。新catalogスキーマ初期版(TASK-71のADR後)に含める方針。
---
<!-- COMMENTS:END -->
