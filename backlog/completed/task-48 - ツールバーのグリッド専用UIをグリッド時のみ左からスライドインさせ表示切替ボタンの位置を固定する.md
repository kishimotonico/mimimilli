---
id: TASK-48
title: ツールバーのグリッド専用UIをグリッド時のみ左からスライドインさせ表示切替ボタンの位置を固定する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-18 20:22'
updated_date: '2026-07-18 20:52'
labels: []
dependencies: []
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
グリッド⇔リスト/カラム切替時、グリッド専用UI（1:1/ジャスティファイドのレイアウトトグル＋タイルサイズスライダー、約200px）が条件レンダリングでDOMから消え、flex:1のパンくずが伸縮して右側のボタン群が大きく横シフトする。

対応方針（ユーザー確定済み・案C系）: 表示形式トグル（カラム/リスト/グリッド）を含む主要ボタン群は右側の固定位置に置き、グリッド専用UIはグリッド選択時にだけ表示形式トグルの左側から「にゅっと」スライドインして出現する見せ方にする。主要ボタン（表示形式トグル・並び替え・その他）の位置は切替前後で動かないこと。

実装箇所: client/src/app/ui/AddressBar.tsx（DOM順: 戻る/進む→パンくず(flex:1)→表示形式トグル94-119行→グリッドレイアウトモード121-138行→タイルサイズスライダー140-156行→並び替え→その他）、client/src/styles/shell.css:188-214（.mle-addr / .mle-crumbs）、.mll-grid-size は shell.css:282-299。呼び出し元 App.tsx:335-342, 371-374。

アニメーションは docs/design-system.md の motion 規約に従う（幅 or transform のトランジション、prefers-reduced-motion 配慮）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 グリッド⇔リスト/カラムを切り替えても、表示形式トグル・並び替え・その他ボタンの画面上の位置が動かない
- [x] #2 グリッド選択時、グリッドレイアウトモードトグルとタイルサイズスライダーが表示形式トグルの左側にスライドインして出現し、非グリッド時は消える
- [x] #3 出現・退場にmotion規約に沿ったトランジションがあり、prefers-reduced-motionでは即時切替になる
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex(thread 019f76e9-80d4)が実装。グリッド専用UIを表示形式トグルの左隣へ移動し、.mle-grid-controls（grid-template-columns 0fr/1fr + opacity + translateX、180ms ease-out、prefers-reduced-motion対応）でスライドイン。非表示時は disabled + aria-hidden。pnpm check・test通過。AC1-3はブラウザ実機確認で検証予定。

ブラウザ実機検証(agent-browser): 切替前後で主要ボタンのbounding box完全一致、スライドイン出現・aria-hidden/disabled・Tabフォーカス除外・スライダー動作を確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
グリッド専用UI(レイアウトトグル+タイルサイズスライダー)を表示形式トグルの左隣へ移動し、.mle-grid-controls(grid-template-columns 0fr/1fr+opacity+translateX、prefers-reduced-motion対応)でスライドイン化。主要ボタンの位置は切替前後でピクセル一致することを実機確認。check/test通過。
<!-- SECTION:FINAL_SUMMARY:END -->
