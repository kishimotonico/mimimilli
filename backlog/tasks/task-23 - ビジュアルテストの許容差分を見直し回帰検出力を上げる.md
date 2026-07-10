---
id: TASK-23
title: ビジュアルテストの許容差分を見直し回帰検出力を上げる
status: Done
assignee:
  - '@fable'
created_date: '2026-07-06 02:19'
updated_date: '2026-07-10 10:02'
labels:
  - dx
dependencies: []
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-22でdiv→button化に伴うtext-align回帰（行テキストが中央寄せ）が発生した際、test:visualは6件全て通過してしまい回帰を検出できなかった。原因はplaywright.config.tsのmaxDiffPixelRatio: 0.03で、フルページ（1440x960）では約4万pxの差分まで許容されるため、テキストの寄せズレ程度は素通りする。フォント描画ゆらぎの吸収という本来の目的を保ちつつ、この種の回帰を検出できる設定に見直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 テキスト寄せズレ規模のレイアウト回帰（TASK-22のtext-align回帰相当）を検出できる差分設定にする
- [x] #2 フォントのサブピクセル描画ゆらぎによるフレークが発生しないことをtest:visual複数回実行で確認する
- [x] #3 採用した設定値と根拠をplaywright.config.tsのコメントに反映する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. maxDiffPixelRatio(比率)をmaxDiffPixels(絶対値)+threshold指定へ変更 2. TASK-22回帰規模の検出可能性を試算 3. test:visualを複数回実行してフレーク確認 4. 根拠をコメント化
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
maxDiffPixelRatio:0.03→maxDiffPixels:1200へ変更。効果を即実証: 旧設定で素通りしていた7383pxの恒常差分（Devtools撤去+ビュー切替有効化の正当な変更、ベースライン未更新）を新設定が検出→ベースライン更新。更新後にtest:visualを3回連続実行し全パス（フレークなし）。根拠はconfigコメントに記載。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ビジュアル比較の許容差分を絶対値1200pxに変更（ゆらぎ数百px<1200<回帰数千px）。TASK-22相当の回帰を検出可能に。コミット済み。
<!-- SECTION:FINAL_SUMMARY:END -->
