---
id: TASK-14
title: ライブラリのグリッド表示（カバー主体・サイズ連続調整）とビュー切替
status: Done
assignee:
  - '@codex'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 01:21'
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
- [x] #1 AddressBarのリスト/グリッド切替が機能し、選択モードが localStorage で永続化される（再読込後も維持）
- [x] #2 グリッド表示はカバー画像を主役にしたタイルで、作品名・サークル名・サムネイルが欠落なく表示される
- [x] #3 タイルサイズをスライダーおよびCtrl+ホイールで連続的に変更でき、その値が永続化される
- [x] #4 グリッドモードでは軸レール以外の全幅をグリッドが使い、未選択時に右半分が空白にならない
- [x] #5 カバー未設定の作品はプレースホルダー（riso色＋イニシャル等）で表示される
- [x] #6 カバー取得は TASK-24 のサイズ指定サムネイルを用い、lazy読み込みでレイアウトシフトしない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex実装（worktree: task-14-grid ブランチ、コミット b93b1de + Fableの微修正=THUMBNAIL_WIDTHSのshared再利用）。Fableがworktree上のvite(5199)で実機検証済み: ビュー切替・全幅グリッド・タイル176→260pxスライダー・Ctrl+ホイール(260→230px)・localStorage永続化(mimimilli:libraryViewMode/libraryTileSize)・?w=128/256の切替とlazy・タイル選択→詳細ペイン・ダブルクリック再生、全AC動作確認。client check/test 81件パス。masterへのマージはTASK-20完了後（App.tsxが競合するため待機中）。

masterへマージ完了（App.tsx/LibraryViewはTASK-20と自動マージ、競合なし）。マージ後にpnpm check・client 88件・server 91件・ビジュアルテスト6件全パス、dev サーバー実機でグリッド動作を再確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
AddressBarのリスト/グリッド切替を配線し、カバー主体の全幅グリッド（タイル100-280px連続調整・スライダー+Ctrl+ホイール・localStorage永続化・?w=サムネイル+lazy・riso色プレースホルダー・クリック選択/ダブルクリック再生）を実装。Codex実装+Fable検証。コミット b93b1de（マージ済み）。
<!-- SECTION:FINAL_SUMMARY:END -->
