---
id: TASK-90
title: グリッド仮想化と.mll-gridのpadding衝突によるレイアウト崩れを修正
status: To Do
assignee: []
created_date: '2026-07-24 13:28'
labels: []
dependencies: []
priority: high
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-59で導入した行仮想化（WorkGrid.tsx:540-557の position:absolute; left:0; width:100% な行ラッパー）と、.mll-grid（position:relative）に付いたCSS padding:16px（shell.css:537）が衝突し、ライブラリのグリッド表示が左右非対称に崩れる。絶対配置の子の left:0/width:100% は padding box 基準で解決されるため親の水平paddingが効かず、一方 containerWidth は ResizeObserver.contentRect（padding除外）を使うためズレる。左16pxガター消失＋右32px過剰余白。作品詳細（インスペクター）展開時は .mll-grid-pane.is-inspector-open .mll-grid の padding-right（shell.css:562）が同じ理由で効かず別の崩れ方をする。縦方向はJS側 paddingStart/paddingEnd と CSS padding が偶然一致した二重管理状態。Codexマージ後の実機確認(2026-07-24)で発覚。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 .mll-grid の水平padding衝突を解消し、グリッド（1:1タイル/ジャスティファイド両モード）が左右対称に正しく整列する
- [ ] #2 インスペクター（作品詳細）展開時に右余白が正しく確保され、タイルがインスペクターの裏に隠れない
- [ ] #3 縦方向paddingのJS/CSS二重管理を解消し、ドッキングバー表示時の下余白も正しく効く
- [ ] #4 WorkGrid/ContentColumn の関連ユニットテストとビジュアルスナップショットが更新され、pnpm check・pnpm test が通る
<!-- AC:END -->
