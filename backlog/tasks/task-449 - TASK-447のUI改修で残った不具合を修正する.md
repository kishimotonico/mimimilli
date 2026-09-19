---
id: TASK-449
title: TASK-447のUI改修で残った不具合を修正する
status: To Do
assignee: []
created_date: '2026-09-19 10:53'
updated_date: '2026-09-19 11:04'
labels: []
dependencies: []
priority: medium
ordinal: 503000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機確認で見つかった不具合2件。feat/ui-ux-intake を master へマージした後に対応する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 再生中タブ・没入モードで速度メニューを開いたとき、1.25x/1.5x/2.0xなど下側の項目がシークバー（.mle-nowplaying__seek、position:fixed;z-index:41）に隠れずクリックで選択できる
- [ ] #2 タグprefix設定の各行で、上移動ボタンと下移動ボタンが実機で見分けられる（実装はTagPrefixRow.tsxで両ボタンともI.chevDを使い、上移動側はrotate-180で反転させているが、両ボタンともh-[13px]で高さを詰めており、この高さ詰めが向きの差を潰している可能性がある。原因は未特定のため確認が必要。特定の実装手段は問わない）
<!-- AC:END -->
