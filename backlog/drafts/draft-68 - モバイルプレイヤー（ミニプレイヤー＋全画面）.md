---
id: DRAFT-68
title: モバイルプレイヤー（ミニプレイヤー＋全画面）
status: Draft
assignee: []
created_date: '2026-08-18 23:13'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-14 の本文を現状に合わせて書き直したもの（2026-08-19の棚卸し）。旧タイトルに入っていた MediaSession は既に実装済みで、残件は狭幅UIだけ。

## 実装済みの部分

MediaSession はデスクトップ共通実装として完成している（`client/src/features/player/model/useMediaSession.ts`、TASK-52）。ロック画面・イヤホン操作への対応はここで賄える見込みで、本ドラフトで新規に作るものではない。`docs/ARCHITECTURE.md` のレビューメモにも「MediaSession と resume は実装済み、MobileShell・PWA は未実装」と記載がある。

再生位置のサーバー保存（続きから再生）も実装済み（`POST /works/:id/resume`、`useResumePersistence`）。

## 残件: 狭幅UI

- 画面下固定のミニプレイヤー
- タップで展開する全画面プレイヤー（既存 `FullScreenPlayer` のモバイル対応）
- 既存の `PlayerDock` / `BarContent` / `FullScreenPlayer` との共有範囲は TASK-30 で決めた分岐方針に従う

## 受け入れ条件（案）

- スマホ幅でミニプレイヤーが表示され、タップで全画面プレイヤーに展開できる
- 画面ロック中も再生が継続し、ロック画面から再生/一時停止/シークができる（MediaSessionの既存実装がモバイルでも効くことの確認）

## 着手条件

`MobileShell` / `useMediaQuery` はまだ存在しない（`rg 'MobileShell|useMediaQuery' client/` でヒットなし）。モバイルシェル（DRAFT-19）が前提。
<!-- SECTION:DESCRIPTION:END -->
