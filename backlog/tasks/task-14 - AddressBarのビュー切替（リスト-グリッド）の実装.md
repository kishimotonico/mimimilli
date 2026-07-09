---
id: TASK-14
title: ライブラリのグリッド表示（カバー主体・サイズ連続調整）とビュー切替
status: To Do
assignee: []
created_date: '2026-07-05 17:59'
updated_date: '2026-07-07 12:00'
labels:
  - feature
dependencies:
  - TASK-24
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AddressBarのリスト/グリッド切替ボタンは存在するが disabled のまま（client/src/app/ui/AddressBar.tsx、App.tsxから未配線）。これを配線し、カバー画像を主役にしたグリッド表示を実装する。

方針（設計確定事項）:
- グリッドモードでは軸レール以外の body 全幅をグリッドが使う（リストモードの300px固定コンテンツ列は使わない）。未選択時は全幅グリッドのみで右半分の空白が生じない。
- タイルはカバーを正方形（aspect-ratio:1, object-fit:cover）で主役にし、下に作品名（1〜2行）＋サークル名。デザインシステムの --shadow-cover を使う。カバー無し作品は riso 系カラー＋イニシャルのプレースホルダー（fixtureのSVG合成と同発想）。
- タイルサイズは連続調整。CSSは repeat(auto-fill, minmax(var(--tile-size), 1fr)) とし、--tile-size をスライダー（約100〜280px）で動かす。Ctrl+ホイールでも増減。既存の GridSize(S/M/L/XL) 離散型は使わず連続値に統一する。
- カバーは TASK-24 のサイズ指定サムネイルAPIを利用し、タイルサイズ×DPRに近い幅をリクエスト。loading=lazy、aspect-ratio固定でレイアウトシフト防止。多数表示対策に content-visibility:auto（contain-intrinsic-sizeにタイル寸法）。仮想スクロールは当面入れず、必要になったら別タスク化。
- ビューモード(list/grid)とタイルサイズは localStorage に永続化（atomWithStorage。前例: player/model/atoms.ts）。URLには載せない（個人設定のためナビ履歴を汚さない）。
- シングルクリックで詳細を開く（選択＝詳細表示、リストと同じ操作系）。ダブルクリック/Enterで再生。詳細ペインの見せ方は後続タスク（グリッド時の右インスペクタ）で扱う。
- リストモードは現行の2ペイン分割を維持。切替は既存 ViewMode 準備型/AddressBar props を活用。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AddressBarのリスト/グリッド切替が機能し、選択モードが localStorage で永続化される（再読込後も維持）
- [ ] #2 グリッド表示はカバー画像を主役にしたタイルで、作品名・サークル名・サムネイルが欠落なく表示される
- [ ] #3 タイルサイズをスライダーおよびCtrl+ホイールで連続的に変更でき、その値が永続化される
- [ ] #4 グリッドモードでは軸レール以外の全幅をグリッドが使い、未選択時に右半分が空白にならない
- [ ] #5 カバー未設定の作品はプレースホルダー（riso色＋イニシャル等）で表示される
- [ ] #6 カバー取得は TASK-24 のサイズ指定サムネイルを用い、lazy読み込みでレイアウトシフトしない
<!-- AC:END -->
