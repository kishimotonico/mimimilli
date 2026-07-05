---
id: TASK-13
title: スマートフォルダー条件エディタの実装
status: To Do
assignee: []
created_date: '2026-07-05 17:59'
labels:
  - feature
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマートフォルダーの新規作成はwindow.promptで名前のみを入力する暫定実装で、ruleは空配列（rules: []）で固定されている。条件（フィールド/演算子/値）を設定できるエディタUIがない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマートフォルダー作成/編集画面で条件（フィールド・演算子・値）を追加・削除できるUIを提供する
- [ ] #2 複数条件のAND/OR組み合わせに対応する
- [ ] #3 window.promptによる名前のみの暫定作成フローを置き換える
<!-- AC:END -->
