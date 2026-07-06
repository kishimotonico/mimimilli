---
id: TASK-23
title: ビジュアルテストの許容差分を見直し回帰検出力を上げる
status: To Do
assignee: []
created_date: '2026-07-06 02:19'
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
- [ ] #1 テキスト寄せズレ規模のレイアウト回帰（TASK-22のtext-align回帰相当）を検出できる差分設定にする
- [ ] #2 フォントのサブピクセル描画ゆらぎによるフレークが発生しないことをtest:visual複数回実行で確認する
- [ ] #3 採用した設定値と根拠をplaywright.config.tsのコメントに反映する
<!-- AC:END -->
