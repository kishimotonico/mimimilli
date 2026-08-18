---
id: TASK-294
title: ライブラリ画面の件数表示を整理する
status: Done
assignee:
  - '@sonnet'
created_date: '2026-08-10 18:59'
updated_date: '2026-08-11 05:19'
labels: []
dependencies: []
ordinal: 304000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
件数表示が分散・重複している。(1) 一覧の「作品 N件」バー（client/src/features/library/ui/WorkGrid.tsx:160-163、リスト表示はWorkListPane.tsx:110）は件数以外の情報・機能を持たないため削除し、件数はその上のタグフィルター行（FilterChipBand、LibraryView.tsx:223-230）へ移して縦の要素を節約する。(2) 軸レールヘッダーの「ライブラリ N件」（client/src/features/library/ui/AxisColumn.tsx:161-166）は見出し「ライブラリ」と表示が重複し総件数しか出していないため削除する。フィルター無しの状態なら一覧側の件数が全件数を兼ねる。両者は .mle-col__hd クラスを共有しているためスタイル変更の影響範囲に注意。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 「作品 N件」バーが削除され、件数がタグフィルター行に表示される
- [x] #2 リスト表示でも同様に件数表示が整理される
- [x] #3 軸レールヘッダーから総件数表示が消える
- [x] #4 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
前任差分(AxisColumn/FilterChipBand/WorkGrid/WorkListPane)を活かし完成。FilterChipBand末尾に.mll-tagband__tailラッパーを追加しCSS(display:flex, margin-left:auto)を補完、絞り込み後件数を右端に表示。LibraryWorksBoundaryにonWorksTotalChangeコールバックを追加しLibraryViewでworksTotal stateへリフト、FilterChipBandへ配線（value-list面ではundefined）。AxisColumnのtotalCount props/表示を削除、LibraryView側のlibraryTotal destructureも不要化して削除。tsc --noEmit通過、agent-browserで一覧/絞り込み後/リスト/グリッド全て確認。pnpm test:smoke 9/10通過、1件(ヨコスクロールテスト)はTASK-294と無関係の既存フレーキー(TASK-301起票)。

【差し戻し対応】TASK-301として起票した『既存フレーキー』の説明は誤りだった。統括のレビュー実測（--repeat-each=5、45/50）で再現・原因特定。詳細はTASK-295のノート参照（真因はTASK-294/295共通で発生した層の問題）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
「作品 N件」バーを削除し、絞り込み後の件数をタグフィルター行の右端へ移設（グリッド・リスト共通）。軸レールヘッダーからは件数のみ削除して見出しは残した。worksTotalはLibraryViewのstateへリフトし、Suspenseフォールバック表示中とエラー捕捉時は未確定へ戻す。
<!-- SECTION:FINAL_SUMMARY:END -->
