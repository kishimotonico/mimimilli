---
id: TASK-447.13
title: 値選択の操作ヒント文言を全ての入口から取り除く
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
ordinal: 481000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機確認フィードバック第1回（tmp/uiux-triage-2026-09-11/followup-1.md の3）。「クリックで置き換え・Ctrl+クリックでAND追加」のヒント（getValueSelectionHint、.mll-qlist__hint）を消す。ユーザー方針は「UI 操作を文字で説明しない。文字が無くても分かる UI にする」。代替の説明手段は入れない。件数基準（deriveFacetCountTags）は残す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AxisValueQuickList・AxisQuickOverlay・FilterChipBand・AxisValueList のヒント表示が無くなっている
- [ ] #2 getValueSelectionHint と .mll-qlist__hint 等の関連 CSS・テストが削除され、使われないコードが残っていない
- [ ] #3 deriveFacetCountTags とそのテストは残っている
- [ ] #4 docs/design-system.md のヒント文言に関する記述が削除されている
- [ ] #5 着手前後のスクリーンショットを tmp/uiux-triage-2026-09-11/shots-intake/447.13-before.jpg と -after.jpg（クイックオーバーレイ）ほか連番で置いている
- [ ] #6 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で消した・書き換えたテストはタスクメモに列挙）
<!-- AC:END -->
