---
id: TASK-108
title: ビジュアルテストのフォント依存を解消する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-26 15:13'
updated_date: '2026-07-30 22:03'
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
- [x] #1 アプリの起動時に Google Fonts へのネットワークリクエストが発生しない
- [x] #2 フォントファイルがリポジトリまたはビルド成果物に含まれ、オフラインで同じ描画になる
- [x] #3 ビジュアルテストを連続2回実行してスナップショット差分が出ない
- [x] #4 client/index.html に fonts.googleapis.com / fonts.gstatic.com への参照が残っていない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Geist/IBM Plex Sans JP/JetBrains Monoのwoff2を同梱しself-host化
2. index.htmlの外部参照削除
3. ビジュアルテスト2連続実行で決定性確認
実装Cursor委譲
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
追加修正: Viteが4KB未満のサブセットwoff2 62個をCSSへbase64インライン化しCSSが660KB/gzip310KBに膨張していたため、build.assetsInlineLimit:0で無効化。CSS 402KB/gzip115KB(-63%)へ。unicode-range分割の遅延取得も回復。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@fontsource（geist/ibm-plex-sans-jp/jetbrains-mono 各5.3.0）でself-host化。index.htmlのGoogle Fonts参照を全除去、dist内grepで外部参照0確認。スナップショット更新不要で連続実行の差分なし（決定性確保）。415テスト・ビジュアル6/6×複数回・pnpm check通過。実装Cursor委譲。
<!-- SECTION:FINAL_SUMMARY:END -->
