---
id: TASK-447.13
title: 値選択の操作ヒント文言を全ての入口から取り除く
status: Done
assignee: []
created_date: '2026-09-11 04:27'
updated_date: '2026-09-11 04:54'
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
- [x] #1 AxisValueQuickList・AxisQuickOverlay・FilterChipBand・AxisValueList のヒント表示が無くなっている
- [x] #2 getValueSelectionHint と .mll-qlist__hint 等の関連 CSS・テストが削除され、使われないコードが残っていない
- [x] #3 deriveFacetCountTags とそのテストは残っている
- [x] #4 docs/design-system.md のヒント文言に関する記述が削除されている
- [x] #5 着手前後のスクリーンショットを tmp/uiux-triage-2026-09-11/shots-intake/447.13-before.jpg と -after.jpg（クイックオーバーレイ）ほか連番で置いている
- [x] #6 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で消した・書き換えたテストはタスクメモに列挙）
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
消したコード:
- getValueSelectionHint（client/src/features/library/model/valueSelectionContract.ts）本体とJSDoc
- .mll-qlist__hint 描画（AxisValueQuickList.tsx hintプロップ・description JSDoc）、呼び出し元3箇所（AxisQuickOverlay.tsx、FilterChipBand.tsx のFilterChip、AxisValuePopoverPanel.tsx の hintプロップ中継）
- .mll-qlist__hint CSS（library-d.css:715-723）
- AxisValueList.tsx の検索欄隣の <span>{getValueSelectionHint(...)}</span>
- FilterChipAddButton.tsx の AND_ADD_HINT 定数・軸選択ステージの `<div className="mll-qlist__hint">{AND_ADD_HINT}・軸を選択</div>`。ヒント文言と一体だった「軸を選択」という案内文もあわせて削除（ヒントに続けて表示されていた1文だったため分離しなかった）
削除テスト:
- valueSelectionContract.test.ts の describe("getValueSelectionHint（ヒント文言）") 2件
- AxisValueList.test.tsx の describe("AxisValueList の操作ヒント（既定=置き換えの説明を出す）") 1件
残したもの: deriveFacetCountTags とそのテストはそのまま。
docs/design-system.md 200行付近のヒント文言に関する記述（getValueSelectionHintへの言及）を削除。
<!-- SECTION:NOTES:END -->
