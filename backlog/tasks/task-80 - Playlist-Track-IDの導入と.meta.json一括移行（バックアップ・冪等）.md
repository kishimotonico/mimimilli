---
id: TASK-80
title: Playlist/Track IDの導入と.meta.json一括移行（バックアップ・冪等）
status: To Do
assignee: []
created_date: '2026-07-19 05:07'
labels: []
dependencies:
  - TASK-78
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0008の実装第3弾。TASK-78が前提。

やること:
- shared契約: playlistSchema/trackSchemaにid（UUID v4）を追加、defaultPlaylistをdefaultPlaylistIdへ移行。end>start等の不変条件もsuperRefineで定義（doc-1指摘5）
- catalog DBにPlaylist/Track関係表を追加（再スキャンで再構築可能なcatalog分類）
- 既存.meta.jsonへのID一括付与の移行処理: (1)manifest先行採番による冪等な再実行 (2)書き換え前バックアップ (3)元ハッシュとも変更後ハッシュとも一致しないファイルは外部編集として上書きしない、の3要件（ADR-0008修正版の簡略化された手順に従う）
- スキャナの重複UUID処理を「事前列挙+正規化パス安定順で最初の1件が所有」へ置換（現行scanner.tsのその場ランダム再採番を廃止）

注意: .meta.jsonはユーザーの実ライブラリデータ。破壊的変更許容の方針でも、ここだけはバックアップと冪等性を必須とする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 新規スキャンでPlaylist/TrackにUUIDが採番され、meta・catalog関係表に反映される
- [ ] #2 既存metaへの一括ID付与が冪等で、途中停止後の再実行が同じIDを使う（テストで検証）
- [ ] #3 外部編集されたmetaファイルを上書きしない（テストで検証）
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
