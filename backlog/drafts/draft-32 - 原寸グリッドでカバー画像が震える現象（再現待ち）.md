---
id: DRAFT-32
title: 原寸グリッドでカバー画像が震える現象（再現待ち）
status: Draft
assignee: []
created_date: '2026-07-26 14:44'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
サイズスライダーの操作中に、原寸（ジャスティファイド）グリッドのカバー画像が細かく震える現象が報告された。

**現時点では対応できない。** 報告後の調査では再現しておらず、原因を絞り込めていない。推測で修正を入れると、直ったのか元々出なかっただけなのか判別できないまま副作用だけが残るため、再現するまで着手しない。

## 分かっていること

- 発生モードは justified（原寸）。square では未報告
- ウィンドウ幅が中くらいのときに発生
- ライブラリの作品数は11件程度
- 報告環境で `.mll-grid-scroll` の offsetWidth - clientWidth は 0（オーバーレイスクロールバー）

## 棄却済みの仮説

- **ResizeObserverとスクロールバー出没のフィードバックループ**: 否定。報告環境で差0px、調査環境の実測でも36フレーム連続でコンテナ幅・要素幅ともに1pxも変動しなかった。ループ自体はコード上成立しうるが、スクロールバーが幅を消費しないため閉じない
- **CSS transition**: 対象は background と color のみでサイズ系に掛かっていない
- **virtualizerのestimateSizeと実測のズレ**: measureElement はDOM実測せず estimateSize を返す実装なので、その経路での往復は無い

## 次の容疑者

TanStack Virtual の測定キャッシュと scrollTop 補正。justified のときだけ useEffect で virtualizer.measure() を呼んでおり square には無い、という非対称がある（client/src/features/library/ui/WorkGrid.tsx:243 付近）。viewport上方の行にサイズ差分が出ると scrollTop が補正されるため、スクロール途中の状態で縦方向の震えとして現れうる。

## 再現したときに記録すること

ウィンドウ幅・作品数・スクロール位置・モード・震えの方向（縦か横か）。これらが揃って再現手順が固まったらタスクへ昇格させる。
<!-- SECTION:DESCRIPTION:END -->
