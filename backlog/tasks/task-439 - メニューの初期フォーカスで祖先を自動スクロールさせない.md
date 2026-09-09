---
id: TASK-439
title: メニューの初期フォーカスで祖先を自動スクロールさせない
status: Done
assignee: []
created_date: '2026-09-07 20:58'
updated_date: '2026-09-09 15:26'
labels:
  - ui
  - a11y
  - refactor
dependencies: []
ordinal: 460000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-429 で、メニューを開いた直後の初期フォーカスがブラウザ標準の scroll-into-view を誘発し、overflow:hidden な祖先の scrollLeft が 0 から 109px へ動いてメニューの描画位置が 58px ずれる不具合が起きた。原因は既定の .focus() が対象を可視化しようと祖先スクロールコンテナを自動スクロールすること。TASK-429 では対象箇所に preventScroll: true を入れて解消済み。

メニューを開いた直後の初期フォーカスが、メニュー自身の表示位置を動かしてはならない。これは role=menu パターンとして本来あるべき挙動であり、overflow:hidden な祖先の有無に関わらず正しい。同じパターンで preventScroll を付けていない箇所が残っている。

該当箇所（TASK-429 の担当が grep で洗い出し済み、いずれも顕在化するかの検証は未実施）:
- client/src/features/library/ui/LibrarySortMenu.tsx:96 メニューを開いたときの初期フォーカス
- client/src/features/library/ui/preview/WorkPlayButton.tsx:65 同上
- 同じファイル内の矢印キーによる roving focus（LibrarySortMenu.tsx:109、WorkPlayButton.tsx:78）も同じ .focus() 呼び出しパターン

参考: client/src/features/library/ui/AxisValueQuickList.tsx:137 は menuitem ではなく検索input欄への自動フォーカスだが同種のパターン。対象に含めるかは実装時に判断する。

該当なし（role=menuitem を持つが自動フォーカスの実装が無い）: NotificationBell.tsx、WorkMetadataActions.tsx、PlaybackRatePicker.tsx
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 メニューを開いたときの初期フォーカスが祖先を自動スクロールしない（LibrarySortMenu・WorkPlayButton）
- [x] #2 矢印キーによるメニュー内のフォーカス移動も祖先を自動スクロールしない
- [x] #3 AxisValueQuickListの検索input欄への自動フォーカスについて、対象に含めるか除外するかを根拠つきで判断し記録する
- [x] #4 pnpm test:smokeに新規失敗がない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#3判断（統括の指摘で更新）: AxisValueQuickList.tsx内の.focus()呼び出しは
検索input欄への初期フォーカス（:137）・矢印キーによる値行間のroving focus（旧:172、
現focusRowAfterRender内）の両方を対象に含める。

根拠: 既定の.focus()が動かすのは対象要素のすべての祖先スクロールコンテナ。
virtualizer.scrollToIndex()が面倒を見るのは自リスト（AxisValueQuickList自身の
仮想化スクローラー）だけで、その外側にあるoverflow:hiddenな祖先（軸レール等）の
scrollLeftが動く経路は塞がっていない。これはTASK-429で実際に起きた不具合と同型。
scrollToIndexが可視化を済ませた後のfocus()なので{preventScroll:true}を足しても
失うものが無く、副作用ゼロで経路を1本塞げる。またこの経路はArrowUp/ArrowDownから
到達するためAC#2「矢印キーによるメニュー内のフォーカス移動」にも該当する。

（当初はscrollToIndexによる意図的な自リストスクロールと祖先スクロールの巻き添えは
別問題と判断し後者のみ除外していたが、対象は祖先スクロールコンテナ全体であり
scrollToIndexは自リストの分しかカバーしないため誤り。両方に付与するのが正しい）
<!-- SECTION:NOTES:END -->
