---
id: DRAFT-81
title: プレイリスト（作品単位とトラック単位）とサイドバーの節
status: Draft
assignee: []
created_date: '2026-11-21 20:25'
labels:
  - library
  - player
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0041 でサイドバーは「ライブラリ」の節だけにし、手で入れるリストは次の段階で「プレイリスト」の節として足すことにした。作品単位とトラック単位の両方を入れられるようにしたい。catalog には作品内のトラック構成として playlists テーブルと Playlist 型が既にある（mimimilli.json の playlists）ので、内部名を先に決める。作品内のトラック構成を「プレイリスト」と呼ぶこと自体も見直す。YouTube 風の再生キューとは役割が違う（キューは別ドラフト候補）。要件未定のためドラフト。
<!-- SECTION:DESCRIPTION:END -->
