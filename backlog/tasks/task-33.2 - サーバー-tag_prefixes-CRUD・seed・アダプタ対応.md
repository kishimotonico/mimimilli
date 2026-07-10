---
id: TASK-33.2
title: 'サーバー: tag_prefixes CRUD・seed・アダプタ対応'
status: Done
assignee: []
created_date: '2026-07-10 19:38'
updated_date: '2026-07-10 19:52'
labels: []
dependencies:
  - TASK-33.1
parent_task_id: TASK-33
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
prefix定義の永続化とAPIを実装する。

## 内容
- real: tag_prefixesテーブル追加（DDLはCREATE IF NOT EXISTSなのでSCHEMA_VERSION据え置き）。seedはapp_settingsのtag_prefixes_seededフラグで初回のみ（cv/サークル=保護・軸ON、シリーズ・カテゴリ=軸ON、genre=軸OFF）
- ルート: GET/POST /tag-prefixes、PATCH/DELETE /tag-prefixes/:prefix、GET /tag-prefixes/candidates（データ中の未登録prefixと件数）
- adapter境界にlistTagPrefixes等を追加し、fixtureアダプタにも同じ初期値のインメモリ実装
- GET /axes/:axis のenum検証を撤廃（tag/year/任意prefixを受ける）
- タグ書き込み経路（patchWork・dlsiteApply・スキャンのDB取り込み）でnormalizeTagを適用
- ルート・アダプタのテスト
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /tag-prefixesが初期seed（cv・サークル・シリーズ・カテゴリ・genre）を返す
- [x] #2 prefix定義のCRUDがreal/fixture両アダプタで動く
- [x] #3 予約IDやスラッシュ入りprefixの登録が400になる
- [x] #4 全定義を削除して再起動しても再seedされない
- [x] #5 candidatesがデータ中の未登録prefixを件数付きで返す
- [x] #6 patchWork/dlsiteApply経由のタグがnormalizeTagで正規化されて保存される
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
tag_prefixes テーブル（SCHEMA_VERSION据え置き・IF NOT EXISTS）、/tag-prefixes CRUD+candidates ルート、real/fixture 両アダプタ実装、app_settings フラグでの初回seed、workPatchSchema/mergeDlsiteTags/replaceWorkTags での正規化を実装。テストは tagPrefixes.test.ts / real/tagPrefixSeed.test.ts
<!-- SECTION:FINAL_SUMMARY:END -->
