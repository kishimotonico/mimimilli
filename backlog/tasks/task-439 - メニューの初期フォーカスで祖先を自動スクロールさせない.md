---
id: TASK-439
title: メニューの初期フォーカスで祖先を自動スクロールさせない
status: To Do
assignee: []
created_date: '2026-09-07 20:58'
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
- [ ] #1 メニューを開いたときの初期フォーカスが祖先を自動スクロールしない（LibrarySortMenu・WorkPlayButton）
- [ ] #2 矢印キーによるメニュー内のフォーカス移動も祖先を自動スクロールしない
- [ ] #3 AxisValueQuickListの検索input欄への自動フォーカスについて、対象に含めるか除外するかを根拠つきで判断し記録する
- [ ] #4 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
