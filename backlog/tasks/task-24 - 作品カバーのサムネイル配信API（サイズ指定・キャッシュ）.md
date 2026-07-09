---
id: TASK-24
title: 作品カバーのサムネイル配信API（サイズ指定・キャッシュ）
status: To Do
assignee: []
created_date: '2026-07-07 11:58'
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
- [ ] #1 既存の /api/media/cover/:id に幅指定クエリ（例 ?w=256）で縮小画像を返せる
- [ ] #2 生成したサムネイルがディスクにキャッシュされ、2回目以降は再生成されない
- [ ] #3 元カバーが更新されたらキャッシュが無効化される（mtime等をキーに含む）
- [ ] #4 許可幅は所定の離散値に制限され、未対応の幅は最近傍にフォールバックまたは拒否される
- [ ] #5 fixtureアダプタでも幅指定リクエストが破綻せずカバーを返せる
<!-- AC:END -->
