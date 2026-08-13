---
id: TASK-312
title: playlists_json二重投影を廃止し関係表から組み立てる
status: Done
assignee:
  - '@codex'
created_date: '2026-08-12 11:29'
updated_date: '2026-08-12 13:06'
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
- [x] #1 works.playlists_json列がschemaとmigrationから削除されている
- [x] #2 Playlist/Trackの読み取りがすべてplaylists/tracks関係表から組み立てられる
- [x] #3 作品一覧・詳細・resume用トラック解決の既存テストが通る
- [x] #4 既存catalogの扱い（再構築手順）がADRまたはタスクノートに記録されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. catalog schema・migration・全SQL参照を調査し、playlists_jsonを削除する。 2. 関係表からPlaylist/Trackを組み立てる読み取りを統一し、一覧・詳細・resume解決を検証する。 3. catalog再構築とfull scanの手順をタスクノートへ記録し、受け入れ条件と完了状態を更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
既存catalogはschema v8の起動時にバックアップして空の投影を作り直す。手動で再構築する場合もアプリ停止後にdb/catalog.sqliteだけを退避・削除し、db/user.sqliteは残す。起動後、POST /api/scan に {"full":true} を送ってfull scanを完了し、GET /api/scan/diagnosticsでidentity_conflict・不正sidecar・broken referenceがないことを確認する。migration 0011はplaylists/tracksをデータコピーせず再作成し、works.playlists_jsonをDROPする。

検証: bun test tests/real/listSummaries.test.ts tests/real/workRepoPersistence.test.ts tests/real/resume.test.ts tests/real/catalogProbeCacheMigration.test.ts（19 pass）。git diff --check成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
works.playlists_jsonを削除し、詳細とresumeのTrack解決をplaylists/tracks関係表へ統一した。Playlist/TrackはWork配下の複合キーにし、catalog v8で再構築する。migration 0011は関係表をデータコピーせず空で作り直す。
<!-- SECTION:FINAL_SUMMARY:END -->
