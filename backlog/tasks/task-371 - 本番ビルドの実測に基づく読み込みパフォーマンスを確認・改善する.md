---
id: TASK-371
title: 本番ビルドの実測に基づく読み込みパフォーマンスを確認・改善する
status: To Do
assignee: []
created_date: '2026-08-21 11:15'
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
- [ ] #1 preview環境で初回ロードと主要操作のNetworkウォーターフォール・Lighthouse計測結果が記録されている
- [ ] #2 vite build のバンドル構成（チャンクサイズ内訳）が確認され、過大なチャンクがあれば分割などの対処が行われている
- [ ] #3 Icon.tsx の集約importの影響が実測で判定され、対応の要否と根拠が記録されている
- [ ] #4 改善を行った場合は改善前後の計測値の比較が記録されている。問題なしの場合はその根拠が記録されている
<!-- AC:END -->
