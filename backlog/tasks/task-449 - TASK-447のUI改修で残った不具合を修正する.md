---
id: TASK-449
title: TASK-447のUI改修で残った不具合を修正する
status: In Progress
assignee:
  - '@koni524361'
created_date: '2026-09-19 10:53'
updated_date: '2026-09-24 08:57'
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
- [x] #1 再生中タブ・没入モードで速度メニューを開いたとき、1.25x/1.5x/2.0xなど下側の項目がシークバー（.mle-nowplaying__seek、position:fixed;z-index:41）に隠れずクリックで選択できる
- [ ] #2 タグprefix設定の各行で、上移動ボタンと下移動ボタンが実機で見分けられる（実装はTagPrefixRow.tsxで両ボタンともI.chevDを使い、上移動側はrotate-180で反転させているが、両ボタンともh-[13px]で高さを詰めており、この高さ詰めが向きの差を潰している可能性がある。原因は未特定のため確認が必要。特定の実装手段は問わない）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1: PlaybackRatePickerのメニューがnowplaying__controls/immersive-minicontrolsのスタッキングコンテキストに閉じ込められてseek行(z41)の下に潜っていた。useAnchoredPopoverにplacement:above追加、document.bodyへポータルして解決。AC2: rotate-180は実は正しく効いていた（Tailwind v4はCSSのrotateプロパティを使いtransformには出ない）。原因はh-[13px]隣接ボタンの視認性不足。1px gapで分離。

AC1は完了（速度メニューをuseAnchoredPopoverでdocument.bodyへポータル化し解決）。AC2はheadlessでの確認では修正前から判別でき、原因が特定できていない（rotate-180は効いており、h-[13px]によるクリップも否定した。対策はgap-pxで2ボタンを1px離しただけ）。ユーザーの実機（Windows側ブラウザ）確認待ち。見分けにくい場合は表示倍率・画面・ブラウザなど再現条件を聞いて原因調査からやり直す。
<!-- SECTION:NOTES:END -->
