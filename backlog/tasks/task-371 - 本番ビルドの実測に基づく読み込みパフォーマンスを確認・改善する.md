---
id: TASK-371
title: 本番ビルドの実測に基づく読み込みパフォーマンスを確認・改善する
status: Done
assignee: []
created_date: '2026-08-21 11:15'
updated_date: '2026-08-21 11:44'
labels: []
dependencies:
  - TASK-370
ordinal: 371000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-370のpreviewフロー整備後、本番ビルドを実測して読み込みの遅さが残るかを判定し、残っていれば改善する。2026-07のperf調査（doc-2）で挙がった問題は全て対処済みのため、静的調査ではなく実測ベースで進める。

進め方:
- preview環境（fixture largeシナリオ推奨）でNetworkウォーターフォールとLighthouseを実測し、初回ロード・一覧表示・詳細表示のボトルネックを特定する
- vite build のバンドルサイズを確認し、必要なら manualChunks でvendor分割する
- shared/ui/Icon.tsx のlucide集約importがバンドルへ与える影響を実測で確認する（ツリーシェイクが効いていて問題なければ対応なしと根拠を明記）
- Vite dev serverそのもののチューニングはスコープ外（devの重さはTASK-370のpreviewで回避するのが本筋）
- 問題が残っていなければ、計測結果を根拠として「対応なし」でクローズしてよい
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 preview環境で初回ロードと主要操作のNetworkウォーターフォール・Lighthouse計測結果が記録されている
- [x] #2 vite build のバンドル構成（チャンクサイズ内訳）が確認され、過大なチャンクがあれば分割などの対処が行われている
- [x] #3 Icon.tsx の集約importの影響が実測で判定され、対応の要否と根拠が記録されている
- [x] #4 改善を行った場合は改善前後の計測値の比較が記録されている。問題なしの場合はその根拠が記録されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実測結果（preview:fixture:large、キャッシュ無効2回ずつ）: FCP 136-152ms / DCL 111-125ms / LCP 624-717ms（うちRender delay 97-99%、TTFB 4-5ms）。総転送1.92MB・113リクエスト。/api/works 8.4ms・82KB、詳細オープンは単発リクエスト6.7ms・1.9KB（N+1なし）。バンドル: 単一主chunk 803KB(gzip 249KB)+CSS 417KB、遅延chunkはFilesView/ScanModal/SettingsModalのみ。DOM総要素数768（仮想化有効）。Lighthouse: A11y 95 / BP 100 / SEO 83（performanceカテゴリはツール非対応、traceで代替）。

判定: ネットワーク起因の遅さは本番ビルドで解消（転送・API応答ともボトルネックでない）。LCPの大半はJS初回実行・React初回描画のRender delayで、620-720msはローカル好条件下として妥当な水準。追加改善は行わない。

AC#2根拠: distチャンク構成を実測記録（主chunk 803KB、Vite 500KB警告あり）。manualChunks分割は対応なしと判断: 律速はネットワークでなくJS実行時間のため分割してもパース・実行総量は不変で、ローカル配信＋assets immutableキャッシュ環境では分割キャッシュの利得も小さい。

AC#3根拠: Icon.tsxのnamed import 39個に対し、dist内に未使用lucideアイコン（Zap/Anchor/Airplay/Waves等）の混入0件をrgで確認。ツリーシェイク正常のため対応なし。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
preview:fixture:largeで本番ビルドを実測（各2回）。FCP 136-152ms・LCP 624-717ms・TTFB 4-5ms・API 6-8msでネットワーク起因の遅さは解消済みと判定。lucideツリーシェイク正常（39アイコンのみ）、manualChunks分割は効果薄のため、コード変更なしでクローズ。devの重さはVite dev server特有でpreviewフロー（TASK-370）が対策。
<!-- SECTION:FINAL_SUMMARY:END -->
