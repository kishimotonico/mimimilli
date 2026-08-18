---
id: TASK-301
title: 'smoke: クイックオーバーレイの残留でクリックがブロックされ主要画面ヨコスクロールテストがフレーキーになる'
status: Done
assignee: []
created_date: '2026-08-10 23:27'
updated_date: '2026-08-11 05:20'
labels: []
dependencies: []
ordinal: 311000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
tests/smoke/library.smoke.spec.ts の「主要画面でヨコ方向スクロールが発生しない」が、AxisQuickOverlay（.mll-qoverlay--fixed）に作品タイトルのクリックをブロックされて30秒タイムアウトで落ちる。当初はテスト順不同の既存フレーキーと見立てていたが、切り分けの結果TASK-294のヘッダー行削除で顕在化した回帰と判明した。ページ全体リロード直後、静止したカーソルの直下に軸行が現れるとブラウザのhover再計算で実際のポインタ移動なしにpointerenterが発火し、useHoverGroupCoordinatorの200ms遅延を経てオーバーレイが自動的に開く。ヘッダー削除でリスト行が上に詰まり、オーバーレイの縦方向footprintと重なる位置に来たことで踏むようになった。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 同ファイルの全テストを通しで実行してもオーバーレイのクリックブロックで失敗しない
- [x] #2 根本原因（オーバーレイが自動的に開く条件）が特定され、修正または意図的な仕様として記録される
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-294のヘッダー行削除で顕在化した回帰と特定し、useHoverGroupCoordinatorで根本対処した。実際のポインタ移動を観測するまでホバー起動を無視し、最初の移動時点でホバー状態を再評価する。パネル外へのpointerdownでは退出タイマーを待たず即座に閉じる。修正はTASK-294〜298と同じコミットに含まれる。--repeat-each=5 で当該specが50/50通過、pnpm test:smoke 10/10。
<!-- SECTION:FINAL_SUMMARY:END -->
