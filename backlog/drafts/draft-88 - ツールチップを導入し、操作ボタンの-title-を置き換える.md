---
id: DRAFT-88
title: ツールチップを導入し、操作ボタンの title を置き換える
status: Draft
assignee: []
created_date: '2026-11-27 13:58'
labels:
  - ui
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
操作ボタンの説明はブラウザ任せの `title` 属性で、表示までの時間・見た目・キーボードフォーカスでの表示・無効なボタンの理由が不揃い。`title=` は client/src に約112行ある。ツールチップは「置き換え」ではなく新しい機能として、Ark の Tooltip で作る。DRAFT-53 や段階4には依存しない。

範囲の案: (a) 操作ボタン・アイコンボタン・状態ラベル・無効の理由（約70）、(b) 省略テキストの全文表示も含める（約40、WorkRow・WorkTile・FileRow・GroupValue 系）。既定は (a) で、省略テキストは `title` のまま残す。

ドラフトのままにしている理由: 範囲と、見た目（背景・文字色・角・影・文字サイズ・矢印・最大幅・複数行、ショートカットの併記の書式、現行 `title` の文言を変えるか）が未決。モックで相談してから起票する。段階4のあとに着手する（ツールチップは body へ出すだけでよくなり、ネイティブ dialog・top layer 向けのポータル先の分岐が要らない）。

調査で分かっていること（Ark 5.40.0 の zag 1.47.0 のソースで確認）:
- Esc: Ark の Tooltip は dismissable layer のスタックに入らない。表示中の Esc を document の capture 段で `stopPropagation` する（`preventDefault` はしない）。このため `NowPlayingLayer` や `useWorkResultsDismiss` のように window の bubble 段で Esc を受ける処理と、React のハンドラ（インライン編集の取り消しなど）にも Esc が届かなくなる。**`closeOnEscape: false` を既定にして、ツールチップは Esc を消費しない**。ADR-0043 の「層」の一覧にもツールチップを加えず、この扱いを書く
- 1つの Root を複数のトリガーで共有できる（`triggerValue`。tooltip.machine と tooltip.connect の `data-value`）。`IconButton` にツールチップを埋め込むと約47か所に加えて行の中（スキャンの `RowMenu`、`TagPrefixRow`）にも Root と machine ができるので、共有する形を先に設計で決める。ADR の「汎用ラッパーは作らない」「右クリックメニューは一覧に1つ」との整合を取る
- フォーカスで開くのは focus-visible のときだけ。メニュー・ポップオーバーのトリガー上のツールチップが、層を閉じてフォーカスがトリガーへ戻ったときにどう動くかは、実装時に確かめる
- 遅延は Ark の既定（開く 400ms、閉じる 150ms）から始める
- 洗い出し済みの `title` の出どころ: `IconButton` の `title ?? label`、`ToolButton`・`Button` 経由、`entities/work/ui/Tag.tsx:60`（「削除に失敗しました。クリックして再試行」）、`PlayerTransportControls.tsx:121`（音量 range 自体の `title`。スライダーのドラフトと重なる）、メニュー・ポップオーバーのトリガー上（LibrarySortMenu・PlaybackRatePicker・WorkPlayButton・BarVolumePopover・GroupValueQuickList）、無効の理由（AddressBar の2つなど）、再生ボタンの「続きから」の時刻
- `getByTitle`／`[title` を使うテストが約43行ある。role・名前・`data-testid` に置き換える
- シークバーのホバー時刻表示は自作のまま。Ark の Tooltip にはしない
<!-- SECTION:DESCRIPTION:END -->
