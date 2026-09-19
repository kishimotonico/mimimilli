---
id: TASK-428.23
title: ポップオーバーの閉じ方とPointer dragの主ボタン判定を統一する
status: Done
assignee: []
created_date: '2026-09-07 09:09'
updated_date: '2026-09-09 14:57'
labels:
  - ui
  - interaction
  - player
dependencies: []
modified_files:
  - client/src/shared/ui/TagCombobox.tsx
  - client/src/features/player/ui/PopupContent.tsx
parent_task_id: TASK-428
priority: medium
ordinal: 450000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VIS-05/VIS-06、player-A-12。ポップオーバーの閉じ方が実装ごとに違い、Pointer dragが主ボタン以外でも始まる。共通の閉じ方とdrag開始条件へ揃える。

前提（統合済みの変更）: client/src/shared/ui/TagCombobox.tsx には3つのタスクが手を入れている。TASK-428.13 が Escape の階層契約（候補表示中は候補だけ閉じる／候補が閉じているときは onCancel があればそれを呼ぶ／onCancel が無ければネイティブ dialog の cancel へ素通し／IME変換中は無視）、TASK-428.17 が Enter の isComposing ガード、TASK-428.24 が commitPendingInput（Enterと同じ規則で未確定入力を確定 or 入力欄へ戻す、useImperativeHandle 経由の ref API）と createLabel prop（既定は「新規作成」のまま）を追加している。428.24 の担当から「forwardRef 化に伴いコンポーネント定義を TagComboboxImpl（内部関数）+ forwardRef(TagComboboxImpl) に分割したので、props の分割代入位置が関数シグネチャの第一引数に移動している点に注意」という申し送りがある。

client/src/features/player/ui/PopupContent.tsx は TASK-428.13 が data-player-control 属性を付与済み（−10/+10・速度トリガー・前/再生一時停止/次・ループ。速度メニュー項目自体は role=menu 配下として従来どおり除外）。

Escape の扱いは docs/design-system.md の「グローバルショートカット / Escape」節に記載された契約に従うこと。既存契約を壊さずに閉じ方を統一すること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TagComboboxと速度menuが外側クリック・focus移動・scroll・Escapeで閉じる
- [x] #2 候補選択・速度選択・矢印キー操作を維持する
- [x] #3 seek・AB・popup dragはmouse主ボタンだけで開始する
- [x] #4 右・中央クリックの標準動作を妨げない
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
