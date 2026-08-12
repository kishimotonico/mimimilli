---
id: TASK-312
title: playlists_json二重投影を廃止し関係表から組み立てる
status: To Do
assignee: []
created_date: '2026-08-12 11:29'
labels: []
dependencies:
  - TASK-310
priority: medium
ordinal: 322000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー優先改善2の一部。catalogWorkRepository.upsertWorkCatalogが同一のwork.playlistsをworks.playlists_json列とplaylists/tracks正規化テーブルの両方へ書いており、読み取りも両方が稼働中（workQuerySql.ts:165がplaylists_jsonを読み、catalogWorkRepository.ts:282-288が関係表をJOIN）。PlaylistとTrackは関係表からの組み立てへ一本化し、playlists_json列を削除する。catalogは再構築可能な投影なのでデータ移行は不要（drizzle migrationでの列削除＋再scanで収束）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 works.playlists_json列がschemaとmigrationから削除されている
- [ ] #2 Playlist/Trackの読み取りがすべてplaylists/tracks関係表から組み立てられる
- [ ] #3 作品一覧・詳細・resume用トラック解決の既存テストが通る
- [ ] #4 既存catalogの扱い（再構築手順）がADRまたはタスクノートに記録されている
<!-- AC:END -->
