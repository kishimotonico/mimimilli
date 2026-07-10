---
id: DRAFT-14
title: モバイルプレイヤー（ミニプレイヤー＋全画面＋MediaSession）
status: Draft
assignee: []
created_date: '2026-07-10 12:34'
labels: []
dependencies:
  - TASK-30
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマホでのストリーミング再生体験の中核。画面下固定のミニプレイヤーと、タップで展開する全画面プレイヤー（既存FullScreenPlayerのモバイル対応）。MediaSession APIでロック画面・イヤホン操作に対応し、画面オフでも再生継続する。既存のPlayerDock/BarContent/FullScreenPlayerとの共有範囲はTASK-30で決めた分岐方針に従う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマホ幅でミニプレイヤーが表示され、タップで全画面プレイヤーに展開できる
- [ ] #2 MediaSession経由でロック画面から再生/一時停止/シークができる
- [ ] #3 画面ロック中も再生が継続する
<!-- AC:END -->
