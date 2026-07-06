---
id: TASK-6
title: 狭幅（900px）でのスマートフォルダールール表示を改善する
status: To Do
assignee: []
created_date: "2026-07-05 17:59"
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

- [ ] #1 ルール行をfield/operator/valuesの1行固定にせず、値チップは折り返す
- [ ] #2 狭幅では「WHERE 長さ ≥ 1:00:00」のような自然文寄り表示に切り替える
- [ ] #3 ORを小さなラベルでなく、値チップ間の区切りとして視認しやすくする
<!-- AC:END -->
