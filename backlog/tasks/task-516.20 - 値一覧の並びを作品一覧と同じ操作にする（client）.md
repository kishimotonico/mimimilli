---
id: TASK-516.20
title: 値一覧の並びを作品一覧と同じ操作にする（client）
status: Done
assignee: []
created_date: '2026-11-22 21:25'
updated_date: '2026-11-22 22:10'
labels:
  - library
  - ui
dependencies:
  - TASK-516.19
parent_task_id: TASK-516
priority: high
ordinal: 621000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516.19 で保存できるようになった値一覧の並びを、画面で作品一覧の並びと同じ形で扱う。設計メモ: /tmp/claude-1000/-home-nico-projects-mimikago/group-sort-design.md（案C）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 今の値一覧の並びは route（履歴エントリーの状態）に持ち、既定から外れたときに並びメニューから「この並びを既定にする」で保存できる
- [x] #2 値一覧の並びメニューに8種と向きが出て、グリッド表示でも並びを変えられる
- [x] #3 編集ダイアログは、グループ分けがあるときだけ「値の並び」「作品の並び」の2欄になる（説明文は足さない）
- [x] #4 クイックオーバーレイとパンくずの値のポップオーバーは保存済みの値の並びで出て、列見出しのクリックは開いている間だけの一時状態。groupValueSortAtom は無い
- [x] #5 ADR-0041・design-system.md・requirements-v4.md の値一覧の並びの記述が実装に合っている
- [x] #6 pnpm test:smoke を含めて pnpm check・pnpm test が通る
<!-- AC:END -->
