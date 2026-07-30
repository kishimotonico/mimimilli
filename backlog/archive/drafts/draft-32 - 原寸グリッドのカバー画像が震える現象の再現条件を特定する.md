---
id: DRAFT-32
title: 原寸グリッドのカバー画像が震える現象の再現条件を特定する
status: Draft
assignee: []
created_date: '2026-07-26 14:41'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
サイズスライダーの操作中に、原寸（ジャスティファイド）グリッドのカバー画像が細かく震える現象が報告された。ただし再現性が低く、現時点では調査時に再現できていないため、まず再現条件を確定させる必要がある。

## 分かっていること

- 発生モードは justified（原寸）。square では未報告
- ウィンドウ幅が中くらいのときに発生した
- ライブラリの作品数は11件程度
- 報告環境で `.mll-grid-scroll` の offsetWidth - clientWidth は 0（オーバーレイスクロールバー）

## 棄却済みの仮説

- **ResizeObserverとスクロールバー出没のフィードバックループ**: 否定。報告環境で差0px、調査環境の実測でも36フレーム連続でコンテナ幅・要素幅ともに1pxも変動しなかった。ループ自体はコード上成立しうるが、スクロールバーが幅を消費しないため閉じない
- **CSS transition**: 対象は background と color のみでサイズ系に掛かっていない
- **virtualizerのestimateSizeと実測のズレ**: measureElement はDOM実測せず estimateSize を返す実装なので、その経路での往復は無い

## 次の容疑者

TanStack Virtual の測定キャッシュと scrollTop 補正。justified のときだけ useEffect で virtualizer.measure() を呼んでおり square には無い、という非対称がある（client/src/features/library/ui/WorkGrid.tsx:243 付近）。viewport上方の行にサイズ差分が出ると scrollTop が補正されるため、スクロール途中の状態で縦方向の震えとして現れうる。

## 着手時にやること

再現できたら、その時点のウィンドウ幅・作品数・スクロール位置・モードを記録する。再現手順が固まったらタスクへ昇格させる。再現条件が確定しないまま推測で修正を入れないこと。
<!-- SECTION:DESCRIPTION:END -->
