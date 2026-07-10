---
id: TASK-24
title: 作品カバーのサムネイル配信API（サイズ指定・キャッシュ）
status: Done
assignee:
  - '@fable'
created_date: '2026-07-07 11:58'
updated_date: '2026-07-10 00:14'
labels:
  - feature
  - backend
dependencies: []
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
グリッド表示で数百件のカバーを並べる前提となる、サイズ指定つきサムネイル配信の整備。現状 /api/media/cover/:id は原寸ファイルをそのまま返しており、多数同時表示だと重い。

sharp を導入し、幅を指定して縮小・webp 化した画像を返す。生成結果はディスクにキャッシュ（作品ID・幅・元ファイルmtimeをキーに）し、再生成を避ける。許可する幅は数種（例: 128/256/512）に限定してキャッシュを有界にする。fixtureアダプタのSVG合成カバーはベクタなのでリサイズ不要（そのまま/スケール返却でよい）。real アダプタで sharp リサイズを行う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 既存の /api/media/cover/:id に幅指定クエリ（例 ?w=256）で縮小画像を返せる
- [x] #2 生成したサムネイルがディスクにキャッシュされ、2回目以降は再生成されない
- [x] #3 元カバーが更新されたらキャッシュが無効化される（mtime等をキーに含む）
- [x] #4 許可幅は所定の離散値に制限され、未対応の幅は最近傍にフォールバックまたは拒否される
- [x] #5 fixtureアダプタでも幅指定リクエストが破綻せずカバーを返せる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sharp導入(server) 2. /api/media/cover/:id に ?w= 対応・許可幅制限 3. ディスクキャッシュ(id/幅/mtimeキー) 4. fixtureはSVGそのまま返却 5. テスト・check
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント実装、Fableがレビュー・検証。pnpm check(shared/server)・test:server 85件全パス。fixture単体起動でcurl検証: ?w=256でSVG原寸返却、?w=abc/-5は400(apiError形式)を確認。real側のsharpリサイズ・キャッシュ・mtime無効化はthumbnail.test.ts等11件で担保。キャッシュGC(古いmtimeキーの掃除)は未実装、必要ならフォローアップ起票を要相談。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GET /api/media/cover/:id に ?w= を追加。許可幅128/256/512へ最近傍正規化(shared/src/api.ts)、realはsharpでwebp化しdata/cache/thumbnails/へmtimeキーでキャッシュ、fixtureはSVG原寸返却。コミット ce2ba08。
<!-- SECTION:FINAL_SUMMARY:END -->
