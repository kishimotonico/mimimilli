---
id: TASK-108
title: ビジュアルテストのフォント依存を解消する
status: To Do
assignee: []
created_date: '2026-07-26 15:13'
labels: []
dependencies: []
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/index.html が Geist・IBM Plex Sans JP・JetBrains Mono を Google Fonts から読み込んでいるため、ビジュアルテストのスナップショットがリモートのフォント配信とChromiumのラスタライズに依存している。実測では tag filter result grid のスナップショットが、コード変更なしの状態で現環境と3449px乖離していた(閾値は maxDiffPixels 1200)。差分の大半は CoverPlaceholder の SVG text が指定する IBM Plex Sans JP のグリフのエッジで、32のviewBoxをカードサイズへ拡大するため微小なヒンティング差が数千pxに拡大する。フォントを自前ホストして決定性を確保する。あわせて、実行時にネットワークからアセットを取得しない方針(ADR-0009の帰結でも触れている)にも整合する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 アプリの起動時に Google Fonts へのネットワークリクエストが発生しない
- [ ] #2 フォントファイルがリポジトリまたはビルド成果物に含まれ、オフラインで同じ描画になる
- [ ] #3 ビジュアルテストを連続2回実行してスナップショット差分が出ない
- [ ] #4 client/index.html に fonts.googleapis.com / fonts.gstatic.com への参照が残っていない
<!-- AC:END -->
