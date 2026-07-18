---
id: TASK-1
title: 検索0件時の空状態に原因表示とクリア導線を追加
status: Done
assignee:
  - '@fable'
created_date: '2026-07-05 17:58'
updated_date: '2026-07-10 00:22'
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
- [x] #1 0件表示に検索語を含め、「〈検索語〉に一致する作品はありません」のように原因を明示する
- [x] #2 「検索をクリア」ボタンを空状態表示内または検索欄内（もしくは両方）に設置する
- [x] #3 タグ/軸フィルタが併用されている場合、現在効いている条件を空状態表示に含める
- [x] #4 0件時に右ペインへ「検索条件を変える」などの案内を表示する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. LibraryViewの0件空状態の現状把握 2. 検索語・適用中フィルタを空状態表示に反映 3. クリア導線（空状態内+検索欄内）実装 4. 右ペイン案内 5. テスト・check
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント実装、Fableがレビュー・agent-browserで実画面検証。検索0件で「〈語〉に一致する作品はありません」+クリアボタン(空状態内・検索欄内の両方)、軸ドリル併用時は「〈語〉・サークル「〈値〉」に一致…」の複合表示、右ペインに「検索条件を変えてみてください」を確認。クリア押下で全件復帰も確認。タグ軸はANDチップが常時見える別レイアウトのためAC#3は既存表示で充足と判断。client check/test 73件・ビジュアルテスト6件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
0件空状態に原因(検索語・軸ドリル値)を明示し、検索クリア導線を空状態と検索欄に追加、右ペインへ案内を表示。コミット c64f498。
<!-- SECTION:FINAL_SUMMARY:END -->
