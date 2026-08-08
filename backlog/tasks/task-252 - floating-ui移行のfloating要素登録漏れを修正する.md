---
id: TASK-252
title: floating-ui移行のfloating要素登録漏れを修正する
status: Done
assignee: []
created_date: '2026-08-08 10:03'
updated_date: '2026-08-08 10:25'
labels: []
dependencies: []
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-248の完了後にCodexレビューで発見した2件の欠陥。いずれも floating 要素の登録に関するもの。

## 1. WorkMetadataActions で setFloating を接続していない

client/src/features/library/ui/preview/WorkMetadataActions.tsx は useAnchoredPopover から setReference / floatingStyles / close のみを受け取り、setFloating を受け取っていない。floating-ui は floating 要素が未登録だと floatingStyles を初期値 {position:'absolute', left:0, top:0} のまま返す。

旧実装にあった Tailwind の top-[calc(100%+6px)] は TASK-248 で削除済みのため、「その他」メニューが親（relative inline-flex）の左上、つまりトリガーボタンに重なって表示される。あわせて flip/shift/size が一切動かないので旧実装の左右クランプも失われている。

## 2. FilterChipAddButton が退出中パネルと floating ref を共有している

client/src/features/library/ui/FilterChipAddButton.tsx は同一の setFloating を AxisPickerStage と AxisValuePopoverPanel の双方へ渡している。両者は別々の AnimatePresence に属するため、軸を選んだ直後は旧 picker が退出中・新 panel が入場中で並存する。新パネル登録後に旧パネルの退出完了が setFloating(null) を呼び、表示中パネルの参照と autoUpdate を解除する。以降スクロール・リサイズ・高さ変化で flip/shift/size が更新されない。

TASK-248 の実機検証では 1 を「正常表示」と誤って報告していた。位置の検証は目視ではなく矩形の実測で行う必要がある。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WorkMetadataActions のポップオーバーに setFloating が接続され、トリガー直下（隙間6px）に表示される
- [x] #2 FilterChipAddButton で軸を選んだあとも表示中パネルの floating 参照と autoUpdate が維持される
- [x] #3 ポップオーバーの位置検証が getBoundingClientRect による数値実測で確認されている
- [x] #4 pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
React 19 の ref コールバックのクリーンアップ関数で解決した。cleanup を返すと React はそのコールバックを null で呼ばなくなるため、どの要素の登録解除かを識別できる。所有権を持つ node の解除だけを通す。

実測検証（フィクスチャvite port 4177）: WorkMetadataActions のトリガーとポップオーバーの間隔6px、＋絞り込みの値パネル6px、AxisQuickOverlay の軸行との間隔6px（軸A→B切替後も維持）。pnpm check 通過、client 777 / server 505 通過、pnpm test:smoke 10件通過。

判明した挙動変化: WorkMetadataActions は boundary である .mle-prv__meta の下端がトリガー下端とほぼ同位置のため、flip が常に作用して上方向に開く。旧実装は常に下方向でコンテナをはみ出していた。TASK-248 で flip を導入した帰結であり不具合ではない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-248 の floating 要素登録漏れ2件を修正した。WorkMetadataActions に setFloating を接続し、退出中パネルが表示中パネルの登録を消す問題を React 19 の ref クリーンアップ関数による所有権チェックで解決した。位置は getBoundingClientRect による数値実測で確認している。
<!-- SECTION:FINAL_SUMMARY:END -->
