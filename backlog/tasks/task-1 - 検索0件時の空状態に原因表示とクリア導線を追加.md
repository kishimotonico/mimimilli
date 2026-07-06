---
id: TASK-1
title: 検索0件時の空状態に原因表示とクリア導線を追加
status: To Do
assignee: []
created_date: '2026-07-05 17:58'
labels:
  - ui
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
検索語で0件になった際、中央カラムに『作品が見つかりません』とだけ表示され、検索語が原因なのか、軸/タグ絞り込みが原因なのか、どう戻せばよいのかが画面から分からない。検索欄内にクリアボタンもなく、キーボード操作に不慣れなユーザーは復帰しづらい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 0件表示に検索語を含め、「〈検索語〉に一致する作品はありません」のように原因を明示する
- [ ] #2 「検索をクリア」ボタンを空状態表示内または検索欄内（もしくは両方）に設置する
- [ ] #3 タグ/軸フィルタが併用されている場合、現在効いている条件を空状態表示に含める
- [ ] #4 0件時に右ペインへ「検索条件を変える」などの案内を表示する
<!-- AC:END -->
