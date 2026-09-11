---
id: TASK-447.12
title: テキスト入力欄のフォーカス表現をアクセント色のリングから境界線の弱い変化に変える
status: To Do
assignee: []
created_date: '2026-09-11 04:27'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 480000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機確認フィードバック第1回（tmp/uiux-triage-2026-09-11/followup-1.md の2）。分類軸のクイックオーバーレイの検索欄（AxisValueQuickList.tsx、開いた瞬間に autoFocus）に --focus-ring（2px solid var(--acc)）が当たり、オレンジで目立ちすぎる。テキスト入力はキャレットで位置が分かるので、アクセント色のリングは出さない。ボタン・行・チップ等の focus-visible リングは維持する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 テキスト入力欄（input[type=text]/search 等の文字入力、textarea）はフォーカス時にアクセント色のリングを出さず、境界線色の弱い変化（例: --line → --ink-3 相当）だけで示す
- [ ] #2 対象はクイックオーバーレイの検索欄に加え、トップバー検索・設定モーダル・スマートフォルダー条件・タグ追加コンボボックス・作品編集などアプリ内のテキスト入力すべてで、変更箇所の一覧がタスクメモにある
- [ ] #3 ボタン・行・チップなどキーボード移動で位置を示す要素の focus-visible リングは変わっていない
- [ ] #4 docs/design-system.md のフォーカスリングの記述がこの方針に合わせて更新されている
- [ ] #5 着手前後のスクリーンショットを tmp/uiux-triage-2026-09-11/shots-intake/447.12-before.jpg と -after.jpg（クイックオーバーレイ検索欄）ほか必要に応じて連番で置いている
- [ ] #6 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で消した・書き換えたテストはタスクメモに列挙）
<!-- AC:END -->
