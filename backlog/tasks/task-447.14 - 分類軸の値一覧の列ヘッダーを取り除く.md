---
id: TASK-447.14
title: 分類軸の値一覧の列ヘッダーを取り除く
status: Done
assignee: []
created_date: '2026-09-11 04:28'
updated_date: '2026-09-11 04:54'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 482000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機確認フィードバック第1回（tmp/uiux-triage-2026-09-11/followup-1.md の4）。ライブラリの分類軸の値一覧（AxisValueList.tsx）の列ヘッダー div.mle-col__hd を消す。ユーザー理由「縦幅を取るが表示の意味が薄い（パンくずや左 nav で分かる）」。Files のカラムビュー（FileColumn.tsx）の同クラスは対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 分類軸の値一覧に列ヘッダーが表示されない
- [x] #2 Files のカラムビューの列ヘッダーは変わらず表示される
- [x] #3 ヘッダーに載っていた情報・操作で消えたものがタスクメモに列挙されている
- [x] #4 着手前後のスクリーンショットを tmp/uiux-triage-2026-09-11/shots-intake/447.14-before.jpg と -after.jpg に置いている
- [x] #5 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で消した・書き換えたテストはタスクメモに列挙）
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
消えた情報・操作:
- 見出し文字（軸ラベル、例:「サークル」）→ パンくず・左nav分類軸メニューで表示中なので重複だった
- 件数バッジ（例:「2 件」）→ 一覧下部のステータスバー（11作品・57トラック・21:50:00）で作品数は分かる。値件数のみの表示はこの一覧からは無くなる
- 並び替え操作は無し（ソートは list ヘッダーの「件数」列見出しクリックのみで、mle-col__hd 自体には並び替え操作は無かった）
FileColumn.tsx（Filesのカラムビュー）は変更なし・.mle-col__hd はそのまま共用スタイルとして残す。
<!-- SECTION:NOTES:END -->
