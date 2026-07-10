---
id: TASK-6
title: 狭幅（900px）でのスマートフォルダールール表示を改善する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 09:48'
labels:
  - ui
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
900x720表示で、スマートフォルダーのルール値が横方向に詰まり、「カテゴリ ASMR OR 環境音」のような条件の関係が読み取りづらい。カードとして崩れてはいないが情報密度が高すぎる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ルール行をfield/operator/valuesの1行固定にせず、値チップは折り返す
- [x] #2 狭幅では「WHERE 長さ ≥ 1:00:00」のような自然文寄り表示に切り替える
- [x] #3 ORを小さなラベルでなく、値チップ間の区切りとして視認しやすくする
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェントがセッション制限で中断（途中差分あり・tsc通過状態）。Codexへ引き継ぎ、残実装を委譲。

Codexが引き継ぎ完成、Fable検証: コンテナクエリでペイン実幅に反応、400px時に「WHERE 長さ ≥ 1:00:00」の自然文表示・ORが値チップ間の区切りバッジになることをスクショで確認。コミット 4d49c77。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スマートフォルダールール表示を@containerで適応化。狭幅は自然文寄り、値チップ折り返し、OR区切り明確化。
<!-- SECTION:FINAL_SUMMARY:END -->
