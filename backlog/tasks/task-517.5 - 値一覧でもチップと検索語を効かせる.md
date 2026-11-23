---
id: TASK-517.5
title: 値一覧でもチップと検索語を効かせる
status: To Do
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 12:50'
labels:
  - library
  - client
dependencies:
  - TASK-517.1
parent_task_id: TASK-517
priority: medium
ordinal: 628000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0026 から引き継いだ「値一覧はチップと検索語を効かせない」をやめる。値一覧でタグを足す・検索すると、今のスマートフォルダーの値一覧にそのまま絞り込みがかかり、値と件数が絞り込み後のものになる。操作感はユーザーが実機で確かめ、気になったら戻す（戻す判断はユーザー）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 値一覧でチップを足すと、同じスマートフォルダーの値一覧のまま、値と件数が絞り込み後になる
- [ ] #2 値一覧で検索すると、同じ値一覧のまま検索語が効く
- [ ] #3 チップ追加・検索・値の選択・値一覧へ戻るの遷移が、保持しているライブラリが値一覧か作品一覧かで分岐せず、遷移関数が folders を受け取らない
- [ ] #4 pnpm test:smoke の値一覧のシナリオが新しい挙動で通る
<!-- AC:END -->
