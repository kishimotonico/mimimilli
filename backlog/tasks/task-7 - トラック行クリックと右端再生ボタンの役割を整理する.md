---
id: TASK-7
title: トラック行クリックと右端再生ボタンの役割を整理する
status: To Do
assignee: []
created_date: "2026-07-05 17:59"
labels:
  - ui
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

作品詳細のトラック一覧は行全体クリックでも再生でき、右端にも再生ボタンがあるため、「行選択」と「再生」が別の意味を持つのかユーザーが判断しづらい。

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 行全体クリックを再生に統一し右端ボタンはhover/focus時のみ表示する案、または行クリック=選択/詳細表示・右端ボタン=再生に役割分担する案のいずれかを採用する
- [ ] #2 採用した役割分担に応じて、選択状態と再生状態を視覚的に明確に区別する
- [ ] #3 トラック数が多い作品での操作性が改善されていることを確認する
<!-- AC:END -->
